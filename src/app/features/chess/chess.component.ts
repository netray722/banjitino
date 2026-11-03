import { ChangeDetectionStrategy, Component, OnDestroy, computed, signal } from '@angular/core';
import { Square } from 'chess.js';
import { CHESS_DIFFICULTIES, PROMOTION_CHOICES } from './chess.constants';
import { ChessGame } from './chess-game';
import { ChessDifficulty, ChessEngineRequest, PromotionPiece } from './chess.types';

@Component({
  selector: 'app-chess',
  imports: [],
  templateUrl: './chess.component.html',
  styleUrl: './chess.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChessComponent implements OnDestroy {
  private worker: Worker | null = null;
  protected readonly game = new ChessGame();
  protected readonly levels = CHESS_DIFFICULTIES;
  protected readonly promotions = PROMOTION_CHOICES;
  protected readonly difficulty = signal<ChessDifficulty>('medium');
  protected readonly engineError = signal(false);
  protected readonly restartRequested = signal(false);
  protected readonly focusedSquare = signal<Square>('e2');
  protected readonly level = computed(() => this.levels.find((level) => level.value === this.difficulty())!);
  protected readonly lastMove = computed(() => this.game.history().at(-1));
  protected readonly movePairs = computed(() => {
    const history = this.game.history();
    return history.filter((_, index) => index % 2 === 0).map((move, index) => ({
      number: index + 1, white: move.san, black: history[index * 2 + 1]?.san ?? '…'
    }));
  });

  ngOnDestroy(): void {
    this.stopComputer();
  }

  protected selectSquare(square: Square): void {
    this.focusedSquare.set(square);
    if (this.game.selectSquare(square)) this.requestComputerMove();
  }

  protected promote(piece: PromotionPiece): void {
    if (this.game.promote(piece)) this.requestComputerMove();
  }

  protected changeDifficulty(value: string): void {
    const level = this.levels.find((level) => level.value === value);
    if (!level) return;
    this.difficulty.set(level.value);
    if (!this.game.playerTurn() && !this.game.over()) this.requestComputerMove();
  }

  protected startNewGame(): void {
    this.stopComputer();
    this.game.reset();
    this.engineError.set(false);
    this.restartRequested.set(false);
  }

  protected undoTurn(): void {
    this.stopComputer();
    this.game.undoTurn();
    this.engineError.set(false);
    this.restartRequested.set(false);
  }

  protected moveFocus(event: KeyboardEvent, index: number): void {
    let next = index;
    if (event.key === 'ArrowLeft') next = index % 8 ? index - 1 : index;
    else if (event.key === 'ArrowRight') next = index % 8 < 7 ? index + 1 : index;
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 8);
    else if (event.key === 'ArrowDown') next = Math.min(63, index + 8);
    else return;
    event.preventDefault();
    this.focusedSquare.set(this.game.squares()[next].square);
    const button = event.currentTarget as HTMLButtonElement;
    button.parentElement?.querySelectorAll<HTMLButtonElement>('.square')[next]?.focus();
  }

  protected requestComputerMove(): void {
    this.stopComputer();
    if (this.game.over()) return;
    this.engineError.set(false);
    try {
      const worker = new Worker(new URL('./chess-engine.worker', import.meta.url), { type: 'module' });
      this.worker = worker;
      worker.onmessage = ({ data }: MessageEvent<string | null>) => {
        if (this.worker !== worker) return;
        this.stopComputer();
        if (data) this.game.playComputerMove(data);
        else this.engineError.set(true);
      };
      worker.onerror = () => {
        if (this.worker !== worker) return;
        this.stopComputer();
        this.engineError.set(true);
      };
      const request: ChessEngineRequest = {
        moves: this.game.history().map((move) => move.san), difficulty: this.difficulty()
      };
      worker.postMessage(request);
    } catch {
      this.engineError.set(true);
    }
  }

  private stopComputer(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
