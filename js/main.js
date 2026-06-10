import { ChessGame } from './ChessGame.js';

window.addEventListener('DOMContentLoaded', () => {
    const game = new ChessGame();
    window.game = game;
});
