/**
 * Game manager for handling rooms and matches
 */

import { GameRoom, GameState, Player, TelegramUser } from '../types/index.js';
import { GameLogic } from './gameLogic.js';
import { DatabaseManager } from '../database/database.js';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerRooms: Map<string, string> = new Map(); // playerId -> roomId
  private matchmakingQueue: string[] = []; // playerIds waiting for match
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  /**
   * Create a new game room
   */
  public createRoom(player: Player): string {
    const roomId = uuidv4();
    const game: GameState = {
      id: uuidv4(),
      players: [player],
      board: GameLogic.createEmptyBoard(),
      currentPlayer: 'X',
      status: 'waiting',
      result: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const room: GameRoom = {
      id: roomId,
      game,
      spectators: []
    };

    this.rooms.set(roomId, room);
    this.playerRooms.set(player.id, roomId);

    return roomId;
  }

  /**
   * Join an existing room
   */
  public joinRoom(roomId: string, player: Player): { success: boolean; room?: GameRoom; error?: string } {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.game.players.length >= 2) {
      // Add as spectator
      room.spectators.push(player.id);
      return { success: true, room };
    }

    // Add as second player
    room.game.players.push(player);
    this.playerRooms.set(player.id, roomId);

    // Start the game
    if (room.game.players.length === 2) {
      room.game = GameLogic.createNewGame(room.game.players[0], room.game.players[1]);
    }

    return { success: true, room };
  }

  /**
   * Add player to matchmaking queue
   */
  public findMatch(player: Player): { matched: boolean; room?: GameRoom } {
    // Remove from queue if already there
    const existingIndex = this.matchmakingQueue.indexOf(player.id);
    if (existingIndex !== -1) {
      this.matchmakingQueue.splice(existingIndex, 1);
    }

    // Try to match with waiting player
    if (this.matchmakingQueue.length > 0) {
      const waitingPlayerId = this.matchmakingQueue.shift()!;
      const waitingPlayerRoom = this.playerRooms.get(waitingPlayerId);
      
      if (waitingPlayerRoom) {
        const room = this.rooms.get(waitingPlayerRoom);
        if (room && room.game.players.length === 1) {
          const joinResult = this.joinRoom(waitingPlayerRoom, player);
          if (joinResult.success) {
            return { matched: true, room: joinResult.room };
          }
        }
      }

      // If matching failed, create new room and add to queue
      const roomId = this.createRoom(player);
      this.matchmakingQueue.push(player.id);
      return { matched: false };
    }

    // No one waiting, create room and add to queue
    const roomId = this.createRoom(player);
    this.matchmakingQueue.push(player.id);
    return { matched: false };
  }

  /**
   * Make a move in the game
   */
  public async makeMove(
    playerId: string, 
    row: number, 
    col: number
  ): Promise<{ success: boolean; room?: GameRoom; error?: string }> {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) {
      return { success: false, error: 'Player not in any room' };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const moveResult = GameLogic.makeMove(room.game, playerId, row, col);
    if (!moveResult.success) {
      return { success: false, error: moveResult.error };
    }

    // Save game state to database
    try {
      const player1 = room.game.players[0];
      const player2 = room.game.players[1];
      await this.db.saveGame(room.game, player1.telegramId, player2.telegramId);
    } catch (error) {
      console.error('Failed to save game:', error);
    }

    // Update player stats if game finished
    if (room.game.status === 'finished') {
      await this.updatePlayerStats(room.game);
    }

    return { success: true, room };
  }

  /**
   * Handle rematch request
   */
  public handleRematch(playerId: string): { success: boolean; room?: GameRoom; error?: string } {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) {
      return { success: false, error: 'Player not in any room' };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.game.status !== 'finished') {
      return { success: false, error: 'Game is not finished' };
    }

    // Mark player as ready for rematch
    const player = room.game.players.find(p => p.id === playerId);
    if (player) {
      player.isReady = true;
    }

    // Check if both players are ready
    const allReady = room.game.players.every(p => p.isReady);
    if (allReady) {
      room.game = GameLogic.resetGame(room.game);
    }

    return { success: true, room };
  }

  /**
   * Remove player from room
   */
  public leaveRoom(playerId: string): { success: boolean; roomId?: string } {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) {
      return { success: false };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false };
    }

    // Remove from players
    room.game.players = room.game.players.filter(p => p.id !== playerId);
    
    // Remove from spectators
    room.spectators = room.spectators.filter(id => id !== playerId);
    
    // Remove from matchmaking queue
    const queueIndex = this.matchmakingQueue.indexOf(playerId);
    if (queueIndex !== -1) {
      this.matchmakingQueue.splice(queueIndex, 1);
    }

    this.playerRooms.delete(playerId);

    // Delete room if empty
    if (room.game.players.length === 0 && room.spectators.length === 0) {
      this.rooms.delete(roomId);
    }

    return { success: true, roomId };
  }

  /**
   * Get room by ID
   */
  public getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get room by player ID
   */
  public getRoomByPlayer(playerId: string): GameRoom | undefined {
    const roomId = this.playerRooms.get(playerId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  /**
   * Create player from Telegram user data
   */
  public static createPlayer(telegramUser: TelegramUser, socketId: string): Player {
    return {
      id: socketId,
      telegramId: telegramUser.id,
      username: telegramUser.username || telegramUser.first_name,
      symbol: 'X', // Will be assigned when game starts
      isReady: false
    };
  }

  /**
   * Update player statistics after game
   */
  private async updatePlayerStats(game: GameState): Promise<void> {
    try {
      const [player1, player2] = game.players;

      if (game.result === 'draw') {
        await this.db.updatePlayerStats(player1.telegramId, 'draw');
        await this.db.updatePlayerStats(player2.telegramId, 'draw');
      } else if (game.result) {
        const winner = game.players.find(p => p.symbol === game.result);
        const loser = game.players.find(p => p.symbol !== game.result);

        if (winner && loser) {
          await this.db.updatePlayerStats(winner.telegramId, 'win');
          await this.db.updatePlayerStats(loser.telegramId, 'loss');
        }
      }
    } catch (error) {
      console.error('Failed to update player stats:', error);
    }
  }
}