import { ThreeJSRenderer } from './ThreeJSRenderer.js';
import { NetworkManager } from './NetworkManager.js';

const SIZE = 8;
const MAIN_ROW = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
const PROMOTION_TYPES = ['Q', 'R', 'B', 'N'];
const PIECE_NAMES = {
    K: 'King',
    Q: 'Queen',
    R: 'Rook',
    B: 'Bishop',
    N: 'Knight',
    P: 'Pawn'
};
const PIECE_ICONS = {
    white: { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: 'P' },
    black: { K: 'k', Q: 'q', R: 'r', B: 'b', N: 'n', P: 'p' }
};

export class ChessGame {
    constructor() {
        this.board = this.createEmptyBoard();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.currentPlayer = 'white';
        this.moveHistory = [];
        this.boundaryCondition = 'forbidden';
        this.gameOver = false;
        this.showMoveHints = true;
        this.capturedPieces = { white: [], black: [] };
        this.timerEnabled = true;
        this.timeLimit = 300;
        this.timeRemaining = { white: 300, black: 300 };
        this.timerInterval = null;
        this.gameStarted = false;
        this.gameMode = 'local';
        this.myColor = null;
        this.promotionResolver = null;
        this.pendingMoveTarget = null;

        this.renderer = new ThreeJSRenderer(this);
        this.network = new NetworkManager(this);

        this.init();
    }

    init() {
        this.renderer.init3D();
        this.setupBoard3D();
        this.attachEventListeners();
        this.updateBoundaryInfo();
        this.updateTimerDisplay();
        this.updateUI();
        this.animate();

        const sharedRoom = new URLSearchParams(window.location.search).get('room');
        if (sharedRoom) {
            this.gameMode = 'online';
            document.getElementById('gameModeSelect').value = 'online';
            document.getElementById('onlineControls').classList.add('active');
            document.getElementById('roomIdInput').value = sharedRoom;
            this.network.setStatus('connecting', 'Joining shared room...');
            this.setStatus('Joining shared online room...');
            window.setTimeout(() => this.network.joinRoom(sharedRoom), 150);
            this.updateUI();
        }
    }

    createEmptyBoard() {
        return Array.from({ length: SIZE }, () =>
            Array.from({ length: SIZE }, () =>
                Array.from({ length: SIZE }, () => null)
            )
        );
    }

    setupBoard3D() {
        this.board = this.createEmptyBoard();

        for (let x = 0; x < SIZE; x++) {
            this.placePiece(x, 0, 0, 'white', MAIN_ROW[x]);
            this.placePiece(x, 1, 0, 'white', 'P');
            this.placePiece(x, 0, 1, 'white', 'P');
            this.placePiece(x, 1, 1, 'white', 'P');

            this.placePiece(x, 7, 7, 'black', MAIN_ROW[x]);
            this.placePiece(x, 6, 7, 'black', 'P');
            this.placePiece(x, 7, 6, 'black', 'P');
            this.placePiece(x, 6, 6, 'black', 'P');
        }

        this.renderer.renderPieces3D(this.board);
    }

    placePiece(x, y, z, color, type) {
        this.board[z][y][x] = {
            color,
            type,
            display: color === 'white' ? type : type.toLowerCase(),
            hasMoved: false
        };
    }

    animate = () => {
        requestAnimationFrame(this.animate);
        this.renderer.animate();
    };

    async handleSquareClick(x, y, z) {
        if (this.gameOver) return;

        if (this.gameMode === 'online') {
            if (!this.network.isConnected) {
                this.setStatus('Connect to an opponent before moving online.');
                return;
            }
            if (this.myColor !== this.currentPlayer) {
                this.setStatus(`Waiting for ${this.currentPlayer} to move.`);
                return;
            }
        }

        const piece = this.getPiece(x, y, z);

        if (this.selectedSquare) {
            const legalMove = this.legalMoves.find((move) => move.x === x && move.y === y && move.z === z);
            if (legalMove) {
                if (this.pendingMoveTarget && this.sameCoord(this.pendingMoveTarget, legalMove)) {
                    const from = { ...this.selectedSquare };
                    this.clearSelection();
                    await this.applyMove({ from, to: { x, y, z } });
                    return;
                }

                this.setPendingMoveTarget(legalMove);
                return;
            }

            if (piece && piece.color === this.currentPlayer) {
                this.selectSquare(x, y, z);
                return;
            }

            this.clearSelection();
            this.setStatus('Selection cleared.');
            return;
        }

        if (!piece) {
            this.setStatus('Choose one of your pieces first.');
            return;
        }

        if (piece.color !== this.currentPlayer) {
            this.setStatus(`It is ${this.currentPlayer}'s turn.`);
            return;
        }

        this.selectSquare(x, y, z);
    }

