export class UIController {
    constructor(game) {
        this.game = game;
    }

    attachEventListeners() {
        return this.game.attachEventListeners();
    }

    updateUI() {
        return this.game.updateUI();
    }
}
