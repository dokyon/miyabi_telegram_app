/**
 * Tests for game manager
 */

import { GameManager } from './gameManager';
import { DatabaseManager } from '../database/database';
import { Player, TelegramUser } from '../types';

// Mock database
jest.mock('../database/database');
const MockedDatabaseManager = DatabaseManager as jest.MockedClass<typeof DatabaseManager>;

describe('GameManager', () => {
  let gameManager: GameManager;
  let mockDb: jest.Mocked<DatabaseManager>;
  let player1: Player;
  let player2: Player;

  beforeEach(() => {
    mockDb = new MockedDatabaseManager() as jest.Mocked<DatabaseManager>;
    gameManager = new GameManager(mockDb);

    player1 = {
      id: 'socket1',
      telegramId: 123,
      username: 'Player1',
      symbol: 'X',
      isReady: false
    };

    player2 = {
      id: 'socket2',
      telegramId: 456,
      username: 'Player2',
      symbol: 'O',
      isReady: false
    };

    // Setup database mocks
    mockDb.saveGame = jest.fn().mockResolvedValue(undefined);
    mockDb.updatePlayerStats = jest.fn().mockResolvedValue(undefined);
    mockDb.getPlayerStats = jest.fn().mockResolvedValue({
      telegramId: 123,
      wins: 0,
      losses: 0,
      draws: 0,
      totalGames: 0
    });
  });

  describe('createRoom', () => {
    it('should create a new room with one player', () => {
      const roomId = gameManager.createRoom(player1);
      
      expect(typeof roomId).toBe('string');
      expect(roomId.length).toBeGreaterThan(0);
      
      const room = gameManager.getRoom(roomId);
      expect(room).toBeDefined();
      expect(room!.game.players).toHaveLength(1);
      expect(room!.game.players[0]).toBe(player1);
      expect(room!.game.status).toBe('waiting');
    });
  });

  describe('joinRoom', () => {
    it('should allow second player to join room', () => {
      const roomId = gameManager.createRoom(player1);
      const result = gameManager.joinRoom(roomId, player2);
      
      expect(result.success).toBe(true);
      expect(result.room).toBeDefined();
      expect(result.room!.game.players).toHaveLength(2);
      expect(result.room!.game.status).toBe('playing');
    });

    it('should return error for non-existent room', () => {
      const result = gameManager.joinRoom('invalid-room-id', player2);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Room not found');
    });

    it('should add third player as spectator', () => {
      const roomId = gameManager.createRoom(player1);
      gameManager.joinRoom(roomId, player2);
      
      const player3: Player = {
        id: 'socket3',
        telegramId: 789,
        username: 'Player3',
        symbol: 'X',
        isReady: false
      };
      
      const result = gameManager.joinRoom(roomId, player3);
      
      expect(result.success).toBe(true);
      expect(result.room!.spectators).toContain(player3.id);
    });
  });

  describe('findMatch', () => {
    it('should create room for first player seeking match', () => {
      const result = gameManager.findMatch(player1);
      
      expect(result.matched).toBe(false);
      expect(result.room).toBeUndefined();
    });

    it('should match two players seeking games', () => {
      // First player seeks match
      gameManager.findMatch(player1);
      
      // Second player seeks match - should be matched
      const result = gameManager.findMatch(player2);
      
      expect(result.matched).toBe(true);
      expect(result.room).toBeDefined();
      expect(result.room!.game.players).toHaveLength(2);
      expect(result.room!.game.status).toBe('playing');
    });
  });

  describe('makeMove', () => {
    let roomId: string;

    beforeEach(() => {
      roomId = gameManager.createRoom(player1);
      gameManager.joinRoom(roomId, player2);
    });

    it('should successfully make valid move', async () => {
      const room = gameManager.getRoom(roomId)!;
      const currentPlayer = room.game.players.find(p => p.symbol === room.game.currentPlayer)!;
      
      const result = await gameManager.makeMove(currentPlayer.id, 1, 1);
      
      expect(result.success).toBe(true);
      expect(result.room!.game.board[1][1]).toBe(currentPlayer.symbol);
      expect(mockDb.saveGame).toHaveBeenCalled();
    });

    it('should reject move from player not in room', async () => {
      const result = await gameManager.makeMove('invalid-player', 1, 1);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Player not in any room');
    });

    it('should update stats when game ends', async () => {
      const room = gameManager.getRoom(roomId)!;
      const player = room.game.players[0];
      
      // Make winning moves
      await gameManager.makeMove(player.id, 0, 0);
      
      const otherPlayer = room.game.players[1];
      await gameManager.makeMove(otherPlayer.id, 1, 0);
      await gameManager.makeMove(player.id, 0, 1);
      await gameManager.makeMove(otherPlayer.id, 1, 1);
      
      const result = await gameManager.makeMove(player.id, 0, 2);
      
      expect(result.room!.game.status).toBe('finished');
      expect(mockDb.updatePlayerStats).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleRematch', () => {
    let roomId: string;

    beforeEach(() => {
      roomId = gameManager.createRoom(player1);
      gameManager.joinRoom(roomId, player2);
      
      // Finish the game
      const room = gameManager.getRoom(roomId)!;
      room.game.status = 'finished';
      room.game.result = 'X';
    });

    it('should mark player as ready for rematch', () => {
      const result = gameManager.handleRematch(player1.id);
      
      expect(result.success).toBe(true);
      
      const room = gameManager.getRoom(roomId)!;
      const player = room.game.players.find(p => p.id === player1.id)!;
      expect(player.isReady).toBe(true);
    });

    it('should start new game when both players are ready', () => {
      gameManager.handleRematch(player1.id);
      const result = gameManager.handleRematch(player2.id);
      
      expect(result.success).toBe(true);
      expect(result.room!.game.status).toBe('playing');
      expect(result.room!.game.result).toBeNull();
    });

    it('should reject rematch for non-finished game', () => {
      const room = gameManager.getRoom(roomId)!;
      room.game.status = 'playing';
      
      const result = gameManager.handleRematch(player1.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Game is not finished');
    });
  });

  describe('leaveRoom', () => {
    it('should remove player from room', () => {
      const roomId = gameManager.createRoom(player1);
      gameManager.joinRoom(roomId, player2);
      
      const result = gameManager.leaveRoom(player1.id);
      
      expect(result.success).toBe(true);
      expect(result.roomId).toBe(roomId);
      
      const room = gameManager.getRoom(roomId)!;
      expect(room.game.players).not.toContain(player1);
    });

    it('should delete empty room', () => {
      const roomId = gameManager.createRoom(player1);
      
      gameManager.leaveRoom(player1.id);
      
      const room = gameManager.getRoom(roomId);
      expect(room).toBeUndefined();
    });

    it('should return false for player not in any room', () => {
      const result = gameManager.leaveRoom('invalid-player');
      
      expect(result.success).toBe(false);
    });
  });

  describe('createPlayer', () => {
    it('should create player from Telegram user data', () => {
      const telegramUser: TelegramUser = {
        id: 123456,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe'
      };
      
      const player = GameManager.createPlayer(telegramUser, 'socket-id');
      
      expect(player.id).toBe('socket-id');
      expect(player.telegramId).toBe(123456);
      expect(player.username).toBe('johndoe');
      expect(player.symbol).toBe('X');
      expect(player.isReady).toBe(false);
    });

    it('should use first_name when username is not available', () => {
      const telegramUser: TelegramUser = {
        id: 123456,
        first_name: 'John'
      };
      
      const player = GameManager.createPlayer(telegramUser, 'socket-id');
      
      expect(player.username).toBe('John');
    });
  });

  describe('getRoomByPlayer', () => {
    it('should return room containing the player', () => {
      const roomId = gameManager.createRoom(player1);
      
      const room = gameManager.getRoomByPlayer(player1.id);
      
      expect(room).toBeDefined();
      expect(room!.id).toBe(roomId);
    });

    it('should return undefined for player not in any room', () => {
      const room = gameManager.getRoomByPlayer('invalid-player');
      
      expect(room).toBeUndefined();
    });
  });
});