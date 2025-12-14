/**
 * Telegram WebApp Tic-Tac-Toe Client
 */

class TicTacToeClient {
    constructor() {
        this.socket = null;
        this.currentGame = null;
        this.currentRoom = null;
        this.user = null;
        this.mySymbol = null;
        
        this.initializeTelegramWebApp();
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeTelegramWebApp() {
        // Check if running in Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            
            // Expand to full height
            tg.expand();
            
            // Apply theme
            this.applyTelegramTheme(tg);
            
            // Get user data
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                this.user = tg.initDataUnsafe.user;
                this.updateUserInfo();
            }
            
            // Connect to server with auth data
            this.connectToServer(tg.initData);
        } else {
            // Development mode - use mock data
            this.user = {
                id: Math.floor(Math.random() * 1000000),
                first_name: 'Test User',
                username: 'testuser'
            };
            this.updateUserInfo();
            this.connectToServer('mock_data');
        }
    }

    applyTelegramTheme(tg) {
        const root = document.documentElement;
        
        if (tg.themeParams) {
            const theme = tg.themeParams;
            
            if (theme.bg_color) root.style.setProperty('--tg-theme-bg-color', theme.bg_color);
            if (theme.text_color) root.style.setProperty('--tg-theme-text-color', theme.text_color);
            if (theme.button_color) root.style.setProperty('--tg-theme-button-color', theme.button_color);
            if (theme.button_text_color) root.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
            if (theme.secondary_bg_color) root.style.setProperty('--tg-theme-secondary-bg-color', theme.secondary_bg_color);
        }
    }

    initializeElements() {
        // Menu elements
        this.menuEl = document.getElementById('menu');
        this.gameEl = document.getElementById('game');
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.findMatchBtn = document.getElementById('findMatchBtn');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        this.joinRoomInput = document.getElementById('joinRoomInput');
        this.roomIdInput = document.getElementById('roomIdInput');
        this.joinBtn = document.getElementById('joinBtn');
        
        // Game elements
        this.gameBoard = document.getElementById('gameBoard');
        this.statusEl = document.getElementById('status');
        this.roomInfoEl = document.getElementById('roomInfo');
        this.playersInfoEl = document.getElementById('playersInfo');
        this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
        this.rematchBtn = document.getElementById('rematchBtn');
        
        // Stats elements
        this.winsCount = document.getElementById('winsCount');
        this.lossesCount = document.getElementById('lossesCount');
        this.drawsCount = document.getElementById('drawsCount');
        this.totalCount = document.getElementById('totalCount');
        
        // Other elements
        this.messagesEl = document.getElementById('messages');
        this.userInfoEl = document.getElementById('userInfo');
        
        // Board cells
        this.cells = document.querySelectorAll('.cell');
    }

    attachEventListeners() {
        // Menu buttons
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.findMatchBtn.addEventListener('click', () => this.findMatch());
        this.joinRoomBtn.addEventListener('click', () => this.toggleJoinRoomInput());
        this.joinBtn.addEventListener('click', () => this.joinRoom());
        
        // Game buttons
        this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        this.rematchBtn.addEventListener('click', () => this.requestRematch());
        
        // Board cells
        this.cells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                const row = parseInt(e.target.dataset.row);
                const col = parseInt(e.target.dataset.col);
                this.makeMove(row, col);
            });
        });
        
        // Enter key for room ID input
        this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });
    }

    connectToServer(initData) {
        const socket = io({
            auth: {
                initData: initData
            }
        });
        
        this.socket = socket;
        
        // Connection events
        socket.on('connect', () => {
            console.log('Connected to server');
            this.showMessage('Connected to server', 'success');
            this.loadPlayerStats();
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.showMessage('Disconnected from server', 'error');
        });
        
        socket.on('connect_error', (error) => {
            console.error('Connection error:', error.message);
            this.showMessage(`Connection error: ${error.message}`, 'error');
        });
        
        // Game events
        socket.on('room-created', (roomId) => {
            this.showMessage(`Room created: ${roomId}`, 'success');
        });
        
        socket.on('room-joined', (room) => {
            this.currentRoom = room;
            this.currentGame = room.game;
            this.showGame();
            this.updateGameDisplay();
        });
        
        socket.on('match-found', (room) => {
            this.currentRoom = room;
            this.currentGame = room.game;
            this.showGame();
            this.updateGameDisplay();
            this.showMessage('Match found!', 'success');
        });
        
        socket.on('game-updated', (game) => {
            this.currentGame = game;
            this.updateGameDisplay();
        });
        
        socket.on('move-made', (game) => {
            this.currentGame = game;
            this.updateGameDisplay();
        });
        
        socket.on('game-ended', (game, stats) => {
            this.currentGame = game;
            this.updateGameDisplay();
            this.showGameResult();
            
            if (stats && stats.length > 0) {
                const myStats = stats.find(s => s.telegramId === this.user.id);
                if (myStats) {
                    this.updateStatsDisplay(myStats);
                }
            }
        });
        
        socket.on('rematch-requested', (playerId) => {
            this.showMessage('Opponent requested a rematch', 'success');
            this.showRematchButtons();
        });
        
        socket.on('rematch-accepted', (room) => {
            this.currentRoom = room;
            this.currentGame = room.game;
            this.updateGameDisplay();
            this.showMessage('Rematch started!', 'success');
            this.hideRematchButtons();
        });
        
        socket.on('rematch-declined', () => {
            this.showMessage('Opponent declined rematch', 'error');
        });
        
        socket.on('player-left', (playerId) => {
            this.showMessage('Opponent left the game', 'error');
            this.showMenu();
        });
        
        socket.on('error', (message) => {
            this.showMessage(message, 'error');
        });
    }

    updateUserInfo() {
        if (this.user) {
            const name = this.user.username || this.user.first_name;
            this.userInfoEl.innerHTML = `
                <div>👤 ${name}</div>
                <div>ID: ${this.user.id}</div>
            `;
        }
    }

    async loadPlayerStats() {
        if (!this.user) return;
        
        try {
            const response = await fetch(`/api/stats/${this.user.id}`);
            const stats = await response.json();
            this.updateStatsDisplay(stats);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    updateStatsDisplay(stats) {
        if (stats) {
            this.winsCount.textContent = stats.wins;
            this.lossesCount.textContent = stats.losses;
            this.drawsCount.textContent = stats.draws;
            this.totalCount.textContent = stats.totalGames;
        }
    }

    createRoom() {
        if (this.socket) {
            this.socket.emit('create-room');
        }
    }

    findMatch() {
        if (this.socket) {
            this.socket.emit('find-match');
            this.showMessage('Looking for opponent...', 'success');
        }
    }

    toggleJoinRoomInput() {
        this.joinRoomInput.classList.toggle('hidden');
        if (!this.joinRoomInput.classList.contains('hidden')) {
            this.roomIdInput.focus();
        }
    }

    joinRoom() {
        const roomId = this.roomIdInput.value.trim();
        if (roomId && this.socket) {
            this.socket.emit('join-room', roomId);
            this.roomIdInput.value = '';
            this.joinRoomInput.classList.add('hidden');
        }
    }

    makeMove(row, col) {
        if (this.socket && this.currentGame && this.canMakeMove()) {
            this.socket.emit('make-move', row, col);
        }
    }

    canMakeMove() {
        if (!this.currentGame || this.currentGame.status !== 'playing') {
            return false;
        }
        
        const myPlayer = this.currentGame.players.find(p => p.telegramId === this.user.id);
        return myPlayer && myPlayer.symbol === this.currentGame.currentPlayer;
    }

    requestRematch() {
        if (this.socket) {
            this.socket.emit('request-rematch');
            this.showMessage('Rematch requested', 'success');
        }
    }

    acceptRematch() {
        if (this.socket) {
            this.socket.emit('accept-rematch');
        }
    }

    declineRematch() {
        if (this.socket) {
            this.socket.emit('decline-rematch');
        }
    }

    leaveRoom() {
        if (this.socket) {
            this.socket.emit('leave-room');
            this.showMenu();
        }
    }

    showMenu() {
        this.menuEl.classList.remove('hidden');
        this.gameEl.classList.add('hidden');
        this.currentRoom = null;
        this.currentGame = null;
    }

    showGame() {
        this.menuEl.classList.add('hidden');
        this.gameEl.classList.remove('hidden');
    }

    updateGameDisplay() {
        if (!this.currentGame || !this.currentRoom) return;
        
        // Update room info
        this.roomInfoEl.textContent = `Room: ${this.currentRoom.id}`;
        
        // Update players info
        this.updatePlayersInfo();
        
        // Update board
        this.updateBoard();
        
        // Update status
        this.updateStatus();
        
        // Update buttons
        this.updateButtons();
    }

    updatePlayersInfo() {
        const players = this.currentGame.players;
        const player1El = document.getElementById('player1Name');
        const player1SymbolEl = document.getElementById('player1Symbol');
        const player2El = document.getElementById('player2Name');
        const player2SymbolEl = document.getElementById('player2Symbol');
        
        if (players[0]) {
            player1El.textContent = players[0].username;
            player1SymbolEl.textContent = players[0].symbol;
            
            if (this.currentGame.currentPlayer === players[0].symbol) {
                player1El.classList.add('current-player');
            } else {
                player1El.classList.remove('current-player');
            }
        }
        
        if (players[1]) {
            player2El.textContent = players[1].username;
            player2SymbolEl.textContent = players[1].symbol;
            
            if (this.currentGame.currentPlayer === players[1].symbol) {
                player2El.classList.add('current-player');
            } else {
                player2El.classList.remove('current-player');
            }
        } else {
            player2El.textContent = 'Waiting...';
            player2SymbolEl.textContent = '';
        }
        
        // Set my symbol
        const myPlayer = players.find(p => p.telegramId === this.user.id);
        this.mySymbol = myPlayer ? myPlayer.symbol : null;
    }

    updateBoard() {
        const board = this.currentGame.board;
        
        this.cells.forEach(cell => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            const value = board[row][col];
            
            cell.textContent = value || '';
            
            // Disable cells that are occupied or if game is not active
            const canMove = this.canMakeMove() && !value;
            cell.disabled = !canMove;
        });
    }

    updateStatus() {
        let status = '';
        
        switch (this.currentGame.status) {
            case 'waiting':
                status = 'Waiting for opponent...';
                break;
            case 'playing':
                if (this.canMakeMove()) {
                    status = `Your turn (${this.mySymbol})`;
                } else {
                    const currentPlayerName = this.currentGame.players
                        .find(p => p.symbol === this.currentGame.currentPlayer)?.username || 'Opponent';
                    status = `${currentPlayerName}'s turn (${this.currentGame.currentPlayer})`;
                }
                break;
            case 'finished':
                if (this.currentGame.result === 'draw') {
                    status = "It's a draw!";
                } else {
                    const winner = this.currentGame.players
                        .find(p => p.symbol === this.currentGame.result);
                    if (winner && winner.telegramId === this.user.id) {
                        status = '🎉 You won!';
                    } else {
                        status = '😔 You lost!';
                    }
                }
                break;
        }
        
        this.statusEl.textContent = status;
    }

    updateButtons() {
        if (this.currentGame.status === 'finished') {
            this.rematchBtn.classList.remove('hidden');
        } else {
            this.rematchBtn.classList.add('hidden');
        }
    }

    showGameResult() {
        // Add some visual feedback for game end
        if (this.currentGame.result === 'draw') {
            this.showMessage("Game ended in a draw!", 'success');
        } else {
            const winner = this.currentGame.players
                .find(p => p.symbol === this.currentGame.result);
            if (winner && winner.telegramId === this.user.id) {
                this.showMessage('🎉 Congratulations! You won!', 'success');
            } else {
                this.showMessage('😔 You lost! Better luck next time!', 'error');
            }
        }
    }

    showRematchButtons() {
        // Create temporary buttons for rematch response
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'buttons';
        buttonsDiv.id = 'rematchButtons';
        
        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'btn';
        acceptBtn.textContent = 'Accept Rematch';
        acceptBtn.onclick = () => {
            this.acceptRematch();
            this.hideRematchButtons();
        };
        
        const declineBtn = document.createElement('button');
        declineBtn.className = 'btn';
        declineBtn.textContent = 'Decline Rematch';
        declineBtn.onclick = () => {
            this.declineRematch();
            this.hideRematchButtons();
        };
        
        buttonsDiv.appendChild(acceptBtn);
        buttonsDiv.appendChild(declineBtn);
        
        const existingButtons = document.getElementById('rematchButtons');
        if (existingButtons) {
            existingButtons.remove();
        }
        
        this.gameEl.appendChild(buttonsDiv);
    }

    hideRematchButtons() {
        const buttonsDiv = document.getElementById('rematchButtons');
        if (buttonsDiv) {
            buttonsDiv.remove();
        }
    }

    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = type;
        messageEl.textContent = message;
        
        this.messagesEl.appendChild(messageEl);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 5000);
        
        // Scroll to bottom
        messageEl.scrollIntoView({ behavior: 'smooth' });
    }
}

// Initialize the client when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TicTacToeClient();
});