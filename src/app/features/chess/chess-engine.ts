import { Chess, Move } from 'chess.js';
import { CHESS_DIFFICULTIES, PIECE_VALUES } from './chess.constants';
import { ChessDifficulty } from './chess.types';

/** Searches a private position so the live game's history is never changed. */
export function chooseComputerMove(game: Chess, difficulty: ChessDifficulty): string | null {
  if (game.isGameOver()) return null;
  const moves = orderMoves(game.moves({ verbose: true }));
  if (difficulty === 'easy') return moves[Math.floor(Math.random() * moves.length)].san;

  const deadline = performance.now() + (difficulty === 'hard' ? 1600 : 700);
  const maxDepth = CHESS_DIFFICULTIES.find((level) => level.value === difficulty)!.depth;
  let bestMove = moves[0].san;
  let timedOut = false;

  const search = (depth: number, alpha: number, beta: number, ply: number): number => {
    if (performance.now() >= deadline) {
      timedOut = true;
      return 0;
    }
    if (game.isCheckmate()) return -100000 + ply;
    if (game.isDraw()) return 0;
    if (depth === 0) return evaluatePosition(game);
    let best = -Infinity;
    for (const move of orderMoves(game.moves({ verbose: true }))) {
      game.move(move);
      const score = -search(depth - 1, -beta, -alpha, ply + 1);
      game.undo();
      if (timedOut) return 0;
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  };

  // Keep the last fully searched depth if the time budget is exhausted.
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    let score = -Infinity;
    let candidate = bestMove;
    for (const move of moves) {
      game.move(move);
      const value = -search(depth - 1, -Infinity, -score, 1);
      game.undo();
      if (timedOut) break;
      if (value > score) {
        score = value;
        candidate = move.san;
      }
    }
    if (timedOut) break;
    bestMove = candidate;
  }
  return bestMove;
}

function orderMoves(moves: Move[]): Move[] {
  const priority = (move: Move) => (move.captured ? 10 * PIECE_VALUES[move.captured] - PIECE_VALUES[move.piece] : 0)
    + (move.promotion ? PIECE_VALUES[move.promotion] : 0);
  return moves.sort((left, right) => priority(right) - priority(left));
}

function evaluatePosition(game: Chess): number {
  let score = 0;
  for (const [rank, row] of game.board().entries()) {
    for (const [file, piece] of row.entries()) {
      if (!piece) continue;
      const center = 7 - Math.abs(3.5 - file) - Math.abs(3.5 - rank);
      const advance = piece.color === 'w' ? 6 - rank : rank - 1;
      const position = piece.type === 'p' ? advance * 8 + center * 2
        : piece.type === 'n' || piece.type === 'b' ? center * 10 : 0;
      score += (PIECE_VALUES[piece.type] + position) * (piece.color === game.turn() ? 1 : -1);
    }
  }
  return score;
}
