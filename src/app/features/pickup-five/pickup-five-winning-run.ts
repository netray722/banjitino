import { PickupGame, StayTeam } from './pickup-five.types';

export function latestWinningRun(gameHistory: PickupGame[]): StayTeam | null {
  const completed = gameHistory.filter((game) => game.status === 'COMPLETED' && game.winner);
  const latest = completed[completed.length - 1];
  if (!latest?.winner) return null;

  const playerIds = latest.winner === 'A' ? latest.teamA : latest.teamB;
  const key = lineupKey(playerIds);
  let consecutiveWins = 0;
  for (let index = completed.length - 1; index >= 0; index -= 1) {
    const game = completed[index];
    const winningPlayers = game.winner === 'A' ? game.teamA : game.teamB;
    if (lineupKey(winningPlayers) !== key) break;
    consecutiveWins += 1;
  }

  return { playerIds: [...playerIds], side: latest.winner, consecutiveWins };
}

export function lineupKey(playerIds: string[]): string {
  return [...playerIds].sort().join('|');
}