    selectSquare(x, y, z) {
        const piece = this.getPiece(x, y, z);
        if (!piece || piece.color !== this.currentPlayer) return;

        this.pendingMoveTarget = null;
        this.selectedSquare = { x, y, z };
        this.legalMoves = this.getLegalMoves(x, y, z);

        this.renderer.clearHighlights();
        this.renderer.showSelected(x, y, z);
        this.renderer.showLegalMoves(this.legalMoves);

        const moveCount = this.legalMoves.length;
        this.setStatus(`${this.capitalize(piece.color)} ${this.pieceName(piece)} selected at ${this.formatCoord({ x, y, z })}. ${moveCount} legal move${moveCount === 1 ? '' : 's'}.`);
        this.renderMovePicker();
    }

    clearSelection() {
        this.selectedSquare = null;
        this.legalMoves = [];
        this.pendingMoveTarget = null;
        this.renderer.clearHighlights();
        this.renderMovePicker();
    }

    setPendingMoveTarget(move) {
        this.pendingMoveTarget = { x: move.x, y: move.y, z: move.z };
        this.renderer.clearChosenMove();
        this.renderer.showChosenMove(move.x, move.y, move.z);
        this.renderMovePicker();
        this.setStatus(`${this.formatCoord(move)} selected. Click the same yellow destination again to move.`);
    }

    async applyMove(move, options = {}) {
        const from = move.from;
        const to = move.to;
        const piece = this.getPiece(from.x, from.y, from.z);
        if (!piece || piece.color !== this.currentPlayer) return false;

        const legalMoves = this.getLegalMoves(from.x, from.y, from.z);
        const legalMove = legalMoves.find((item) => item.x === to.x && item.y === to.y && item.z === to.z);
        if (!legalMove) return false;

        const movedType = piece.type;
        const castling = legalMove.castling || null;
        let promotion = move.promotion || null;
        if (piece.type === 'P' && this.isPromotionSquare(piece.color, to.x, to.y, to.z)) {
            promotion = promotion || await this.choosePromotion(piece.color);
        }

        this.startGameIfNeeded();

        const captured = this.getPiece(to.x, to.y, to.z);
        this.board[to.z][to.y][to.x] = piece;
        this.board[from.z][from.y][from.x] = null;
        piece.hasMoved = true;

        if (castling) {
            const rook = this.getPiece(castling.rookFrom.x, castling.rookFrom.y, castling.rookFrom.z);
            this.board[castling.rookTo.z][castling.rookTo.y][castling.rookTo.x] = rook;
            this.board[castling.rookFrom.z][castling.rookFrom.y][castling.rookFrom.x] = null;
            if (rook) rook.hasMoved = true;
        }

        if (promotion && PROMOTION_TYPES.includes(promotion)) {
            piece.type = promotion;
            piece.display = piece.color === 'white' ? promotion : promotion.toLowerCase();
        }

        if (captured) {
            this.capturedPieces[piece.color].push(this.pieceIcon(captured));
        }

        const historyEntry = this.createMoveNotation(piece, from, to, captured, promotion, movedType, castling);
        this.moveHistory.push(historyEntry);

        const sentMove = {
            from,
            to,
            promotion,
            castling: castling ? castling.side : null
        };

        this.currentPlayer = this.opponentOf(this.currentPlayer);
        this.pendingMoveTarget = null;
        this.renderer.renderPieces3D(this.board);
        this.renderer.clearHighlights();
        this.updateUI();
        this.checkGameEnd();

        if (!options.remote && this.gameMode === 'online' && this.network.isConnected) {
            this.network.sendMove(sentMove);
        }

        return true;
    }

    startGameIfNeeded() {
        if (this.gameStarted) return;
        this.gameStarted = true;
        this.lockGameSettings();
        if (this.timerEnabled) this.startTimer();
    }

    lockGameSettings() {
        for (const id of ['boundarySelect', 'timerSelect', 'gameModeSelect']) {
            const el = document.getElementById(id);
            if (el) el.disabled = true;
        }
    }

    unlockGameSettings() {
        const canUnlock = this.gameMode !== 'online' && !this.network.isConnected;
        for (const id of ['boundarySelect', 'timerSelect', 'gameModeSelect']) {
            const el = document.getElementById(id);
            if (el) el.disabled = !canUnlock;
        }
    }

    getLegalMoves(x, y, z) {
        const piece = this.getPiece(x, y, z);
        if (!piece) return [];

        const moves = this.getPseudoMoves(x, y, z, { forAttack: false });
        if (piece.type === 'K') {
            moves.push(...this.getCastlingMoves3D(x, y, z));
        }

        return this.uniqueMoves(moves).filter((move) =>
            !this.wouldLeaveKingInCheck(x, y, z, move.x, move.y, move.z, move.castling)
        );
    }

