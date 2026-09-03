import {
  buildTeams,
  checkInPlayer,
  checkOutPlayer,
  recordGameResult,
  selectNextPlayers,
  selectPlayersForGame,
  substitutePlayer,
  updateTeammateHistory
} from './pickup-five-scheduling';
import { createId } from './pickup-five-state.factory';
import { PickupGame, PickupSession, PlayerProfile } from './pickup-five.types';

export function startPickupSession(
  session: PickupSession,
  profiles: PlayerProfile[],
  sessionHistory: PickupSession[],
  now: string
): PickupSession {
  if (session.status !== 'DRAFT' && session.status !== 'CHECK_IN') {
    throw new Error('This session has already started.');
  }
  const active = { ...session, status: 'ACTIVE' as const, updatedAt: now };
  const proposed = proposeGameIfPossible(active, profiles, sessionHistory, now);
  if (proposed === active) throw new Error('Ten waiting players are required to start the first game.');
  return proposed;
}

export function endPickupSession(session: PickupSession, now: string): PickupSession {
  return {
    ...session,
    status: 'ENDED',
    players: session.players.map((player) => ({ ...player, state: 'CHECKED_OUT' as const })),
    games: session.games.map((game) => game.status === 'PROPOSED'
      || game.status === 'IN_PROGRESS'
      || game.status === 'LOCKED'
      ? { ...game, status: 'CANCELLED' as const }
      : game),
    updatedAt: now
  };
}

export function checkPlayerIn(session: PickupSession, playerId: string, now: string): PickupSession {
  if (session.status !== 'DRAFT' && session.status !== 'CHECK_IN' && session.status !== 'ACTIVE') {
    throw new Error('Check-in is not open for this session.');
  }
  return checkInPlayer(session, playerId, now);
}

export function checkPlayerOut(session: PickupSession, playerId: string, now: string): PickupSession {
  const game = findLatestGame(session.games, (candidate) =>
    (candidate.status === 'PROPOSED' || candidate.status === 'IN_PROGRESS')
    && [...candidate.teamA, ...candidate.teamB].includes(playerId));
  if (!game) return checkOutPlayer(session, playerId, now);

  const incomingPlayerId = replacementCandidate(session, game);
  if (!incomingPlayerId) throw new Error('No waiting player is available to substitute in.');
  return substitutePlayer(session, game.id, playerId, incomingPlayerId, 'CHECKED_OUT', now);
}

export function replacePlayerInGame(session: PickupSession, playerId: string, now: string): PickupSession {
  const game = findLatestGame(session.games, (candidate) =>
    (candidate.status === 'PROPOSED' || candidate.status === 'IN_PROGRESS')
    && [...candidate.teamA, ...candidate.teamB].includes(playerId));
  if (!game) throw new Error('That player is not in the current game.');
  const incomingPlayerId = replacementCandidate(session, game);
  if (!incomingPlayerId) throw new Error('No waiting player is available to substitute in.');
  return substitutePlayer(session, game.id, playerId, incomingPlayerId, 'WAITING', now);
}

export function generatePickupGame(
  session: PickupSession,
  profiles: PlayerProfile[],
  sessionHistory: PickupSession[],
  now: string
): PickupSession {
  if (session.status !== 'ACTIVE') throw new Error('Start the session before generating a game.');
  if (session.games.some((game) => game.status === 'PROPOSED' || game.status === 'IN_PROGRESS')) {
    throw new Error('Finish or cancel the open game first.');
  }
  const proposed = proposeGameIfPossible(session, profiles, sessionHistory, now);
  if (proposed === session) throw new Error('Ten waiting players are required.');
  return proposed;
}

export function rebalancePickupGame(
  session: PickupSession,
  profiles: PlayerProfile[],
  sessionHistory: PickupSession[],
  now: string
): PickupSession {
  const game = findLatestGame(session.games, (candidate) => candidate.status === 'PROPOSED');
  if (!game) throw new Error('There is no proposed game to rebalance.');
  if (game.stayTeam) throw new Error('The one-win team must stay together unchanged.');
  const balance = buildTeams(
    [...game.teamA, ...game.teamB],
    profiles,
    session,
    sessionHistory,
    game.rebalanceCount + 1
  );
  return {
    ...session,
    games: session.games.map((candidate) => candidate.id === game.id
      ? {
        ...candidate,
        teamA: balance.teamA,
        teamB: balance.teamB,
        rebalanceCount: candidate.rebalanceCount + 1
      }
      : candidate),
    updatedAt: now
  };
}

export function swapGamePlayers(
  session: PickupSession,
  firstPlayerId: string,
  secondPlayerId: string,
  now: string
): PickupSession {
  const game = findLatestGame(session.games, (candidate) => candidate.status === 'PROPOSED');
  if (!game) throw new Error('There is no proposed game to edit.');
  if (game.stayTeam) throw new Error('The one-win team must stay together unchanged.');
  const firstTeam = game.teamA.includes(firstPlayerId) ? 'A' : game.teamB.includes(firstPlayerId) ? 'B' : null;
  const secondTeam = game.teamA.includes(secondPlayerId) ? 'A' : game.teamB.includes(secondPlayerId) ? 'B' : null;
  if (!firstTeam || !secondTeam || firstTeam === secondTeam) {
    throw new Error('Choose one player from each team.');
  }
  const swap = (id: string) => id === firstPlayerId ? secondPlayerId : id === secondPlayerId ? firstPlayerId : id;
  return {
    ...session,
    games: session.games.map((candidate) => candidate.id === game.id
      ? { ...candidate, teamA: game.teamA.map(swap), teamB: game.teamB.map(swap) }
      : candidate),
    updatedAt: now
  };
}

