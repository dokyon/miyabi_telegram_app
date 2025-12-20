/**
 * Database manager for SQLite operations
 */

import sqlite3 from 'sqlite3';
import { PlayerStats, GameState, DatabaseSchema } from '../types/index.js';

export class DatabaseManager {
  private db: sqlite3.Database;

  constructor(dbPath: string = './game.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initialize();
  }

  /**
   * Initialize database tables
   */
  private initialize(): void {
    const createPlayersTable = `
      CREATE TABLE IF NOT EXISTS players (
        telegram_id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        total_games INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createGamesTable = `
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        player1_id INTEGER NOT NULL,
        player2_id INTEGER NOT NULL,
        board TEXT NOT NULL,
        current_player TEXT NOT NULL,
        status TEXT NOT NULL,
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player1_id) REFERENCES players (telegram_id),
        FOREIGN KEY (player2_id) REFERENCES players (telegram_id)
      )
    `;

    this.db.serialize(() => {
      this.db.run(createPlayersTable);
      this.db.run(createGamesTable);
    });
  }

  /**
   * Get or create player stats
   */
  public async getOrCreatePlayer(telegramId: number, username: string): Promise<PlayerStats> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM players WHERE telegram_id = ?';
      
      this.db.get(query, [telegramId], (err, row: DatabaseSchema['players'] | undefined) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          resolve({
            telegramId: row.telegram_id,
            wins: row.wins,
            losses: row.losses,
            draws: row.draws,
            totalGames: row.total_games
          });
        } else {
          // Create new player
          const insertQuery = `
            INSERT INTO players (telegram_id, username)
            VALUES (?, ?)
          `;
          
          this.db.run(insertQuery, [telegramId, username], (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            resolve({
              telegramId,
              wins: 0,
              losses: 0,
              draws: 0,
              totalGames: 0
            });
          });
        }
      });
    });
  }

  /**
   * Update player stats after game
   */
  public async updatePlayerStats(telegramId: number, result: 'win' | 'loss' | 'draw'): Promise<void> {
    return new Promise((resolve, reject) => {
      let updateField = '';
      
      switch (result) {
        case 'win':
          updateField = 'wins = wins + 1';
          break;
        case 'loss':
          updateField = 'losses = losses + 1';
          break;
        case 'draw':
          updateField = 'draws = draws + 1';
          break;
      }

      const query = `
        UPDATE players 
        SET ${updateField}, 
            total_games = total_games + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE telegram_id = ?
      `;

      this.db.run(query, [telegramId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Save game state to database
   */
  public async saveGame(game: GameState, player1Id: number, player2Id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO games 
        (id, player1_id, player2_id, board, current_player, status, result, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const boardJson = JSON.stringify(game.board);
      
      this.db.run(query, [
        game.id,
        player1Id,
        player2Id,
        boardJson,
        game.currentPlayer,
        game.status,
        game.result
      ], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get player stats
   */
  public async getPlayerStats(telegramId: number): Promise<PlayerStats | null> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM players WHERE telegram_id = ?';
      
      this.db.get(query, [telegramId], (err, row: DatabaseSchema['players'] | undefined) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          resolve({
            telegramId: row.telegram_id,
            wins: row.wins,
            losses: row.losses,
            draws: row.draws,
            totalGames: row.total_games
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Close database connection
   */
  public close(): void {
    this.db.close();
  }
}