    getCastlingMoves3D(x, y, z) {
        const king = this.getPiece(x, y, z);
        if (!king || king.type !== 'K' || king.hasMoved) return [];

        const home = this.getCastlingHome(king.color);
        if (!home || x !== home.king.x || y !== home.king.y || z !== home.king.z) return [];
        if (this.isInCheck(king.color)) return [];

        const moves = [];
        for (const option of home.options) {
            const rook = this.getPiece(option.rookFrom.x, option.rookFrom.y, option.rookFrom.z);
            if (!rook || rook.color !== king.color || rook.type !== 'R' || rook.hasMoved) continue;
            if (!this.isCastlingPathClear(home.king, option.rookFrom)) continue;
            if (!this.isCastlingKingPathSafe(king.color, option.kingPath)) continue;

            moves.push({
                ...option.kingTo,
                capture: false,
                castling: {
                    side: option.side,
                    rookFrom: option.rookFrom,
                    rookTo: option.rookTo
                }
            });
        }

        return moves;
    }

    getCastlingHome(color) {
        const y = color === 'white' ? 0 : 7;
        const z = color === 'white' ? 0 : 7;
        const king = { x: 4, y, z };

        return {
            king,
            options: [
                {
                    side: 'queenside',
                    rookFrom: { x: 0, y, z },
                    rookTo: { x: 3, y, z },
                    kingTo: { x: 2, y, z },
                    kingPath: [{ x: 3, y, z }, { x: 2, y, z }]
                },
                {
                    side: 'kingside',
                    rookFrom: { x: 7, y, z },
                    rookTo: { x: 5, y, z },
                    kingTo: { x: 6, y, z },
                    kingPath: [{ x: 5, y, z }, { x: 6, y, z }]
                }
            ]
        };
    }

    isCastlingPathClear(kingFrom, rookFrom) {
        const step = rookFrom.x > kingFrom.x ? 1 : -1;
        for (let x = kingFrom.x + step; x !== rookFrom.x; x += step) {
            if (this.getPiece(x, kingFrom.y, kingFrom.z)) return false;
        }
        return true;
    }

    isCastlingKingPathSafe(color, kingPath) {
        const enemy = this.opponentOf(color);
        return kingPath.every((square) => !this.isSquareAttacked(square.x, square.y, square.z, enemy));
    }

    getPseudoMoves(x, y, z, { forAttack = false } = {}) {
        const piece = this.getPiece(x, y, z);
        if (!piece) return [];

        switch (piece.type) {
            case 'P':
                return this.getPawnMoves3D(x, y, z, forAttack);
            case 'R':
                return this.getLineMoves3D(x, y, z, this.getRookDirections(), forAttack);
            case 'B':
                return this.getLineMoves3D(x, y, z, this.getBishopDirections(), forAttack);
            case 'Q':
                return this.getLineMoves3D(x, y, z, [...this.getRookDirections(), ...this.getBishopDirections()], forAttack);
            case 'N':
                return this.getKnightMoves3D(x, y, z, forAttack);
            case 'K':
                return this.getKingMoves3D(x, y, z, forAttack);
            default:
                return [];
        }
    }

    getPawnMoves3D(x, y, z, forAttack) {
        const piece = this.getPiece(x, y, z);
        const dir = piece.color === 'white' ? 1 : -1;
        const moves = [];
        const forwardAxes = [
            [dir, 0, 0],
            [0, dir, 0],
            [0, 0, dir]
        ];

        if (!forAttack) {
            for (const [dx, dy, dz] of forwardAxes) {
                const one = this.resolveTarget(x + dx, y + dy, z + dz);
                if (one && !this.getPiece(one.x, one.y, one.z)) {
                    moves.push({ ...one, capture: false });

                    const two = this.resolveTarget(x + dx * 2, y + dy * 2, z + dz * 2);
                    if (!piece.hasMoved && two && !this.sameCoord({ x, y, z }, two) && !this.getPiece(two.x, two.y, two.z)) {
                        moves.push({ ...two, capture: false });
                    }
                }
            }
        }

        for (const [dx, dy, dz] of this.getPawnCaptureVectors(dir)) {
            const target = this.resolveTarget(x + dx, y + dy, z + dz);
            if (!target) continue;

            if (forAttack) {
                moves.push({ ...target, capture: true });
                continue;
            }

            const targetPiece = this.getPiece(target.x, target.y, target.z);
            if (targetPiece && targetPiece.color !== piece.color && targetPiece.type !== 'K') {
                moves.push({ ...target, capture: true });
            }
        }

        return this.uniqueMoves(moves);
    }

