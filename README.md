# Telegram WebApp Tic-Tac-Toe

A real-time multiplayer Tic-Tac-Toe game built specifically for Telegram WebApp with TypeScript, Socket.IO, and SQLite.

## Features

- 🎮 **Real-time Multiplayer**: Play against other users in real-time using Socket.IO
- 🔐 **Telegram Integration**: Secure authentication using Telegram WebApp SDK
- 🏆 **Player Statistics**: Track wins, losses, draws, and total games
- 🎯 **Room System**: Create private rooms or use random matchmaking
- 🔄 **Rematch System**: Request rematches after games end
- 👥 **Spectator Mode**: Watch ongoing games as a spectator
- 📱 **Mobile Optimized**: Responsive design optimized for mobile devices
- 🎨 **Telegram Themes**: Automatically adapts to Telegram's theme colors

## Technology Stack

- **Backend**: Node.js, TypeScript, Express, Socket.IO
- **Database**: SQLite with custom database manager
- **Frontend**: Vanilla TypeScript, Telegram WebApp SDK
- **Testing**: Jest with 80%+ test coverage
- **Development**: ESLint, TypeScript strict mode

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd telegram-tictactoe
```

2. Install dependencies:
```bash
npm install
```

3. Set environment variables:
```bash
export BOT_TOKEN="your_telegram_bot_token"
export PORT="3000"
export DB_PATH="./game.db"
```

4. Build the application:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

For development:
```bash
npm run dev
```

## Testing

Run tests with coverage:
```bash
npm run test:coverage
```

Run tests in watch mode:
```bash
npm test
```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/stats/:telegramId` - Get player statistics
- `GET /` - Serve the game client

## Socket.IO Events

### Client to Server
- `create-room` - Create a new game room
- `join-room` - Join an existing room by ID
- `find-match` - Find a random opponent
- `make-move` - Make a move on the game board
- `request-rematch` - Request a rematch
- `accept-rematch` - Accept a rematch request
- `decline-rematch` - Decline a rematch request
- `leave-room` - Leave the current room

### Server to Client
- `room-created` - Room creation confirmation
- `room-joined` - Successfully joined a room
- `match-found` - Matched with an opponent
- `game-updated` - Game state changed
- `move-made` - A move was made
- `game-ended` - Game finished with results
- `rematch-requested` - Opponent requested rematch
- `rematch-accepted` - Rematch was accepted
- `rematch-declined` - Rematch was declined
- `player-left` - Opponent left the game
- `error` - Error message

## Database Schema

### Players Table
```sql
CREATE TABLE players (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    total_games INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Games Table
```sql
CREATE TABLE games (
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
);
```

## Game Rules

1. **Objective**: Get three of your symbols (X or O) in a row, column, or diagonal
2. **Turns**: Players alternate turns, with X always starting first
3. **Winning**: First player to get three in a row wins
4. **Draw**: If all 9 squares are filled with no winner, the game is a draw
5. **Rematch**: Players can request rematches, with symbols switching each game

## Development

### Project Structure
```
src/
├── auth/           # Telegram authentication
├── database/       # Database management
├── game/           # Game logic and management
├── types/          # TypeScript type definitions
└── server.ts       # Main server file
public/
├── index.html      # Game client HTML
└── app.js          # Game client JavaScript
```

### Code Quality

- **TypeScript Strict Mode**: All code uses strict TypeScript
- **ESLint**: Zero warnings policy
- **Test Coverage**: 80%+ test coverage required
- **Type Safety**: Complete type annotations
- **Error Handling**: Comprehensive error handling

### Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass and coverage is maintained
5. Run ESLint and fix any warnings
6. Submit a pull request

## Telegram Bot Setup

1. Create a new bot with [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Set up a WebApp with your bot:
   ```
   /newapp
   @your_bot_username
   App Name
   Description
   Photo
   https://your-domain.com
   ```
4. Configure the bot token in your environment variables

## Deployment

The application can be deployed to any Node.js hosting platform:

1. **Heroku**: Use the provided `package.json` scripts
2. **Railway**: Connect your GitHub repository
3. **DigitalOcean App Platform**: Deploy directly from GitHub
4. **VPS**: Use PM2 or similar process manager

Make sure to set the required environment variables in your deployment platform.

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues, please open a GitHub issue or contact the development team.