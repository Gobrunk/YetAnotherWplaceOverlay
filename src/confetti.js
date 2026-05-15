import { COLOR_PALETTE } from './palette.js';

export class ConfettiManager {
    constructor() {
        this.pieceCount = Math.ceil(80 / 1300 * window.innerWidth);
        this.colors     = COLOR_PALETTE.slice(1);
    }

    launch(targetEl) {
        const container = document.createElement('div');
        for (let i = 0; i < this.pieceCount; i++) {
            const piece = document.createElement('confetti-piece');
            piece.style.setProperty('--x',        100 * Math.random() + 'vw');
            piece.style.setProperty('--delay',    2 * Math.random() + 's');
            piece.style.setProperty('--duration', 3 + 3 * Math.random() + 's');
            piece.style.setProperty('--rot',      360 * Math.random() + 'deg');
            piece.style.setProperty('--size',     6 + 6 * Math.random() + 'px');
            piece.style.backgroundColor = `rgb(${this.colors[Math.floor(Math.random() * this.colors.length)].rgb.join(',')})`;
            piece.onanimationend = () => {
                piece.parentNode.childElementCount <= 1 ? piece.parentNode.remove() : piece.remove();
            };
            container.appendChild(piece);
        }
        targetEl.appendChild(container);
    }
}

export class ConfettiPiece extends HTMLElement {}
customElements.define('confetti-piece', ConfettiPiece);