    getPawnCaptureVectors(dir) {
        const vectors = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const activeAxes = [dx, dy, dz].filter((value) => value !== 0).length;
                    const progressesTowardEnemy = [dx, dy, dz].some((value) => value === dir);
                    if (activeAxes >= 2 && progressesTowardEnemy) {
                        vectors.push([dx, dy, dz]);
                    }
                }
            }
        }

        return vectors;
    }

    getRookDirections() {
        return [
            [1, 0, 0], [-1, 0, 0],
            [0, 1, 0], [0, -1, 0],
            [0, 0, 1], [0, 0, -1]
        ];
    }

    getBishopDirections() {
        const dirs = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const active = [dx, dy, dz].filter((value) => value !== 0).length;
                    if (active >= 2) dirs.push([dx, dy, dz]);
                }
            }
        }
        return dirs;
    }

    getLineMoves3D(x, y, z, directions, forAttack) {
        const piece = this.getPiece(x, y, z);
        const moves = [];

        for (const direction of directions) {
            let [dx, dy, dz] = direction;
            let cx = x;
            let cy = y;
            let cz = z;
            const seenStates = new Set();

            for (let steps = 0; steps < SIZE * 2; steps++) {
                const next = this.nextLineStep(cx, cy, cz, dx, dy, dz);
                if (!next) break;

                cx = next.x;
                cy = next.y;
                cz = next.z;
                dx = next.dx;
                dy = next.dy;
                dz = next.dz;

                const stateKey = `${cx},${cy},${cz},${dx},${dy},${dz}`;
                if (seenStates.has(stateKey) || (cx === x && cy === y && cz === z)) break;
                seenStates.add(stateKey);

                const target = this.getPiece(cx, cy, cz);
                if (!target) {
                    moves.push({ x: cx, y: cy, z: cz, capture: false });
                    continue;
                }

                if (target.color !== piece.color) {
                    if (forAttack || target.type !== 'K') {
                        moves.push({ x: cx, y: cy, z: cz, capture: true });
                    }
                }
                break;
            }
        }

        return moves;
    }

    getKnightMoves3D(x, y, z, forAttack) {
        const piece = this.getPiece(x, y, z);
        const moves = [];
        const offsets = new Set();
        const values = [-2, -1, 0, 1, 2];

        for (const dx of values) {
            for (const dy of values) {
                for (const dz of values) {
                    const sorted = [Math.abs(dx), Math.abs(dy), Math.abs(dz)].sort((a, b) => b - a).join(',');
                    if (sorted === '2,1,0') offsets.add(`${dx},${dy},${dz}`);
                }
            }
        }

        for (const offset of offsets) {
            const [dx, dy, dz] = offset.split(',').map(Number);
            const target = this.resolveTarget(x + dx, y + dy, z + dz);
            if (!target || this.sameCoord({ x, y, z }, target)) continue;
            this.addLeaperMove(moves, target, piece, forAttack);
        }

        return this.uniqueMoves(moves);
    }

    getKingMoves3D(x, y, z, forAttack) {
        const piece = this.getPiece(x, y, z);
        const moves = [];

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    if (dx === 0 && dy === 0 && dz === 0) continue;
                    const target = this.resolveTarget(x + dx, y + dy, z + dz);
                    if (!target || this.sameCoord({ x, y, z }, target)) continue;
                    this.addLeaperMove(moves, target, piece, forAttack);
                }
            }
        }

        return this.uniqueMoves(moves);
    }

    addLeaperMove(moves, target, piece, forAttack) {
        const targetPiece = this.getPiece(target.x, target.y, target.z);
        if (!targetPiece) {
            moves.push({ ...target, capture: false });
            return;
        }

        if (targetPiece.color !== piece.color && (forAttack || targetPiece.type !== 'K')) {
            moves.push({ ...target, capture: true });
        }
    }

    nextLineStep(x, y, z, dx, dy, dz) {
        if (this.boundaryCondition === 'forbidden') {
            const nx = x + dx;
            const ny = y + dy;
            const nz = z + dz;
            return this.inBounds(nx, ny, nz) ? { x: nx, y: ny, z: nz, dx, dy, dz } : null;
        }

        if (this.boundaryCondition === 'periodic') {
            return {
                x: this.wrapCoord(x + dx),
                y: this.wrapCoord(y + dy),
                z: this.wrapCoord(z + dz),
                dx,
                dy,
                dz
            };
        }

        let nx = x + dx;
        let ny = y + dy;
        let nz = z + dz;
        let ndx = dx;
        let ndy = dy;
        let ndz = dz;

        if (nx < 0 || nx >= SIZE) {
            ndx *= -1;
            nx = this.reflectCoord(nx);
        }
        if (ny < 0 || ny >= SIZE) {
            ndy *= -1;
            ny = this.reflectCoord(ny);
        }
        if (nz < 0 || nz >= SIZE) {
            ndz *= -1;
            nz = this.reflectCoord(nz);
        }

        return { x: nx, y: ny, z: nz, dx: ndx, dy: ndy, dz: ndz };
    }

    resolveTarget(x, y, z) {
        if (this.boundaryCondition === 'forbidden') {
            return this.inBounds(x, y, z) ? { x, y, z } : null;
        }

        if (this.boundaryCondition === 'periodic') {
            return {
                x: this.wrapCoord(x),
                y: this.wrapCoord(y),
                z: this.wrapCoord(z)
            };
        }

        return {
            x: this.reflectCoord(x),
            y: this.reflectCoord(y),
            z: this.reflectCoord(z)
        };
    }

    wouldLeaveKingInCheck(fromX, fromY, fromZ, toX, toY, toZ, castling = null) {
        const piece = this.getPiece(fromX, fromY, fromZ);
        const captured = this.getPiece(toX, toY, toZ);
        let rook = null;
        let rookTarget = null;

        this.board[toZ][toY][toX] = piece;
        this.board[fromZ][fromY][fromX] = null;

        if (castling) {
            rook = this.getPiece(castling.rookFrom.x, castling.rookFrom.y, castling.rookFrom.z);
            rookTarget = this.getPiece(castling.rookTo.x, castling.rookTo.y, castling.rookTo.z);
            this.board[castling.rookTo.z][castling.rookTo.y][castling.rookTo.x] = rook;
            this.board[castling.rookFrom.z][castling.rookFrom.y][castling.rookFrom.x] = null;
        }

        const inCheck = this.isInCheck(piece.color);

        if (castling) {
            this.board[castling.rookFrom.z][castling.rookFrom.y][castling.rookFrom.x] = rook;
            this.board[castling.rookTo.z][castling.rookTo.y][castling.rookTo.x] = rookTarget;
        }

        this.board[fromZ][fromY][fromX] = piece;
        this.board[toZ][toY][toX] = captured;

        return inCheck;
    }

    isInCheck(color) {
        const king = this.findKing(color);
        if (!king) return false;
        return this.isSquareAttacked(king.x, king.y, king.z, this.opponentOf(color));
    }

    isSquareAttacked(x, y, z, byColor) {
        for (let cz = 0; cz < SIZE; cz++) {
            for (let cy = 0; cy < SIZE; cy++) {
                for (let cx = 0; cx < SIZE; cx++) {
                    const piece = this.getPiece(cx, cy, cz);
                    if (!piece || piece.color !== byColor) continue;

                    const attacks = this.getPseudoMoves(cx, cy, cz, { forAttack: true });
                    if (attacks.some((move) => move.x === x && move.y === y && move.z === z)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    findKing(color) {
        for (let z = 0; z < SIZE; z++) {
            for (let y = 0; y < SIZE; y++) {
                for (let x = 0; x < SIZE; x++) {
                    const piece = this.getPiece(x, y, z);
                    if (piece?.color === color && piece.type === 'K') return { x, y, z };
                }
            }
        }
        return null;
    }

    hasLegalMoves(color) {
        for (let z = 0; z < SIZE; z++) {
            for (let y = 0; y < SIZE; y++) {
                for (let x = 0; x < SIZE; x++) {
                    const piece = this.getPiece(x, y, z);
                    if (piece?.color === color && this.getLegalMoves(x, y, z).length > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    checkGameEnd() {
        if (this.gameOver) return;

        const inCheck = this.isInCheck(this.currentPlayer);
        const hasMoves = this.hasLegalMoves(this.currentPlayer);

        if (!hasMoves && inCheck) {
            this.endGame(`${this.capitalize(this.opponentOf(this.currentPlayer))} wins by checkmate.`);
            return;
        }

        if (!hasMoves) {
            this.endGame('Stalemate. Game drawn.');
            return;
        }

        if (inCheck) {
            this.setStatus(`${this.capitalize(this.currentPlayer)} is in check.`);
        }
    }

    choosePromotion(color) {
        return new Promise((resolve) => {
            const modal = document.getElementById('promotionModal');
            const buttons = Array.from(document.querySelectorAll('.promotion-btn'));

            this.promotionResolver = resolve;
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');

            for (const button of buttons) {
                const type = button.dataset.piece;
                button.innerHTML = `
                    <span class="promotion-icon">${this.pieceIcon({ color, type })}</span>
                    <span class="promotion-name">${PIECE_NAMES[type]}</span>
                `;
                button.onclick = () => {
                    modal.classList.remove('active');
                    modal.setAttribute('aria-hidden', 'true');
                    this.promotionResolver = null;
                    resolve(type);
                };
            }
        });
    }

    isPromotionSquare(color, x, y, z) {
        if (color === 'white') return (y === 7 && z >= 5) || (z === 7 && y >= 5);
        return (y === 0 && z <= 2) || (z === 0 && y <= 2);
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (!this.timerEnabled || this.timeLimit <= 0) return;

        this.timerInterval = setInterval(() => {
            if (this.gameOver) {
                clearInterval(this.timerInterval);
                return;
            }

            this.timeRemaining[this.currentPlayer] = Math.max(0, this.timeRemaining[this.currentPlayer] - 1);
            if (this.timeRemaining[this.currentPlayer] <= 0) {
                this.endGame(`${this.capitalize(this.opponentOf(this.currentPlayer))} wins on time.`);
            }
            this.updateTimerDisplay();
        }, 1000);
    }

    updateTimerDisplay() {
        const whiteTimer = document.getElementById('whiteTimer');
        const blackTimer = document.getElementById('blackTimer');
        const text = (seconds) => {
            if (!this.timerEnabled || this.timeLimit <= 0) return '--';
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            return `${m}:${String(s).padStart(2, '0')}`;
        };

        if (whiteTimer) whiteTimer.textContent = text(this.timeRemaining.white);
        if (blackTimer) blackTimer.textContent = text(this.timeRemaining.black);
    }

    updateUI() {
        const turn = document.getElementById('playerTurn');
        const whiteBox = document.getElementById('whiteTimerBox');
        const blackBox = document.getElementById('blackTimerBox');
        const boundaryMode = document.getElementById('boundaryMode');
        const whiteCaptured = document.getElementById('whiteCaptured');
        const blackCaptured = document.getElementById('blackCaptured');
        const onlineColorStatus = document.getElementById('onlineColorStatus');

        if (turn) turn.textContent = this.gameOver ? 'Game over' : `${this.capitalize(this.currentPlayer)} to move`;
        if (whiteBox) whiteBox.classList.toggle('active', this.currentPlayer === 'white' && !this.gameOver);
        if (blackBox) blackBox.classList.toggle('active', this.currentPlayer === 'black' && !this.gameOver);
        if (boundaryMode) boundaryMode.textContent = this.capitalize(this.boundaryCondition);
        if (whiteCaptured) whiteCaptured.innerHTML = this.capturedPieces.white.join(' ') || '<span class="muted">none</span>';
        if (blackCaptured) blackCaptured.innerHTML = this.capturedPieces.black.join(' ') || '<span class="muted">none</span>';

        if (onlineColorStatus) {
            if (this.gameMode === 'local') {
                onlineColorStatus.textContent = 'Local pass and play';
            } else if (this.network.isConnected) {
                onlineColorStatus.textContent = `You are ${this.capitalize(this.myColor)}.`;
            } else {
                onlineColorStatus.textContent = 'Online mode selected.';
            }
        }

        this.renderHistory();
        this.renderMovePicker();
        this.updateTimerDisplay();
    }

    renderMovePicker() {
        const piecesEl = document.getElementById('movablePiecesList');
        const movesEl = document.getElementById('moveOptionsList');
        const pickerSummary = document.getElementById('movePickerSummary');
        const movesSummary = document.getElementById('moveOptionsSummary');
        if (!piecesEl || !movesEl || !pickerSummary || !movesSummary) return;

        const canMove = this.canCurrentUserMove();
        const color = this.currentPlayer;
        const movablePieces = canMove ? this.getMovablePieces(color) : [];

        if (!canMove) {
            const text = this.gameOver
                ? 'Game over'
                : this.gameMode === 'online' && !this.network.isConnected
                    ? 'Connect online to move'
                    : `Waiting for ${this.currentPlayer}`;
            pickerSummary.textContent = text;
            piecesEl.innerHTML = `<span class="empty-row">${text}.</span>`;
            movesSummary.textContent = 'No active selection';
            movesEl.innerHTML = '<span class="empty-row">Destinations appear on your turn.</span>';
            return;
        }

        pickerSummary.textContent = `${this.capitalize(color)} has ${movablePieces.length} movable piece${movablePieces.length === 1 ? '' : 's'}`;
        piecesEl.innerHTML = movablePieces.length
            ? movablePieces.map(({ x, y, z, piece, moves }) => {
                const active = this.selectedSquare && this.selectedSquare.x === x && this.selectedSquare.y === y && this.selectedSquare.z === z;
                return `
                    <button class="piece-button${active ? ' active' : ''}" type="button" data-piece-x="${x}" data-piece-y="${y}" data-piece-z="${z}" aria-pressed="${active}">
                        <span class="piece-icon ${piece.color}" title="${this.pieceName(piece)}">${this.pieceIcon(piece)}</span>
                        <span class="piece-coord">${this.formatCoord({ x, y, z })}</span>
                        <span class="piece-count">${moves.length}</span>
                    </button>
                `;
            }).join('')
            : '<span class="empty-row">No movable pieces.</span>';

        if (!this.selectedSquare) {
            movesSummary.textContent = 'Select a piece';
            movesEl.innerHTML = '<span class="empty-row">Select a movable piece to list destinations.</span>';
            return;
        }

        const piece = this.getPiece(this.selectedSquare.x, this.selectedSquare.y, this.selectedSquare.z);
        movesSummary.textContent = `${this.pieceName(piece)} ${this.formatCoord(this.selectedSquare)} -> ${this.legalMoves.length} destination${this.legalMoves.length === 1 ? '' : 's'}`;
        movesEl.innerHTML = this.legalMoves.length
            ? this.legalMoves.map((move) => {
                const pending = this.pendingMoveTarget && this.sameCoord(this.pendingMoveTarget, move);
                return `
                    <button class="move-option${move.capture ? ' capture' : ''}${move.castling ? ' castle' : ''}${pending ? ' pending' : ''}" type="button" data-move-x="${move.x}" data-move-y="${move.y}" data-move-z="${move.z}" aria-pressed="${pending}">
                        ${this.formatCoord(move)}${move.capture ? ' x' : ''}${move.castling ? ` castle ${move.castling.side === 'kingside' ? 'K' : 'Q'}` : ''}
                    </button>
                `;
            }).join('')
            : '<span class="empty-row">This piece has no legal destinations.</span>';
    }

    getMovablePieces(color) {
        const pieces = [];

        for (let z = 0; z < SIZE; z++) {
            for (let y = 0; y < SIZE; y++) {
                for (let x = 0; x < SIZE; x++) {
                    const piece = this.getPiece(x, y, z);
                    if (!piece || piece.color !== color) continue;

                    const moves = this.getLegalMoves(x, y, z);
                    if (moves.length > 0) {
                        pieces.push({ x, y, z, piece, moves });
                    }
                }
            }
        }

        const order = { K: 0, Q: 1, R: 2, B: 3, N: 4, P: 5 };
        return pieces.sort((a, b) =>
            order[a.piece.type] - order[b.piece.type]
            || a.z - b.z
            || a.y - b.y
            || a.x - b.x
        );
    }

    canCurrentUserMove() {
        if (this.gameOver) return false;
        if (this.gameMode !== 'online') return true;
        return this.network.isConnected && this.myColor === this.currentPlayer;
    }

    renderHistory() {
        const history = document.getElementById('moveHistoryList');
        if (!history) return;

        if (this.moveHistory.length === 0) {
            history.innerHTML = '<div class="move-history-item muted">Game started.</div>';
            return;
        }

        history.innerHTML = this.moveHistory
            .map((entry, index) => `<div class="move-history-item">${index + 1}. ${entry}</div>`)
            .join('');
        history.scrollTop = history.scrollHeight;
    }

    updateBoundaryInfo() {
        const info = document.getElementById('boundaryInfo');
        if (!info) return;

        const text = {
            forbidden: 'Forbidden: pieces cannot move outside the 8x8x8 cube.',
            reflection: 'Reflection: a move that reaches an edge bounces back into the cube.',
            periodic: 'Periodic: leaving one side wraps the move to the opposite side.'
        };
        info.textContent = text[this.boundaryCondition];
    }

    setStatus(text) {
        const status = document.getElementById('gameStatus');
        if (status) status.textContent = text;
    }

    endGame(text) {
        this.gameOver = true;
        this.clearSelection();
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.setStatus(text);
        this.updateUI();
    }

    resetGame({ keepOnline = false, remote = false } = {}) {
        this.setupBoard3D();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.currentPlayer = 'white';
        this.moveHistory = [];
        this.gameOver = false;
        this.capturedPieces = { white: [], black: [] };
        this.gameStarted = false;
        this.pendingMoveTarget = null;
        this.timeRemaining = { white: this.timeLimit, black: this.timeLimit };

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        if (!keepOnline) {
            this.gameMode = 'local';
            this.myColor = null;
            this.network.close();
            document.getElementById('gameModeSelect').value = 'local';
            document.getElementById('onlineControls').classList.remove('active');
        }

        if (keepOnline && !remote && this.network.isConnected) {
            this.network.sendMessage({ type: 'newGame' });
        }

        this.renderer.clearHighlights();
        this.unlockGameSettings();
        this.setStatus('New game started. Select a white piece.');
        this.updateUI();
    }

    createMoveNotation(piece, from, to, captured, promotion, movedType = piece.type, castling = null) {
        if (castling) {
            return `${this.capitalize(piece.color)} King castles ${castling.side} ${this.formatCoord(from)} -> ${this.formatCoord(to)}`;
        }

        const captureText = captured ? ` captures ${this.pieceName(captured)}` : '';
        const promotionText = promotion ? ` promotes to ${PIECE_NAMES[promotion]}` : '';
        return `${this.capitalize(piece.color)} ${PIECE_NAMES[movedType]} ${this.formatCoord(from)} -> ${this.formatCoord(to)}${captureText}${promotionText}`;
    }

    attachEventListeners() {
        const canvas = document.getElementById('gameCanvas');
        canvas.addEventListener('click', (event) => this.renderer.onMouseClick(event));

        document.getElementById('movablePiecesList').addEventListener('click', (event) => {
            const button = event.target.closest('button[data-piece-x]');
            if (!button || !this.canCurrentUserMove()) return;

            this.selectSquare(
                Number(button.dataset.pieceX),
                Number(button.dataset.pieceY),
                Number(button.dataset.pieceZ)
            );
        });

        document.getElementById('moveOptionsList').addEventListener('click', async (event) => {
            const button = event.target.closest('button[data-move-x]');
            if (!button || !this.canCurrentUserMove()) return;

            await this.handleSquareClick(
                Number(button.dataset.moveX),
                Number(button.dataset.moveY),
                Number(button.dataset.moveZ)
            );
        });

        document.getElementById('cameraReset').addEventListener('click', () => this.renderer.resetCamera());

        document.getElementById('gameModeSelect').addEventListener('change', (event) => {
            if (this.gameStarted || this.network.isConnected) {
                event.target.value = this.gameMode;
                alert('Game mode cannot change after the game starts or after online connection.');
                return;
            }

            this.gameMode = event.target.value;
            document.getElementById('onlineControls').classList.toggle('active', this.gameMode === 'online');
            if (this.gameMode === 'local') {
                this.myColor = null;
                this.network.close();
                this.network.setStatus('disconnected', 'Disconnected');
            }
            this.updateUI();
        });

        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.gameMode = 'online';
            document.getElementById('gameModeSelect').value = 'online';
            document.getElementById('onlineControls').classList.add('active');
            this.network.createRoom();
        });

        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            this.gameMode = 'online';
            document.getElementById('gameModeSelect').value = 'online';
            document.getElementById('onlineControls').classList.add('active');
            this.network.joinRoom(document.getElementById('roomIdInput').value);
        });

        document.getElementById('copyLinkBtn').addEventListener('click', async () => {
            const input = document.getElementById('shareLinkInput');
            if (!input.value) return;
            try {
                await navigator.clipboard.writeText(input.value);
            } catch {
                input.select();
                document.execCommand('copy');
            }
            this.setStatus('Room link copied.');
        });

        document.getElementById('boundarySelect').addEventListener('change', (event) => {
            if (this.gameStarted || this.network.isConnected) {
                event.target.value = this.boundaryCondition;
                alert('Boundary cannot change after the game starts or after online connection.');
                return;
            }
            this.boundaryCondition = event.target.value;
            this.updateBoundaryInfo();
            this.updateUI();
        });

        document.getElementById('timerSelect').addEventListener('change', (event) => {
            if (this.gameStarted || this.network.isConnected) {
                event.target.value = String(this.timeLimit);
                alert('Timer cannot change after the game starts or after online connection.');
                return;
            }
            const value = Number(event.target.value);
            this.timerEnabled = value > 0;
            this.timeLimit = value;
            this.timeRemaining = { white: value, black: value };
            this.updateTimerDisplay();
        });

        document.getElementById('newGameBtn').addEventListener('click', () => {
            const keepOnline = this.gameMode === 'online' && this.network.isConnected;
            this.resetGame({ keepOnline });
        });

        document.getElementById('surrenderBtn').addEventListener('click', () => {
            if (this.gameOver) return;
            if (this.gameMode === 'online' && this.network.isConnected) {
                this.network.sendMessage({ type: 'surrender' });
            }
            this.endGame(`${this.capitalize(this.opponentOf(this.currentPlayer))} wins by resignation.`);
        });

        document.getElementById('offerDrawBtn').addEventListener('click', () => {
            if (this.gameOver) return;
            if (this.gameMode === 'online' && this.network.isConnected) {
                this.network.sendMessage({ type: 'drawOffer' });
                this.setStatus('Draw offer sent.');
                return;
            }
            if (confirm('Agree to a draw?')) {
                this.endGame('Game drawn by agreement.');
            }
        });

        const hintsToggle = document.getElementById('hintsToggleSwitch');
        hintsToggle.addEventListener('click', () => {
            this.showMoveHints = !this.showMoveHints;
            hintsToggle.classList.toggle('active', this.showMoveHints);
            hintsToggle.setAttribute('aria-pressed', String(this.showMoveHints));

            if (!this.showMoveHints) {
                this.renderer.clearLegalMoveHints();
                this.setStatus('Move hints hidden.');
                return;
            }

            if (this.selectedSquare) {
                this.renderer.showLegalMoves(this.legalMoves);
                if (this.pendingMoveTarget) {
                    this.renderer.showChosenMove(this.pendingMoveTarget.x, this.pendingMoveTarget.y, this.pendingMoveTarget.z);
                }
            }
            this.setStatus('Move hints shown.');
        });
    }

    getPiece(x, y, z) {
        if (!this.inBounds(x, y, z)) return null;
        return this.board[z][y][x];
    }

    inBounds(x, y, z) {
        return x >= 0 && x < SIZE && y >= 0 && y < SIZE && z >= 0 && z < SIZE;
    }

    wrapCoord(value) {
        return ((value % SIZE) + SIZE) % SIZE;
    }

    reflectCoord(value) {
        let reflected = value;
        while (reflected < 0 || reflected >= SIZE) {
            if (reflected < 0) reflected = -reflected;
            if (reflected >= SIZE) reflected = (SIZE - 1) * 2 - reflected;
        }
        return reflected;
    }

    sameCoord(a, b) {
        return a.x === b.x && a.y === b.y && a.z === b.z;
    }

    uniqueMoves(moves) {
        const seen = new Set();
        return moves.filter((move) => {
            const key = `${move.x},${move.y},${move.z}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    formatCoord({ x, y, z }) {
        return `(${x},${y},${z})`;
    }

    opponentOf(color) {
        return color === 'white' ? 'black' : 'white';
    }

    capitalize(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    pieceName(piece) {
        return PIECE_NAMES[piece.type] || 'Piece';
    }

    pieceIcon(piece) {
        return PIECE_ICONS[piece.color]?.[piece.type] || piece.display || '?';
    }
}
