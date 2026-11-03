import { PieceSymbol } from 'chess.js';
import { ChessDifficulty, PromotionPiece } from './chess.types';

export const CHESS_DIFFICULTIES: { value: ChessDifficulty; label: string; description: string; depth: number }[] = [
  { value: 'easy', label: 'Easy', description: 'A relaxed opponent that plays unpredictable moves.', depth: 0 },
  { value: 'medium', label: 'Medium', description: 'Looks ahead and weighs captures and replies.', depth: 2 },
  { value: 'hard', label: 'Hard', description: 'Searches deeper for tactics and stronger positions.', depth: 3 }
];

export const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king'
};

export const PIECE_GLYPHS: Record<PieceSymbol, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚'
};

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 0
};

export const PROMOTION_CHOICES: { piece: PromotionPiece; label: string }[] = [
  { piece: 'q', label: 'Queen' }, { piece: 'r', label: 'Rook' },
  { piece: 'b', label: 'Bishop' }, { piece: 'n', label: 'Knight' }
];
