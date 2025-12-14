/**
 * Tests for game logic
 */

import { GameLogic } from './gameLogic';
import { Player, GameState } from '../types';

describe('GameLogic', () => {
  let player1: Player;
  let player2: Player;
  let game: GameState;

  beforeEach(() => {
    player1 = {
      id: 'player1',
      telegramId: 123,
      username: 'Player1',
      symbol: 'X',
      isReady: false
    };

    player2 = {
      id: 'player2',
      telegramId: 456,
      username: 'Player2',
      symbol: 'O',
      isReady: false
    };

    game = GameLogic.createNewGame(player1, player2);
  });

  describe('createEmptyBoard', () => {
    it('should create a 3x3 board with all null values', () => {
      const board = GameLogic.createEmptyBoard();
      expect(board).toHaveLength(3);
      expect(board[0]).toHaveLength(3);
      expect(board.every(row => row.every(cell => cell === null))).toBe(true);
    });
  });

  describe('createNewGame', () => {
    it('should create a new game with correct initial state', () => {
      expect(game.players).toHaveLength(2);
      expect(game.board).toEqual(GameLogic.createEmptyBoard());
      expect(game.currentPlayer).toBe('X');
      expect(game.status).toBe('playing');
      expect(game.result).toBeNull();
    });

    it('should assign different symbols to players', () => {
      const symbols = game.players.map(p => p.symbol);
      expect(symbols).toContain('X');
      expect(symbols).toContain('O');
      expect(symbols[0]).not.toBe(symbols[1]);
    });
  });

  describe('isValidMove', () => {
    it('should return true for empty cells', () => {
      expect(GameLogic.isValidMove(game.board, 0, 0)).toBe(true);
      expect(GameLogic.isValidMove(game.board, 1, 1)).toBe(true);
      expect(GameLogic.isValidMove(game.board, 2, 2)).toBe(true);
    });

    it('should return false for occupied cells', () => {
      game.board[1][1] = 'X';
      expect(GameLogic.isValidMove(game.board, 1, 1)).toBe(false);
    });

    it('should return false for out of bounds coordinates', () => {
      expect(GameLogic.isValidMove(game.board, -1, 0)).toBe(false);
      expect(GameLogic.isValidMove(game.board, 0, -1)).toBe(false);
      expect(GameLogic.isValidMove(game.board, 3, 0)).toBe(false);
      expect(GameLogic.isValidMove(game.board, 0, 3)).toBe(false);
    });
  });

  describe('makeMove', () => {
    it('should successfully make a valid move', () => {
      const currentPlayer = game.players.find(p => p.symbol === game.currentPlayer)!;
      const result = GameLogic.makeMove(game, currentPlayer.id, 1, 1);
      
      expect(result.success).toBe(true);
      expect(game.board[1][1]).toBe(currentPlayer.symbol);
    });

    it('should switch turns after successful move', () => {
      const initialPlayer = game.currentPlayer;
      const currentPlayerObj = game.players.find(p => p.symbol === initialPlayer)!;
      
      GameLogic.makeMove(game, currentPlayerObj.id, 1, 1);
      
      expect(game.currentPlayer).not.toBe(initialPlayer);
    });

    it('should reject move from wrong player', () => {
      const wrongPlayer = game.players.find(p => p.symbol !== game.currentPlayer)!;
      const result = GameLogic.makeMove(game, wrongPlayer.id, 1, 1);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not your turn');
    });

    it('should reject invalid moves', () => {
      const currentPlayer = game.players.find(p => p.symbol === game.currentPlayer)!;
      const result = GameLogic.makeMove(game, currentPlayer.id, -1, 0);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid move');
    });

    it('should reject moves on occupied cells', () => {
      const currentPlayer = game.players.find(p => p.symbol === game.currentPlayer)!;
      game.board[1][1] = 'O';
      
      const result = GameLogic.makeMove(game, currentPlayer.id, 1, 1);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid move');
    });
  });

  describe('checkGameResult', () => {
    it('should detect horizontal wins', () => {
      // Test each row
      for (let row = 0; row < 3; row++) {
        const board = GameLogic.createEmptyBoard();
        board[row][0] = board[row][1] = board[row][2] = 'X';
        expect(GameLogic.checkGameResult(board)).toBe('X');
      }
    });

    it('should detect vertical wins', () => {
      // Test each column
      for (let col = 0; col < 3; col++) {
        const board = GameLogic.createEmptyBoard();
        board[0][col] = board[1][col] = board[2][col] = 'O';
        expect(GameLogic.checkGameResult(board)).toBe('O');
      }
    });

    it('should detect diagonal wins', () => {
      // Test main diagonal
      let board = GameLogic.createEmptyBoard();
      board[0][0] = board[1][1] = board[2][2] = 'X';
      expect(GameLogic.checkGameResult(board)).toBe('X');

      // Test anti-diagonal
      board = GameLogic.createEmptyBoard();
      board[0][2] = board[1][1] = board[2][0] = 'O';
      expect(GameLogic.checkGameResult(board)).toBe('O');
    });

    it('should detect draw when board is full', () => {
      const board = [
        ['X', 'O', 'X'],
        ['O', 'O', 'X'],
        ['O', 'X', 'O']
      ];
      expect(GameLogic.checkGameResult(board)).toBe('draw');
    });

    it('should return null for ongoing game', () => {
      expect(GameLogic.checkGameResult(game.board)).toBeNull();
    });
  });

  describe('resetGame', () => {
    it('should reset game state for rematch', () => {
      // Make some moves first
      const player1Obj = game.players[0];
      const player2Obj = game.players[1];
      
      GameLogic.makeMove(game, player1Obj.id, 1, 1);
      GameLogic.makeMove(game, player2Obj.id, 0, 0);
      
      const originalId = game.id;
      const resetGame = GameLogic.resetGame(game);
      
      expect(resetGame.id).not.toBe(originalId);
      expect(resetGame.board).toEqual(GameLogic.createEmptyBoard());
      expect(resetGame.status).toBe('playing');
      expect(resetGame.result).toBeNull();
      expect(resetGame.players.every(p => !p.isReady)).toBe(true);
    });

    it('should swap player symbols', () => {
      const originalSymbols = game.players.map(p => p.symbol);
      const resetGame = GameLogic.resetGame(game);
      const newSymbols = resetGame.players.map(p => p.symbol);
      
      expect(newSymbols[0]).toBe(originalSymbols[1]);
      expect(newSymbols[1]).toBe(originalSymbols[0]);
    });
  });

  describe('getGameStats', () => {
    it('should return correct stats for empty board', () => {
      const stats = GameLogic.getGameStats(game.board);
      
      expect(stats.totalMoves).toBe(0);
      expect(stats.movesLeft).toBe(9);
      expect(stats.isGameActive).toBe(true);
    });

    it('should return correct stats for partially filled board', () => {
      game.board[0][0] = 'X';
      game.board[1][1] = 'O';
      game.board[2][2] = 'X';
      
      const stats = GameLogic.getGameStats(game.board);
      
      expect(stats.totalMoves).toBe(3);
      expect(stats.movesLeft).toBe(6);
      expect(stats.isGameActive).toBe(false); // X wins on diagonal
    });

    it('should detect inactive game when there is a winner', () => {
      game.board[0][0] = game.board[0][1] = game.board[0][2] = 'X';
      
      const stats = GameLogic.getGameStats(game.board);
      
      expect(stats.isGameActive).toBe(false);
    });
  });
});