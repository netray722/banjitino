/// <reference lib="webworker" />

import { Chess } from 'chess.js';
import { chooseComputerMove } from './chess-engine';
import { ChessEngineRequest } from './chess.types';

addEventListener('message', ({ data }: MessageEvent<ChessEngineRequest>) => {
  const game = new Chess();
  for (const move of data.moves) game.move(move);
  postMessage(chooseComputerMove(game, data.difficulty));
});
