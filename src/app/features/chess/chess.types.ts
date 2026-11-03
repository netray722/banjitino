import { PieceSymbol, Square } from 'chess.js';

export type ChessDifficulty = 'easy' | 'medium' | 'hard';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export interface ChessEngineRequest {
  moves: string[];
  difficulty: ChessDifficulty;
}

export interface ChessSquare {
  square: Square;
  dark: boolean;
  glyph: string;
  label: string;
  color?: 'w' | 'b';
  type?: PieceSymbol;
}
