import { describe, expect, it } from 'vitest';
import { ChessGame } from './chess-game';

describe('ChessGame', () => {
  it('shows legal moves, rejects illegal moves and locks player input during the computer turn', () => {
    const game = new ChessGame();
    game.selectSquare('e2');
    expect(game.legalTargets()).toEqual(['e3', 'e4']);
    expect(game.selectSquare('e5')).toBe(false);
    expect(game.history()).toHaveLength(0);
    game.selectSquare('e2');
    expect(game.selectSquare('e4')).toBe(true);
    expect(game.playerTurn()).toBe(false);
    expect(game.selectSquare('d2')).toBe(false);
    game.playComputerMove('e5');
    expect(game.playerTurn()).toBe(true);
    expect(game.history().map((move) => move.san)).toEqual(['e4', 'e5']);
  });

  it('takes back a full turn or a pending player move', () => {
    const game = new ChessGame();
    const initial = game.position();
    game.selectSquare('e2'); game.selectSquare('e4');
    game.undoTurn();
    expect(game.position()).toBe(initial);
    game.selectSquare('d2'); game.selectSquare('d4');
    game.playComputerMove('d5');
    game.undoTurn();
    expect(game.position()).toBe(initial);
  });

  it('moves the rook when castling', () => {
    const game = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    game.selectSquare('e1'); game.selectSquare('g1');
    expect(game.squares().find((cell) => cell.square === 'f1')?.type).toBe('r');
    expect(game.history()[0].san).toBe('O-O');
  });

  it('prevents castling through check', () => {
    const game = new ChessGame('4kr2/8/8/8/8/8/8/4K2R w K - 0 1');
    game.selectSquare('e1');
    expect(game.legalTargets()).not.toContain('g1');
  });

  it('removes the captured pawn during en passant', () => {
    const game = new ChessGame('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    game.selectSquare('e5'); game.selectSquare('d6');
    expect(game.squares().find((cell) => cell.square === 'd5')?.type).toBeUndefined();
    expect(game.history()[0].san).toBe('exd6');
  });

  it('waits for a promotion choice and supports underpromotion', () => {
    const game = new ChessGame('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    game.selectSquare('a7');
    expect(game.selectSquare('a8')).toBe(false);
    expect(game.promotion()).toEqual({ from: 'a7', to: 'a8' });
    expect(game.history()).toHaveLength(0);
    game.promote('n');
    expect(game.squares().find((cell) => cell.square === 'a8')?.type).toBe('n');
    expect(game.promotion()).toBeNull();
  });

  it('cancels promotion without changing the position', () => {
    const game = new ChessGame('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const before = game.position();
    game.selectSquare('a7'); game.selectSquare('a8');
    game.undoTurn();
    expect(game.position()).toBe(before);
    expect(game.promotion()).toBeNull();
  });

  it('announces checkmate and prevents further moves', () => {
    const game = new ChessGame();
    game.selectSquare('f2'); game.selectSquare('f3'); game.playComputerMove('e5');
    game.selectSquare('g2'); game.selectSquare('g4'); game.playComputerMove('Qh4#');
    expect(game.status()).toBe('Checkmate. Computer wins.');
    expect(game.checkedKing()).toBe('e1');
    expect(game.selectSquare('a2')).toBe(false);
    game.reset();
    expect(game.over()).toBe(false);
    expect(game.history()).toHaveLength(0);
  });

  it.each([
    ['7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 'Draw by stalemate.'],
    ['4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'Draw by insufficient material.'],
    ['4k3/8/8/8/8/8/R7/4K3 w - - 100 51', 'Draw by the fifty-move rule.']
  ])('recognizes a drawn position %s', (fen, status) => {
    const game = new ChessGame(fen);
    expect(game.over()).toBe(true);
    expect(game.status()).toBe(status);
  });

  it('retains repetition history', () => {
    const game = new ChessGame();
    for (let repeat = 0; repeat < 2; repeat += 1) {
      game.selectSquare('g1'); game.selectSquare('f3'); game.playComputerMove('Nf6');
      game.selectSquare('f3'); game.selectSquare('g1'); game.playComputerMove('Ng8');
    }
    expect(game.status()).toBe('Draw by threefold repetition.');
  });
});
