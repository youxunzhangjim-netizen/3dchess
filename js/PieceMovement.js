export class PieceMovement {
    constructor(game) {
        this.game = game;
    }

    getLegalMoves(x, y, z) {
        return this.game.getLegalMoves(x, y, z);
    }
}
