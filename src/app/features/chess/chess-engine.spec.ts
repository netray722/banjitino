import { Chess } from 'chess.js';
import { describe, expect, it, vi } from 'vitest';
import { chooseComputerMove } from './chess-engine';
import { ChessDifficulty } from './chess.types';

describe('chess opponent', () => {
  it.each<ChessDifficulty>(['easy', 'medium', 'hard'])('returns a legal %s move without changing the game', (difficulty) => {
    const game = new Chess();
    game.move('e4');
    const before = game.fen();
    const history = game.history();
    expect(game.moves()).toContain(chooseComputerMove(game, difficulty));
    expect(game.fen()).toBe(before);
    expect(game.history()).toEqual(history);
  });

  it.each<ChessDifficulty>(['medium', 'hard'])('%s finds mate in one', (difficulty) => {
    const game = new Chess();
    for (const move of ['f3', 'e5', 'g4']) game.move(move);
    const move = chooseComputerMove(game, difficulty);
    expect(move).not.toBeNull();
    game.move(move!);
    expect(game.isCheckmate()).toBe(true);
  });

  it('lets easy play varied legal moves', () => {
    const game = new Chess();
    const random = vi.spyOn(Math, 'random');
    random.mockReturnValueOnce(0);
    const first = chooseComputerMove(game, 'easy');
    random.mockReturnValueOnce(.99);
    expect(chooseComputerMove(game, 'easy')).not.toBe(first);
    random.mockRestore();
  });

  it('does not play after a draw', () => {
    expect(chooseComputerMove(new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), 'hard')).toBeNull();
  });
});
