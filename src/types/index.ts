/**
 * Type definitions for Telegram Tic-Tac-Toe game
 */

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramWebAppInitData {
  user?: TelegramUser;
  auth_date: number;
  hash: string;
}

export type CellValue = 'X' | 'O' | null;
export type GameBoard = CellValue[][];
export type GameStatus = 'waiting' | 'playing' | 'finished';
export type GameResult = 'X' | 'O' | 'draw' | null;

export interface Player {
  id: string;
  telegramId: number;
  username: string;
  symbol: 'X' | 'O';
  isReady: boolean;
}

export interface GameState {
  id: string;
  players: Player[];
  board: GameBoard;
  currentPlayer: 'X' | 'O';
  status: GameStatus;
  result: GameResult;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameRoom {
  id: string;
  game: GameState;
  spectators: string[];
}

export interface PlayerStats {
  telegramId: number;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
}

export interface SocketEvents {
  // Client to Server
  'join-room': (roomId: string) => void;
  'create-room': () => void;
  'find-match': () => void;
  'make-move': (row: number, col: number) => void;
  'request-rematch': () => void;
  'accept-rematch': () => void;
  'decline-rematch': () => void;
  'leave-room': () => void;
  
  // Server to Client
  'room-joined': (room: GameRoom) => void;
  'room-created': (roomId: string) => void;
  'match-found': (room: GameRoom) => void;
  'game-updated': (game: GameState) => void;
  'move-made': (game: GameState) => void;
  'game-ended': (game: GameState, stats: PlayerStats[]) => void;
  'rematch-requested': (playerId: string) => void;
  'rematch-accepted': (room: GameRoom) => void;
  'rematch-declined': () => void;
  'player-left': (playerId: string) => void;
  'error': (message: string) => void;
}

export interface DatabaseSchema {
  games: {
    id: string;
    player1_id: number;
    player2_id: number;
    board: string;
    current_player: string;
    status: string;
    result: string | null;
    created_at: string;
    updated_at: string;
  };
  
  players: {
    telegram_id: number;
    username: string;
    wins: number;
    losses: number;
    draws: number;
    total_games: number;
    created_at: string;
    updated_at: string;
  };
}