export function startPickupGame(session: PickupSession, now: string): PickupSession {
  const game = findLatestGame(session.games, (candidate) => candidate.status === 'PROPOSED');
  if (!game) throw new Error('Generate a proposed game first.');
  const participants = new Set([...game.teamA, ...game.teamB]);
  if (game.teamA.length !== 5 || game.teamB.length !== 5 || participants.size !== 10) {
    throw new Error('A game must contain exactly two distinct teams of five.');
  }
  const unavailable = session.players.some((player) =>
    participants.has(player.playerId) && player.state !== 'WAITING');
  if (unavailable) throw new Error('A proposed player is no longer waiting. Regenerate the game.');

  const sessionWithHistory = updateTeammateHistory(session, game.teamA, game.teamB);
  return {
    ...sessionWithHistory,
    players: sessionWithHistory.players.map((player) => participants.has(player.playerId)
      ? { ...player, state: 'PLAYING' as const }
      : player),
    games: sessionWithHistory.games.map((candidate) => candidate.id === game.id
      ? {
        ...candidate,
        status: 'IN_PROGRESS' as const,
        creditedTeamA: [...candidate.teamA],
        creditedTeamB: [...candidate.teamB],
        replacements: [],
        startedAt: now
      }
      : candidate),
    updatedAt: now
  };
}

export function recordPickupWinner(
  session: PickupSession,
  winner: 'A' | 'B',
  profiles: PlayerProfile[],
  sessionHistory: PickupSession[],
  now: string
): PickupSession {
  const game = findLatestGame(session.games, (candidate) =>
    candidate.status === 'IN_PROGRESS' || candidate.status === 'LOCKED');
  if (!game) throw new Error('There is no game in progress.');
  const result = recordGameResult(session, game.id, winner, now);
  return result.applied ? proposeGameIfPossible(result.session, profiles, sessionHistory, now) : session;
}

export function cancelPickupProposal(session: PickupSession, now: string): PickupSession {
  const game = findLatestGame(session.games, (candidate) => candidate.status === 'PROPOSED');
  if (!game) throw new Error('There is no proposed game to cancel.');
  return {
    ...session,
    games: session.games.map((candidate) => candidate.id === game.id
      ? { ...candidate, status: 'CANCELLED' as const }
      : candidate),
    updatedAt: now
  };
}

export function proposeGameIfPossible(
  session: PickupSession,
  profiles: PlayerProfile[],
  sessionHistory: PickupSession[],
  now: string
): PickupSession {
  if (session.status !== 'ACTIVE') return session;
  if (session.games.some((game) => game.status === 'PROPOSED' || game.status === 'IN_PROGRESS')) return session;
  const selection = selectPlayersForGame(session);
  if (selection.selectedPlayerIds.length !== 10) return session;
  const stayPlayerIds = new Set(selection.stayTeam?.playerIds ?? []);
  const challengers = selection.selectedPlayerIds.filter((playerId) => !stayPlayerIds.has(playerId));
  const balance = selection.stayTeam
    ? {
      teamA: selection.stayTeam.side === 'A' ? selection.stayTeam.playerIds : challengers,
      teamB: selection.stayTeam.side === 'B' ? selection.stayTeam.playerIds : challengers
    }
    : buildTeams(selection.selectedPlayerIds, profiles, session, sessionHistory);
  const game: PickupGame = {
    id: createId(),
    number: session.games.reduce((highest, candidate) => Math.max(highest, candidate.number), 0) + 1,
    status: 'PROPOSED',
    teamA: balance.teamA,
    teamB: balance.teamB,
    winner: null,
    fairnessApplied: false,
    rebalanceCount: 0,
    stayTeam: selection.stayTeam?.side ?? null,
    winnerStreak: 0,
    createdAt: now,
    startedAt: null,
    completedAt: null
  };
  return { ...session, games: [...session.games, game], updatedAt: now };
}

export function findLatestGame(
  games: PickupGame[],
  predicate: (game: PickupGame) => boolean
): PickupGame | null {
  for (let index = games.length - 1; index >= 0; index -= 1) {
    if (predicate(games[index])) return games[index];
  }
  return null;
}

function replacementCandidate(session: PickupSession, game: PickupGame): string | null {
  const currentPlayers = new Set([
    ...game.teamA,
    ...game.teamB,
    ...(game.creditedTeamA ?? []),
    ...(game.creditedTeamB ?? []),
    ...(game.replacements ?? []).flatMap((replacement) => [
      replacement.outgoingPlayerId,
      replacement.incomingPlayerId
    ])
  ]);
  return selectNextPlayers(session, session.players.length)
    .find((playerId) => !currentPlayers.has(playerId)) ?? null;
}
