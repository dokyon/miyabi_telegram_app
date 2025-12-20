/**
 * Tic-Tac-Toe game logic implementation
 */

import { GameBoard, CellValue, GameResult, GameState, Player } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class GameLogic {
  /**
   * Create empty game board
   */
  public static createEmptyBoard(): GameBoard {
    return [
      [null, null, null],
      [null, null, null],
      [null, null, null]
    ];
  }

  /**
   * Create new game state
   */
  public static createNewGame(player1: Player, player2: Player): GameState {
    // Randomly assign X and O
    const isPlayer1X = Math.random() < 0.5;
    player1.symbol = isPlayer1X ? 'X' : 'O';
    player2.symbol = isPlayer1X ? 'O' : 'X';

    return {
      id: uuidv4(),
      players: [player1, player2],
      board: this.createEmptyBoard(),
      currentPlayer: 'X', // X always starts
      status: 'playing',
      result: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Validate if move is valid
   */
  public static isValidMove(board: GameBoard, row: number, col: number): boolean {
    // Check bounds
    if (row < 0 || row > 2 || col < 0 || col > 2) {
      return false;
    }

    // Check if cell is empty
    return board[row][col] === null;
  }

  /**
   * Make a move on the board
   */
  public static makeMove(
    game: GameState,
    playerId: string,
    row: number,
    col: number
  ): { success: boolean; error?: string } {
    // Validate game status
    if (game.status !== 'playing') {
      return { success: false, error: 'Game is not active' };
    }

    // Find player
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Validate turn
    if (player.symbol !== game.currentPlayer) {
      return { success: false, error: 'Not your turn' };
    }

    // Validate move
    if (!this.isValidMove(game.board, row, col)) {
      return { success: false, error: 'Invalid move' };
    }

    // Make the move
    game.board[row][col] = player.symbol;
    game.updatedAt = new Date();

    // Check for win or draw
    const result = this.checkGameResult(game.board);
    if (result) {
      game.result = result;
      game.status = 'finished';
    } else {
      // Switch turns
      game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
    }

    return { success: true };
  }

  /**
   * Check if there's a winner or draw
   */
  public static checkGameResult(board: GameBoard): GameResult {
    // Check rows
    for (let row = 0; row < 3; row++) {
      if (board[row][0] && 
          board[row][0] === board[row][1] && 
          board[row][1] === board[row][2]) {
        return board[row][0];
      }
    }

    // Check columns
    for (let col = 0; col < 3; col++) {
      if (board[0][col] && 
          board[0][col] === board[1][col] && 
          board[1][col] === board[2][col]) {
        return board[0][col];
      }
    }

    // Check diagonals
    if (board[0][0] && 
        board[0][0] === board[1][1] && 
        board[1][1] === board[2][2]) {
      return board[0][0];
    }

    if (board[0][2] && 
        board[0][2] === board[1][1] && 
        board[1][1] === board[2][0]) {
      return board[0][2];
    }

    // Check for draw (board full)
    const isBoardFull = board.every(row => 
      row.every(cell => cell !== null)
    );
    
    if (isBoardFull) {
      return 'draw';
    }

    return null; // Game continues
  }

  /**
   * Reset game for rematch
   */
  public static resetGame(game: GameState): GameState {
    // Switch who starts (fair play)
    const newStartingPlayer: CellValue = game.currentPlayer === 'X' ? 'O' : 'X';
    
    // Swap symbols
    game.players.forEach(player => {
      player.symbol = player.symbol === 'X' ? 'O' : 'X';
      player.isReady = false;
    });

    return {
      ...game,
      id: uuidv4(), // New game ID
      board: this.createEmptyBoard(),
      currentPlayer: newStartingPlayer || 'X',
      status: 'playing',
      result: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get current game statistics
   */
  public static getGameStats(board: GameBoard): {
    totalMoves: number;
    movesLeft: number;
    isGameActive: boolean;
  } {
    let totalMoves = 0;
    
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (board[row][col] !== null) {
          totalMoves++;
        }
      }
    }

    const movesLeft = 9 - totalMoves;
    const result = this.checkGameResult(board);
    const isGameActive = result === null;

    return {
      totalMoves,
      movesLeft,
      isGameActive
    };
  }
}