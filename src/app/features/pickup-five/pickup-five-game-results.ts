import { isPresent } from './pickup-five-queue';
import { lineupKey, latestWinningRun } from './pickup-five-winning-run';
import { PickupGame, PickupSession, SessionPlayer, TeamSide } from './pickup-five.types';

export function updateFairnessCredits(
  session: PickupSession,
  game: PickupGame,
  winner: TeamSide
): SessionPlayer[] {
  const currentParticipants = new Set([...game.teamA, ...game.teamB]);
  const creditedTeamA = game.creditedTeamA ?? game.teamA;
  const creditedTeamB = game.creditedTeamB ?? game.teamB;
  const creditedParticipants = new Set([...creditedTeamA, ...creditedTeamB]);
  const partialParticipants = new Set([...currentParticipants]
    .filter((playerId) => !creditedParticipants.has(playerId)));
  const presentCount = session.players.filter(isPresent).length;
  if (presentCount < 10) throw new Error('A completed 5v5 game requires ten present players.');
  const creditShare = 10 / presentCount;

  return session.players.map((player) => {
    const playedFullGame = creditedParticipants.has(player.playerId);
    const playedPartialGame = partialParticipants.has(player.playerId);
    if (!isPresent(player) && !playedFullGame) return player;
    if (playedPartialGame) {
      const won = (winner === 'A' ? game.teamA : game.teamB).includes(player.playerId);
      return {
        ...player,
        state: 'WAITING',
        fairnessCredit: player.fairnessCredit + creditShare,
        lastResult: won ? 'WIN' : 'LOSS',
        lastGameId: game.id
      };
    }
    if (!playedFullGame) {
      return {
        ...player,
        fairnessCredit: player.fairnessCredit + creditShare,
        consecutiveGamesSat: player.consecutiveGamesSat + 1
      };
    }

    const won = (winner === 'A' ? creditedTeamA : creditedTeamB).includes(player.playerId);
    return {
      ...player,
      state: player.state === 'CHECKED_OUT' ? 'CHECKED_OUT' : 'WAITING',
      fairnessCredit: player.fairnessCredit + creditShare - 1,
      consecutiveGamesSat: 0,
      gamesPlayed: player.gamesPlayed + 1,
      wins: player.wins + (won ? 1 : 0),
      losses: player.losses + (won ? 0 : 1),
      lastResult: won ? 'WIN' : 'LOSS',
      lastGameId: game.id
    };
  });
}

export function recordGameResult(
  session: PickupSession,
  gameId: string,
  winner: TeamSide,
  now: string
): { session: PickupSession; applied: boolean } {
  const game = session.games.find((candidate) => candidate.id === gameId);
  if (!game || game.status === 'COMPLETED' || game.fairnessApplied) {
    return { session, applied: false };
  }
  if (game.status !== 'IN_PROGRESS' && game.status !== 'LOCKED') {
    throw new Error('Only a started game can receive a result.');
  }
  if (new Set([...game.teamA, ...game.teamB]).size !== 10) {
    throw new Error('A result requires ten distinct players.');
  }

  const priorRun = latestWinningRun(session.games.filter((candidate) => candidate.id !== gameId));
  const winningPlayers = winner === 'A' ? game.teamA : game.teamB;
  const winnerStreak = priorRun && lineupKey(priorRun.playerIds) === lineupKey(winningPlayers)
    ? priorRun.consecutiveWins + 1
    : 1;
  const players = updateFairnessCredits(session, game, winner);
  const games = session.games.map((candidate) => candidate.id === gameId
    ? {
      ...candidate,
      status: 'COMPLETED' as const,
      winner,
      winnerStreak,
      fairnessApplied: true,
      completedAt: now
    }
    : candidate);

  return {
    applied: true,
    session: {
      ...session,
      players,
      games,
      tieBreakCursor: (session.tieBreakCursor + 1) % Math.max(session.nextTieBreakOrder, 1),
      updatedAt: now
    }
  };
}
