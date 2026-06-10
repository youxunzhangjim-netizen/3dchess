import { hasTranslation, t } from './i18n.js';

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
        this.statusKind = 'disconnected';
        this.statusKey = 'online.disconnected';
        this.statusParams = {};
    }

    createRoom() {
        this.close({ silent: true });
        this.clearRoomInfo();

        this.isHost = true;
        this.myColor = 'white';
        this.game.myColor = 'white';
        this.game.gameMode = 'online';
        this.setStatus('connecting', 'online.connectingRoom');
        this.game.setStatus('online.connectingRoom');

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
            this.setStatus('connecting', 'online.roomReadyConnection');
            this.game.setStatus('online.roomReadyGame');
            this.game.updateUI();
        });

        peer.on('connection', (conn) => {
            if (this.peer !== peer) return;
            this.acceptIncomingConnection(conn);
        });

        peer.on('disconnected', () => {
            if (this.peer !== peer || peer.destroyed) return;
            this.setStatus('connecting', 'online.reconnecting');
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
            alert(t('online.enterRoom'));
            return;
        }

        this.close({ silent: true });
        this.isHost = false;
        this.myColor = 'black';
        this.roomId = roomId;
        this.game.myColor = 'black';
        this.game.gameMode = 'online';
        this.setRoomInfo(roomId, this.buildShareUrl(roomId));
        this.setStatus('connecting', 'online.joiningRoom');
        this.game.setStatus('online.joiningAsBlack');

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
            this.startConnectionTimer('online.timeoutJoin');
        });

        peer.on('disconnected', () => {
            if (this.peer !== peer || peer.destroyed) return;
            this.setStatus('connecting', 'online.reconnecting');
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
        this.startConnectionTimer('online.timeoutAccept');
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
            this.setStatus('connected', this.isHost ? 'online.connectedWhite' : 'online.connectedBlack');
            this.game.setStatus(this.isHost ? 'online.blackJoined' : 'online.connectedBlackGame');
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
            this.setStatus('disconnected', 'online.opponentDisconnected');
            this.game.setStatus('online.opponentDisconnectedGame');
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
                    this.setStatus('disconnected', 'online.moveSyncFailed');
                    this.game.setStatus('online.moveSyncFailedGame');
                }
                break;
            }

            case 'newGame':
                this.game.resetGame({ keepOnline: true, remote: true });
                if (this.isHost) this.sendSync();
                break;

            case 'surrender':
                this.game.endGame('online.opponentSurrendered');
                break;

            case 'drawOffer':
                if (confirm(t('online.drawOfferPrompt'))) {
                    this.sendMessage({ type: 'drawAccepted' });
                    this.game.endGame('status.drawAgreed');
                } else {
                    this.sendMessage({ type: 'drawDeclined' });
                }
                break;

            case 'drawAccepted':
                this.game.endGame('status.drawAccepted');
                break;

            case 'drawDeclined':
                this.game.setStatus('online.drawDeclined');
                break;

            case 'roomFull':
                this.setStatus('disconnected', 'online.roomFull');
                this.game.setStatus('online.roomFullGame');
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
            const err = new Error('PeerJS unavailable');
            err.type = 'peer-missing';
            throw err;
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
            this.setStatus('disconnected', 'online.disconnected');
        }
    }

    startConnectionTimer(key, params = {}) {
        this.clearConnectionTimer();
        this.connectionTimer = window.setTimeout(() => {
            if (this.isConnected) return;
            this.setStatus('disconnected', key, params);
            this.game.setStatus(key, params);
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

    setStatus(kind, key, params = {}) {
        this.statusKind = kind;
        this.statusKey = key;
        this.statusParams = { ...params };
        this.renderStatus();
    }

    refreshStatus() {
        this.renderStatus();
    }

    renderStatus() {
        const el = document.getElementById('connectionStatus');
        if (!el) return;

        el.classList.remove('connected', 'connecting', 'disconnected');
        el.classList.add(this.statusKind);
        el.textContent = this.resolveText(this.statusKey, this.statusParams);
    }

    resolveText(key, params = {}) {
        return hasTranslation(key) ? t(key, params) : key;
    }

    handlePeerError(err) {
        this.clearConnectionTimer();
        const error = this.describePeerError(err);
        this.setStatus('disconnected', error.key, error.params);
        this.game.setStatus(error.key, error.params);
        this.game.updateUI();
    }

    describePeerError(err) {
        const type = err?.type || '';
        if (type === 'peer-unavailable') return { key: 'online.peerUnavailable', params: {} };
        if (type === 'network') return { key: 'online.networkError', params: {} };
        if (type === 'browser-incompatible') return { key: 'online.browserIncompatible', params: {} };
        if (type === 'ssl-unavailable') return { key: 'online.sslUnavailable', params: {} };
        if (type === 'server-error') return { key: 'online.serverError', params: {} };
        if (type === 'peer-missing') return { key: 'online.peerMissing', params: {} };
        return { key: 'online.connectionError', params: { detail: type || err?.message || 'unknown error' } };
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
