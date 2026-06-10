import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const port = 5173;
const url = `http://127.0.0.1:${port}/`;
let server = null;
let serverText = '';

async function isServerReady() {
    try {
        const response = await fetch(url);
        return response.ok;
    } catch {
        return false;
    }
}

async function waitForServer() {
    const started = Date.now();
    while (Date.now() - started < 20000) {
        if (await isServerReady()) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Vite server did not start. Output:\n${serverText}`);
}

try {
    if (!(await isServerReady())) {
        server = spawn('cmd.exe', ['/c', 'npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
            cwd: process.cwd(),
            shell: false,
            stdio: 'pipe'
        });
        server.stdout.on('data', (chunk) => {
            serverText += chunk.toString();
        });
        server.stderr.on('data', (chunk) => {
            serverText += chunk.toString();
        });
        await waitForServer();
    }

    const browser = await chromium.launch({ timeout: 30000 });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.game?.renderer?.renderer);

    const result = await page.evaluate(async () => {
        const game = window.game;
        const failures = [];
        const key = (pos) => `${pos.x},${pos.y},${pos.z}`;
        const has = (moves, x, y, z) => moves.some((move) => move.x === x && move.y === y && move.z === z);
        const assert = (condition, message) => {
            if (!condition) failures.push(message);
        };

        const countPieces = () => {
            let total = 0;
            const byColor = { white: 0, black: 0 };
            for (let z = 0; z < 8; z++) {
                for (let y = 0; y < 8; y++) {
                    for (let x = 0; x < 8; x++) {
                        const piece = game.getPiece(x, y, z);
                        if (!piece) continue;
                        total++;
                        byColor[piece.color]++;
                    }
                }
            }
            return { total, byColor };
        };

        const clearBoard = (currentPlayer = 'white') => {
            if (game.timerInterval) {
                clearInterval(game.timerInterval);
                game.timerInterval = null;
            }
            game.timerEnabled = false;
            game.board = game.createEmptyBoard();
            game.currentPlayer = currentPlayer;
            game.gameOver = false;
            game.gameStarted = false;
            game.selectedSquare = null;
            game.legalMoves = [];
            game.pendingMoveTarget = null;
            game.boundaryCondition = 'forbidden';
            game.capturedPieces = { white: [], black: [] };
            game.moveHistory = [];
        };

        const place = (x, y, z, color, type, hasMoved = false) => {
            game.placePiece(x, y, z, color, type);
            game.board[z][y][x].hasMoved = hasMoved;
            return game.board[z][y][x];
        };

        const placeSafeKings = () => {
            place(0, 7, 2, 'white', 'K');
            place(7, 0, 5, 'black', 'K');
        };

        const legal = (x, y, z) => game.getLegalMoves(x, y, z);
        let moves;

        game.resetGame();
        game.timerEnabled = false;
        const initial = countPieces();
        assert(initial.total === 64, `initial board should have 64 pieces, got ${initial.total}`);
        assert(initial.byColor.white === 32 && initial.byColor.black === 32, `initial color count wrong ${JSON.stringify(initial.byColor)}`);
        assert(game.findKing('white') && game.findKing('black'), 'both kings must exist at setup');
        assert(game.getMovablePieces('white').length > 0, 'white should have movable pieces at setup');
        assert(!has(legal(4, 0, 0), 6, 0, 0) && !has(legal(4, 0, 0), 2, 0, 0), 'initial king should not castle through starting pieces');

        clearBoard();
        place(4, 0, 0, 'white', 'K');
        place(0, 0, 0, 'white', 'R');
        place(7, 0, 0, 'white', 'R');
        place(7, 7, 7, 'black', 'K');
        moves = legal(4, 0, 0);
        assert(moves.some((move) => move.x === 6 && move.y === 0 && move.z === 0 && move.castling?.side === 'kingside'), 'white king should be able to castle kingside on clear home row');
        assert(moves.some((move) => move.x === 2 && move.y === 0 && move.z === 0 && move.castling?.side === 'queenside'), 'white king should be able to castle queenside on clear home row');
        const castled = await game.applyMove({ from: { x: 4, y: 0, z: 0 }, to: { x: 6, y: 0, z: 0 } });
        assert(castled, 'applyMove should accept legal castling');
        assert(game.getPiece(6, 0, 0)?.type === 'K' && game.getPiece(5, 0, 0)?.type === 'R', 'castling should move king to x6 and rook to x5');
        assert(game.getPiece(6, 0, 0).hasMoved && game.getPiece(5, 0, 0).hasMoved, 'castling should mark king and rook as moved');
        assert(game.formatHistoryEntry(game.moveHistory[0]).includes('castles kingside'), 'castling history should display English castle text by default');

        clearBoard();
        place(4, 0, 0, 'white', 'K');
        place(7, 0, 0, 'white', 'R');
        place(5, 0, 0, 'white', 'N');
        place(7, 7, 7, 'black', 'K');
        moves = legal(4, 0, 0);
        assert(!has(moves, 6, 0, 0), 'castling should be blocked when a piece sits between king and rook');

        clearBoard();
        place(4, 0, 0, 'white', 'K', true);
        place(7, 0, 0, 'white', 'R');
        place(7, 7, 7, 'black', 'K');
        assert(!has(legal(4, 0, 0), 6, 0, 0), 'castling should be rejected after the king has moved');

        clearBoard();
        place(4, 0, 0, 'white', 'K');
        place(7, 0, 0, 'white', 'R', true);
        place(7, 7, 7, 'black', 'K');
        assert(!has(legal(4, 0, 0), 6, 0, 0), 'castling should be rejected after the rook has moved');

        clearBoard();
        place(4, 0, 0, 'white', 'K');
        place(7, 0, 0, 'white', 'R');
        place(4, 7, 0, 'black', 'R');
        place(7, 7, 7, 'black', 'K');
        assert(game.isInCheck('white'), 'test setup should place the king in check');
        assert(!has(legal(4, 0, 0), 6, 0, 0), 'castling should be rejected while the king is in check');

        clearBoard();
        place(4, 0, 0, 'white', 'K');
        place(7, 0, 0, 'white', 'R');
        place(5, 7, 0, 'black', 'R');
        place(7, 7, 7, 'black', 'K');
        assert(!game.isInCheck('white'), 'path attack setup should not check the starting king');
        assert(!has(legal(4, 0, 0), 6, 0, 0), 'castling should be rejected through an attacked square');

        clearBoard('black');
        place(4, 7, 7, 'black', 'K');
        place(0, 7, 7, 'black', 'R');
        place(7, 7, 7, 'black', 'R');
        place(0, 0, 0, 'white', 'K');
        moves = legal(4, 7, 7);
        assert(moves.some((move) => move.x === 6 && move.y === 7 && move.z === 7 && move.castling?.side === 'kingside'), 'black king should be able to castle kingside on clear home row');
        assert(moves.some((move) => move.x === 2 && move.y === 7 && move.z === 7 && move.castling?.side === 'queenside'), 'black king should be able to castle queenside on clear home row');

        clearBoard();
        placeSafeKings();
        place(3, 3, 3, 'white', 'R');
        moves = legal(3, 3, 3);
        assert(moves.length === 21, `rook center should have 21 moves, got ${moves.length}`);
        assert(has(moves, 0, 3, 3) && has(moves, 7, 3, 3) && has(moves, 3, 0, 3) && has(moves, 3, 3, 7), 'rook should move along all axes');
        assert(!has(moves, 4, 4, 3), 'rook should not move diagonally');

        clearBoard();
        placeSafeKings();
        place(3, 3, 3, 'white', 'B');
        moves = legal(3, 3, 3);
        assert(has(moves, 4, 4, 3), 'bishop should move on plane diagonals');
        assert(has(moves, 4, 4, 4), 'bishop should move on body diagonals');
        assert(!has(moves, 4, 3, 3), 'bishop should not move on axes');

        clearBoard();
        placeSafeKings();
        place(3, 3, 3, 'white', 'Q');
        moves = legal(3, 3, 3);
        assert(has(moves, 4, 3, 3) && has(moves, 4, 4, 3) && has(moves, 4, 4, 4), 'queen should combine axes and all diagonals');

        clearBoard();
        placeSafeKings();
        place(3, 3, 3, 'white', 'N');
        moves = legal(3, 3, 3);
        assert(moves.length === 24, `knight center should have 24 moves, got ${moves.length}`);
        assert(has(moves, 5, 4, 3) && has(moves, 1, 3, 4), 'knight should jump 2-1 on any plane');
        assert(!has(moves, 5, 4, 4), 'knight should not use 2-1-1 offsets');

        clearBoard();
        place(3, 3, 3, 'white', 'K');
        place(7, 0, 5, 'black', 'K');
        moves = legal(3, 3, 3);
        assert(moves.length === 26, `king center should have 26 moves, got ${moves.length}`);

        clearBoard();
        placeSafeKings();
        place(3, 3, 3, 'white', 'P');
        moves = legal(3, 3, 3);
        assert(moves.length === 6, `unmoved white pawn in empty center should have 6 forward moves, got ${moves.length}`);
        assert(has(moves, 4, 3, 3) && has(moves, 5, 3, 3) && has(moves, 3, 4, 3) && has(moves, 3, 5, 3) && has(moves, 3, 3, 4) && has(moves, 3, 3, 5), 'white pawn should move one/two forward on X/Y/Z');

        clearBoard();
        placeSafeKings();
        place(3, 3, 3, 'black', 'P');
        game.currentPlayer = 'black';
        moves = legal(3, 3, 3);
        assert(has(moves, 2, 3, 3) && has(moves, 1, 3, 3) && has(moves, 3, 2, 3) && has(moves, 3, 1, 3) && has(moves, 3, 3, 2) && has(moves, 3, 3, 1), 'black pawn should move one/two toward low X/Y/Z');

        clearBoard();
        placeSafeKings();
        place(3, 3, 3, 'white', 'P');
        for (const [dx, dy, dz] of game.getPawnCaptureVectors(1)) {
            place(3 + dx, 3 + dy, 3 + dz, 'black', 'N');
        }
        place(2, 2, 2, 'black', 'N');
        moves = legal(3, 3, 3);
        assert(game.getPawnCaptureVectors(1).length === 16, `white pawn should have 16 forward diagonal capture vectors, got ${game.getPawnCaptureVectors(1).length}`);
        assert(has(moves, 2, 4, 3) && has(moves, 3, 2, 4) && has(moves, 2, 4, 4), 'white pawn should capture forward diagonals with sideways/back-side components');
        assert(!has(moves, 2, 2, 2), 'white pawn should not capture all-backward diagonal');

        clearBoard();
        placeSafeKings();
        place(3, 3, 3, 'white', 'P');
        place(4, 4, 3, 'white', 'N');
        place(4, 3, 4, 'black', 'K');
        moves = legal(3, 3, 3);
        assert(!has(moves, 4, 4, 3), 'pawn should not capture own piece');
        assert(!has(moves, 4, 3, 4), 'pawn should not directly capture king');

        clearBoard();
        placeSafeKings();
        place(3, 3, 3, 'white', 'R');
        place(5, 3, 3, 'white', 'N');
        place(2, 3, 3, 'black', 'N');
        moves = legal(3, 3, 3);
        assert(has(moves, 4, 3, 3), 'line piece should move before own blocker');
        assert(!has(moves, 5, 3, 3) && !has(moves, 6, 3, 3), 'line piece should stop at own blocker');
        assert(has(moves, 2, 3, 3) && !has(moves, 1, 3, 3), 'line piece should capture enemy then stop');

        clearBoard();
        placeSafeKings();
        place(7, 3, 3, 'white', 'R');
        assert(game.resolveTarget(8, 3, 3) === null, 'forbidden boundary should reject outside target');
        game.boundaryCondition = 'periodic';
        moves = legal(7, 3, 3);
        assert(has(moves, 0, 3, 3), 'periodic boundary should wrap across cube edge');
        game.boundaryCondition = 'reflection';
        const reflected = game.resolveTarget(8, 3, 3);
        assert(reflected.x === 6 && reflected.y === 3 && reflected.z === 3, `reflection boundary should bounce to (6,3,3), got ${key(reflected)}`);

        assert(!game.isPromotionSquare('white', 7, 1, 0), 'white should not promote on X edge alone');
        assert(!game.isPromotionSquare('white', 4, 5, 5), 'white should not promote inside the far corner until touching an enemy home face');
        assert(game.isPromotionSquare('white', 4, 7, 5), 'white should promote on the far Y face within the bottom three Z rows');
        assert(game.isPromotionSquare('white', 4, 5, 7), 'white should promote on the far Z face within the bottom three Y rows');
        assert(!game.isPromotionSquare('white', 4, 7, 4), 'white should not promote on far Y face before the bottom three Z rows');
        assert(!game.isPromotionSquare('white', 4, 4, 7), 'white should not promote on far Z face before the bottom three Y rows');
        assert(!game.isPromotionSquare('black', 0, 6, 7), 'black should not promote on X edge alone');
        assert(!game.isPromotionSquare('black', 4, 2, 2), 'black should not promote inside the low corner until touching an enemy home face');
        assert(game.isPromotionSquare('black', 4, 0, 2), 'black should promote on the low Y face within the bottom three Z rows');
        assert(game.isPromotionSquare('black', 4, 2, 0), 'black should promote on the low Z face within the bottom three Y rows');
        assert(!game.isPromotionSquare('black', 4, 0, 3), 'black should not promote on low Y face before the bottom three Z rows');
        assert(!game.isPromotionSquare('black', 4, 3, 0), 'black should not promote on low Z face before the bottom three Y rows');

        clearBoard();
        place(0, 0, 0, 'white', 'K');
        place(0, 0, 7, 'black', 'R');
        place(7, 7, 7, 'black', 'K');
        assert(game.isInCheck('white'), 'rook should give check along an axis');

        clearBoard();
        place(0, 0, 0, 'white', 'K');
        place(0, 0, 3, 'white', 'R');
        place(0, 0, 7, 'black', 'R');
        place(7, 7, 7, 'black', 'K');
        moves = legal(0, 0, 3);
        assert(!has(moves, 1, 0, 3), 'pinned rook should not move off the checking line');
        assert(has(moves, 0, 0, 7), 'pinned rook should be allowed to capture checking piece');

        clearBoard();
        place(0, 0, 0, 'white', 'K');
        place(1, 7, 0, 'black', 'R');
        place(7, 7, 7, 'black', 'K');
        moves = legal(0, 0, 0);
        assert(!has(moves, 1, 0, 0), 'king should not move into check');

        clearBoard();
        placeSafeKings();
        place(3, 3, 3, 'white', 'Q');
        game.board[5][0][7] = null;
        place(4, 4, 4, 'black', 'K');
        moves = legal(3, 3, 3);
        assert(!has(moves, 4, 4, 4), 'pieces should not directly capture the king');

        clearBoard();
        game.timerEnabled = false;
        placeSafeKings();
        place(3, 3, 3, 'white', 'P');
        const moved = await game.applyMove({ from: { x: 3, y: 3, z: 3 }, to: { x: 4, y: 3, z: 3 } });
        assert(moved, 'applyMove should accept legal pawn move');
        assert(game.currentPlayer === 'black', 'legal move should switch turns');
        assert(game.moveHistory.length === 1 && game.formatHistoryEntry(game.moveHistory[0]).includes('White Pawn'), 'move history should display English piece names by default');

        return { ok: failures.length === 0, failures };
    });

    await browser.close();

    if (!result.ok) {
        throw new Error(`Rule verification failed:\n- ${result.failures.join('\n- ')}`);
    }

    console.log(JSON.stringify({ ok: true, checked: '3D chess rules' }, null, 2));
} finally {
    if (server) server.kill();
}
