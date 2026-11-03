import { computed, signal } from '@angular/core';
import { Chess, Square, SQUARES } from 'chess.js';
import { PIECE_GLYPHS, PIECE_NAMES } from './chess.constants';
import { ChessSquare, PromotionPiece } from './chess.types';

export class ChessGame {
  private readonly game: Chess;
  private readonly revision = signal(0);
  readonly selected = signal<Square | null>(null);
  readonly promotion = signal<{ from: Square; to: Square } | null>(null);
  readonly position = computed(() => {
    this.revision();
    return this.game.fen();
  });
  readonly history = computed(() => {
    this.position();
    return this.game.history({ verbose: true });
  });
  readonly squares = computed<ChessSquare[]>(() => {
    this.position();
    return SQUARES.map((square, index) => {
      const piece = this.game.get(square);
      return {
        square, dark: (Math.floor(index / 8) + index % 8) % 2 === 1,
        glyph: piece ? PIECE_GLYPHS[piece.type] : '',
        color: piece?.color, type: piece?.type,
        label: `${square}, ${piece ? `${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[piece.type]}` : 'empty'}`
      };
    });
  });
  readonly legalTargets = computed(() => {
    this.position();
    const square = this.selected();
    return square ? this.game.moves({ square, verbose: true }).map((move) => move.to) : [];
  });
  readonly over = computed(() => { this.position(); return this.game.isGameOver(); });
  readonly playerTurn = computed(() => { this.position(); return this.game.turn() === 'w' && !this.over(); });
  readonly checkedKing = computed(() => {
    this.position();
    return this.game.isCheck() ? this.squares().find((square) => square.type === 'k' && square.color === this.game.turn())?.square : null;
  });
  readonly status = computed(() => {
    this.position();
    if (this.game.isCheckmate()) return this.game.turn() === 'w' ? 'Checkmate. Computer wins.' : 'Checkmate. You win!';
    if (this.game.isStalemate()) return 'Draw by stalemate.';
    if (this.game.isThreefoldRepetition()) return 'Draw by threefold repetition.';
    if (this.game.isInsufficientMaterial()) return 'Draw by insufficient material.';
    if (this.game.isDraw()) return 'Draw by the fifty-move rule.';
    if (this.promotion()) return 'Choose a piece to promote your pawn.';
    if (this.game.turn() === 'b') return 'Computer is thinking…';
    return this.game.isCheck() ? 'You are in check. Protect your king.' : 'Your move.';
  });

  constructor(fen?: string) {
    this.game = new Chess(fen);
  }

  selectSquare(square: Square): boolean {
    if (!this.playerTurn() || this.promotion()) return false;
    const from = this.selected();
    const move = from ? this.game.moves({ square: from, verbose: true }).find((candidate) => candidate.to === square) : null;
    if (move) {
      if (move.promotion) {
        this.promotion.set({ from: move.from, to: move.to });
        return false;
      }
      this.game.move(move);
      this.refresh();
      return true;
    }
    this.selected.set(this.game.get(square)?.color === 'w' && square !== from ? square : null);
    return false;
  }

  promote(piece: PromotionPiece): boolean {
    const pending = this.promotion();
    if (!pending) return false;
    this.game.move({ ...pending, promotion: piece });
    this.refresh();
    return true;
  }

  playComputerMove(san: string): void {
    if (this.playerTurn() || this.over()) return;
    this.game.move(san);
    this.refresh();
  }

  undoTurn(): void {
    if (this.promotion()) {
      this.refresh();
      return;
    }
    const move = this.game.undo();
    if (move?.color === 'b') this.game.undo();
    this.refresh();
  }

  reset(): void {
    this.game.reset();
    this.refresh();
  }

  private refresh(): void {
    this.selected.set(null);
    this.promotion.set(null);
    this.revision.update((value) => value + 1);
  }
}
