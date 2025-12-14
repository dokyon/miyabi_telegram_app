/**
 * Main server implementation with Socket.IO and Express
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { TelegramAuth } from './auth/telegramAuth.js';
import { DatabaseManager } from './database/database.js';
import { GameManager } from './game/gameManager.js';
import { SocketEvents, TelegramUser, PlayerStats } from './types/index.js';

const app = express();
const server = createServer(app);
const io = new Server<SocketEvents>(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Environment variables
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || 'your_bot_token_here';
const DB_PATH = process.env.DB_PATH || './game.db';

// Initialize services
const telegramAuth = new TelegramAuth(BOT_TOKEN);
const database = new DatabaseManager(DB_PATH);
const gameManager = new GameManager(database);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Express routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/stats/:telegramId', async (req, res) => {
  try {
    const telegramId = parseInt(req.params.telegramId);
    const stats = await database.getPlayerStats(telegramId);
    res.json(stats || { telegramId, wins: 0, losses: 0, draws: 0, totalGames: 0 });
  } catch (error) {
    console.error('Failed to get player stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const initData = socket.handshake.auth.initData;
  
  if (!initData) {
    next(new Error('No authentication data provided'));
    return;
  }

  const validation = telegramAuth.validateInitData(initData);
  if (!validation.valid) {
    next(new Error(validation.error || 'Invalid authentication'));
    return;
  }

  if (!validation.user) {
    next(new Error('No user data found'));
    return;
  }

  const userValidation = telegramAuth.validateUserPermissions(validation.user);
  if (!userValidation.valid) {
    next(new Error(userValidation.error || 'Invalid user permissions'));
    return;
  }

  // Store user data in socket
  socket.data.user = validation.user;
  next();
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  const user: TelegramUser = socket.data.user;
  console.log(`User connected: ${user.username || user.first_name} (${user.id})`);

  // Create player object
  const player = GameManager.createPlayer(user, socket.id);

  // Initialize player in database
  database.getOrCreatePlayer(user.id, user.username || user.first_name)
    .catch(error => console.error('Failed to initialize player:', error));

  // Handle room creation
  socket.on('create-room', () => {
    try {
      const roomId = gameManager.createRoom(player);
      socket.join(roomId);
      socket.emit('room-created', roomId);
      
      const room = gameManager.getRoom(roomId);
      if (room) {
        socket.emit('room-joined', room);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
      socket.emit('error', 'Failed to create room');
    }
  });

  // Handle room joining
  socket.on('join-room', (roomId: string) => {
    try {
      const result = gameManager.joinRoom(roomId, player);
      
      if (result.success && result.room) {
        socket.join(roomId);
        socket.emit('room-joined', result.room);
        
        // Notify other players in the room
        socket.to(roomId).emit('game-updated', result.room.game);
        
        // If game started, notify both players
        if (result.room.game.status === 'playing') {
          io.to(roomId).emit('game-updated', result.room.game);
        }
      } else {
        socket.emit('error', result.error || 'Failed to join room');
      }
    } catch (error) {
      console.error('Failed to join room:', error);
      socket.emit('error', 'Failed to join room');
    }
  });

  // Handle matchmaking
  socket.on('find-match', () => {
    try {
      const result = gameManager.findMatch(player);
      
      if (result.matched && result.room) {
        socket.join(result.room.id);
        socket.emit('match-found', result.room);
        
        // Notify the other player
        socket.to(result.room.id).emit('match-found', result.room);
        io.to(result.room.id).emit('game-updated', result.room.game);
      }
      // If not matched, player is added to queue automatically
    } catch (error) {
      console.error('Failed to find match:', error);
      socket.emit('error', 'Failed to find match');
    }
  });

  // Handle moves
  socket.on('make-move', async (row: number, col: number) => {
    try {
      const result = await gameManager.makeMove(player.id, row, col);
      
      if (result.success && result.room) {
        io.to(result.room.id).emit('move-made', result.room.game);
        
        // If game ended, send stats
        if (result.room.game.status === 'finished') {
          const stats = await Promise.all(
            result.room.game.players.map(p =>
              database.getPlayerStats(p.telegramId)
            )
          );

          io.to(result.room.id).emit('game-ended', result.room.game, stats.filter((s): s is PlayerStats => s !== null));
        }
      } else {
        socket.emit('error', result.error || 'Invalid move');
      }
    } catch (error) {
      console.error('Failed to make move:', error);
      socket.emit('error', 'Failed to make move');
    }
  });

  // Handle rematch requests
  socket.on('request-rematch', () => {
    try {
      const room = gameManager.getRoomByPlayer(player.id);
      if (room) {
        socket.to(room.id).emit('rematch-requested', player.id);
      }
    } catch (error) {
      console.error('Failed to request rematch:', error);
      socket.emit('error', 'Failed to request rematch');
    }
  });

  socket.on('accept-rematch', () => {
    try {
      const result = gameManager.handleRematch(player.id);
      
      if (result.success && result.room) {
        if (result.room.game.status === 'playing') {
          // Both players accepted, start new game
          io.to(result.room.id).emit('rematch-accepted', result.room);
          io.to(result.room.id).emit('game-updated', result.room.game);
        }
      } else {
        socket.emit('error', result.error || 'Failed to accept rematch');
      }
    } catch (error) {
      console.error('Failed to accept rematch:', error);
      socket.emit('error', 'Failed to accept rematch');
    }
  });

  socket.on('decline-rematch', () => {
    try {
      const room = gameManager.getRoomByPlayer(player.id);
      if (room) {
        socket.to(room.id).emit('rematch-declined');
      }
    } catch (error) {
      console.error('Failed to decline rematch:', error);
    }
  });

  // Handle leaving room
  socket.on('leave-room', () => {
    handlePlayerDisconnect();
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${user.username || user.first_name} (${user.id})`);
    handlePlayerDisconnect();
  });

  function handlePlayerDisconnect() {
    try {
      const result = gameManager.leaveRoom(player.id);
      
      if (result.success && result.roomId) {
        socket.to(result.roomId).emit('player-left', player.id);
        socket.leave(result.roomId);
      }
    } catch (error) {
      console.error('Failed to handle player disconnect:', error);
    }
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  database.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  database.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});