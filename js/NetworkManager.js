const CONNECTION_TIMEOUT_MS = 20000;
const PEER_OPTIONS = {
    debug: 1,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ]
    }
};

export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.connection = null;
        this.isConnected = false;
        this.myColor = null;
        this.isHost = false;
        this.roomId = '';
        this.connectionTimer = null;
    }

    createRoom() {
        this.close({ silent: true });
        this.clearRoomInfo();

        this.isHost = true;
        this.myColor = 'white';
        this.game.myColor = 'white';
        this.game.gameMode = 'online';
        this.setStatus('connecting', 'Creating online room...');
        this.game.setStatus('Creating online room...');

        let peer;
        try {
            peer = this.createPeer();
        } catch (err) {
            this.handlePeerError(err);
            return;
        }
        this.peer = peer;

        peer.on('open', (id) => {
            if (this.peer !== peer) return;
            this.roomId = id;
            this.setRoomInfo(id, this.buildShareUrl(id));
            this.setStatus('connecting', 'Room ready. Share the link with Black.');
            this.game.setStatus('Room ready. You are White. Waiting for Black to join.');
            this.game.updateUI();
        });

        peer.on('connection', (conn) => {
            if (this.peer !== peer) return;
            this.acceptIncomingConnection(conn);
        });

        peer.on('disconnected', () => {
            if (this.peer !== peer || peer.destroyed) return;
            this.setStatus('connecting', 'Reconnecting signaling...');
            peer.reconnect();
        });

        peer.on('error', (err) => {
            if (this.peer !== peer) return;
            this.handlePeerError(err);
        });
    }

    joinRoom(rawRoomId) {
        const roomId = this.extractRoomId(rawRoomId);
        if (!roomId) {
            alert('Enter a room ID or shared room link.');
            return;
        }

        this.close({ silent: true });
        this.isHost = false;
        this.myColor = 'black';
        this.roomId = roomId;
        this.game.myColor = 'black';
        this.game.gameMode = 'online';
        this.setRoomInfo(roomId, this.buildShareUrl(roomId));
        this.setStatus('connecting', 'Joining room...');
        this.game.setStatus('Joining online room as Black...');

        let peer;
        try {
            peer = this.createPeer();
        } catch (err) {
            this.handlePeerError(err);
            return;
        }
        this.peer = peer;

        peer.on('open', () => {
            if (this.peer !== peer) return;
            this.connection = peer.connect(roomId, {
                reliable: true,
                metadata: { game: '3dchess' }
            });
            this.setupConnection(this.connection);
            this.startConnectionTimer('Could not reach that room. Check that White still has the room open.');
        });

        peer.on('disconnected', () => {
            if (this.peer !== peer || peer.destroyed) return;
            this.setStatus('connecting', 'Reconnecting signaling...');
            peer.reconnect();
        });

        peer.on('error', (err) => {
            if (this.peer !== peer) return;
            this.handlePeerError(err);
        });
    }

    acceptIncomingConnection(conn) {
        if (this.connection) {
            conn.on('open', () => {
                conn.send({ type: 'roomFull' });
                conn.close();
            });
            return;
        }

        this.connection = conn;
        this.setupConnection(conn);
        this.startConnectionTimer('Opponent opened the room but did not finish connecting.');
    }

    setupConnection(conn) {
        if (!conn) return;

        conn.on('open', () => {
            if (this.connection !== conn) return;

            this.clearConnectionTimer();
            this.isConnected = true;
            this.game.gameMode = 'online';
            this.game.myColor = this.myColor;
            this.game.lockGameSettings();
            this.setRoomInfo(this.roomId, this.buildShareUrl(this.roomId));
            this.setStatus('connected', this.isHost ? 'Connected as White' : 'Connected as Black');
            this.game.setStatus(this.isHost ? 'Black joined. White to move.' : 'Connected. You are Black.');
            this.game.updateUI();

            if (this.isHost) {
                this.sendSync();
            } else {
                this.sendMessage({ type: 'ready' });
            }
        });

        conn.on('data', (data) => {
            this.handleRemoteMessage(data);
        });

        conn.on('close', () => {
            if (this.connection !== conn) return;
            this.connection = null;
            this.isConnected = false;
            this.clearConnectionTimer();
            this.setStatus('disconnected', 'Opponent disconnected');
            this.game.setStatus('Opponent disconnected. Create or join a new room to continue online.');
            this.game.updateUI();
        });

        conn.on('error', (err) => {
            if (this.connection !== conn) return;
            this.handlePeerError(err);
        });
    }

    sendMove(move) {
        this.sendMessage({
            type: 'move',
            move,
            timeRemaining: { ...this.game.timeRemaining }
        });
    }

    sendSync() {
        this.sendMessage({
            type: 'sync',
            state: this.createSyncState()
        });
    }

    sendMessage(data) {
        if (this.connection && this.isConnected) {
            this.connection.send(data);
        }
    }

    async handleRemoteMessage(data) {
        if (!data || typeof data !== 'object') return;

        switch (data.type) {
            case 'ready':
                if (this.isHost) this.sendSync();
                break;

            case 'sync':
                this.applySyncState(data.state || data);
                break;

            case 'move': {
                const moved = await this.game.applyMove(data.move, { remote: true });
                if (moved && data.timeRemaining) {
                    this.syncClocks(data.timeRemaining);
                }
                if (!moved) {
                    this.setStatus('disconnected', 'Move sync failed');
                    this.game.setStatus('Move sync failed. Start a new online room.');
                }
                break;
            }

            case 'newGame':
                this.game.resetGame({ keepOnline: true, remote: true });
                if (this.isHost) this.sendSync();
                break;

            case 'surrender':
                this.game.endGame('Opponent surrendered. You win.');
                break;

            case 'drawOffer':
                if (confirm('Opponent offers a draw. Accept?')) {
                    this.sendMessage({ type: 'drawAccepted' });
                    this.game.endGame('Game drawn by agreement.');
                } else {
                    this.sendMessage({ type: 'drawDeclined' });
                }
                break;

            case 'drawAccepted':
                this.game.endGame('Draw accepted.');
                break;

            case 'drawDeclined':
                this.game.setStatus('Draw offer declined.');
                break;

            case 'roomFull':
                this.setStatus('disconnected', 'Room already has two players');
                this.game.setStatus('That room already has two players.');
                this.close({ silent: true });
                this.clearRoomInfo();
                break;

            default:
                break;
        }
    }

    createSyncState() {
        return {
            version: 1,
            board: this.cloneBoard(this.game.board),
            currentPlayer: this.game.currentPlayer,
            boundaryCondition: this.game.boundaryCondition,
            timerEnabled: this.game.timerEnabled,
            timeLimit: this.game.timeLimit,
            timeRemaining: { ...this.game.timeRemaining },
            gameStarted: this.game.gameStarted,
            gameOver: this.game.gameOver,
            moveHistory: [...this.game.moveHistory],
            capturedPieces: {
                white: [...this.game.capturedPieces.white],
                black: [...this.game.capturedPieces.black]
            }
        };
    }

    applySyncState(state) {
        if (!state || typeof state !== 'object') return;

        if (Array.isArray(state.board)) {
            this.game.board = this.cloneBoard(state.board);
        }

        this.game.currentPlayer = state.currentPlayer === 'black' ? 'black' : 'white';
        this.game.boundaryCondition = ['forbidden', 'reflection', 'periodic'].includes(state.boundaryCondition)
            ? state.boundaryCondition
            : 'forbidden';
        this.game.timerEnabled = Boolean(state.timerEnabled);
        this.game.timeLimit = Number(state.timeLimit) || 0;
        this.syncClocks(state.timeRemaining || { white: this.game.timeLimit, black: this.game.timeLimit });
        this.game.gameStarted = Boolean(state.gameStarted);
        this.game.gameOver = Boolean(state.gameOver);
        this.game.moveHistory = Array.isArray(state.moveHistory) ? [...state.moveHistory] : [];
        this.game.capturedPieces = {
            white: Array.isArray(state.capturedPieces?.white) ? [...state.capturedPieces.white] : [],
            black: Array.isArray(state.capturedPieces?.black) ? [...state.capturedPieces.black] : []
        };
        this.game.selectedSquare = null;
        this.game.legalMoves = [];
        this.game.pendingMoveTarget = null;

        if (this.game.timerInterval) {
            clearInterval(this.game.timerInterval);
            this.game.timerInterval = null;
        }
        if (this.game.gameStarted && this.game.timerEnabled && !this.game.gameOver) {
            this.game.startTimer();
        }

        this.game.renderer.renderPieces3D(this.game.board);
        this.game.renderer.clearHighlights();
        this.game.lockGameSettings();
        this.game.updateBoundaryInfo();
        this.game.updateTimerDisplay();
        this.game.updateUI();
    }

    syncClocks(timeRemaining) {
        const white = Number(timeRemaining?.white);
        const black = Number(timeRemaining?.black);
        this.game.timeRemaining = {
            white: Number.isFinite(white) ? white : this.game.timeLimit,
            black: Number.isFinite(black) ? black : this.game.timeLimit
        };
        this.game.updateTimerDisplay();
    }

    cloneBoard(board) {
        return board.map((layer) =>
            layer.map((row) =>
                row.map((piece) => this.clonePiece(piece))
            )
        );
    }

    clonePiece(piece) {
        if (!piece) return null;
        const type = ['K', 'Q', 'R', 'B', 'N', 'P'].includes(piece.type) ? piece.type : 'P';
        const color = piece.color === 'black' ? 'black' : 'white';
        return {
            color,
            type,
            display: color === 'white' ? type : type.toLowerCase(),
            hasMoved: Boolean(piece.hasMoved)
        };
    }

    createPeer() {
        if (!window.Peer) {
            throw new Error('PeerJS did not load. Check your internet connection and reload the page.');
        }
        return new window.Peer(undefined, PEER_OPTIONS);
    }

    close({ silent = false } = {}) {
        this.clearConnectionTimer();

        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }

        if (this.peer && !this.peer.destroyed) {
            this.peer.destroy();
        }

        this.peer = null;
        this.isConnected = false;
        this.myColor = null;
        this.roomId = '';

        if (!silent) {
            this.clearRoomInfo();
            this.setStatus('disconnected', 'Disconnected');
        }
    }

    startConnectionTimer(message) {
        this.clearConnectionTimer();
        this.connectionTimer = window.setTimeout(() => {
            if (this.isConnected) return;
            this.setStatus('disconnected', message);
            this.game.setStatus(message);
        }, CONNECTION_TIMEOUT_MS);
    }

    clearConnectionTimer() {
        if (!this.connectionTimer) return;
        window.clearTimeout(this.connectionTimer);
        this.connectionTimer = null;
    }

    buildShareUrl(roomId) {
        const url = new URL(window.location.href);
        url.searchParams.set('room', roomId);
        url.hash = '';
        return url.toString();
    }

    setRoomInfo(roomId, shareUrl) {
        const roomInfo = document.getElementById('roomInfo');
        const roomIdDisplay = document.getElementById('roomIdDisplay');
        const shareInput = document.getElementById('shareLinkInput');

        if (roomInfo) roomInfo.hidden = !roomId;
        if (roomIdDisplay) roomIdDisplay.textContent = roomId || '';
        if (shareInput) shareInput.value = shareUrl || '';
    }

    clearRoomInfo() {
        this.setRoomInfo('', '');
    }

    setStatus(kind, text) {
        const el = document.getElementById('connectionStatus');
        if (!el) return;

        el.classList.remove('connected', 'connecting', 'disconnected');
        el.classList.add(kind);
        el.textContent = text;
    }

    handlePeerError(err) {
        this.clearConnectionTimer();
        const text = this.describePeerError(err);
        this.setStatus('disconnected', text);
        this.game.setStatus(text);
        this.game.updateUI();
    }

    describePeerError(err) {
        const type = err?.type || '';
        if (type === 'peer-unavailable') return 'Room not found. Ask White to create a new room link.';
        if (type === 'network') return 'Network error. Check internet connection and try again.';
        if (type === 'browser-incompatible') return 'This browser cannot use WebRTC online play.';
        if (type === 'ssl-unavailable') return 'Online play needs HTTPS. Use the GitHub Pages link.';
        if (type === 'server-error') return 'Peer server error. Try creating a new room.';
        return `Connection error: ${type || err?.message || 'unknown error'}`;
    }

    extractRoomId(value) {
        const text = String(value || '').trim();
        if (!text) return '';

        try {
            const url = new URL(text, window.location.href);
            const hashParams = new URLSearchParams(url.hash.replace(/^#\/?\??/, ''));
            return url.searchParams.get('room') || hashParams.get('room') || text.replace(/^room=/i, '');
        } catch {
            return text.replace(/^room=/i, '');
        }
    }
}
