import {
  PickupGame,
  PickupSession,
  SessionPlayer,
  StayTeam,
  TeamSelectionResult
} from './pickup-five.types';
import { latestWinningRun } from './pickup-five-winning-run';

export const WINNER_BONUS = 0.15;

const PRESENT_STATES = new Set(['WAITING', 'PLAYING', 'LEAVING_AFTER_GAME']);

export function isPresent(player: SessionPlayer): boolean {
  return PRESENT_STATES.has(player.state);
}

export function checkInPlayer(session: PickupSession, playerId: string, now: string): PickupSession {
  const existing = session.players.find((player) => player.playerId === playerId);
  if (existing && isPresent(existing)) return session;

  const players = existing
    ? session.players.map((player) => player.playerId === playerId
      ? { ...player, state: 'WAITING' as const, checkedInAt: now }
      : player)
    : [...session.players, {
      playerId,
      state: 'WAITING' as const,
      fairnessCredit: 0,
      consecutiveGamesSat: 0,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      lastResult: null,
      lastGameId: null,
      tieBreakOrder: session.nextTieBreakOrder,
      checkedInAt: now
    }];

  return {
    ...session,
    players,
    nextTieBreakOrder: existing ? session.nextTieBreakOrder : session.nextTieBreakOrder + 1,
    updatedAt: now
  };
}

export function checkOutPlayer(session: PickupSession, playerId: string, now: string): PickupSession {
  const players = session.players.map((player) => player.playerId === playerId
    ? { ...player, state: 'CHECKED_OUT' as const }
    : player);
  return { ...session, players, updatedAt: now };
}

export function substitutePlayer(
  session: PickupSession,
  gameId: string,
  outgoingPlayerId: string,
  incomingPlayerId: string,
  outgoingState: 'WAITING' | 'CHECKED_OUT',
  now: string
): PickupSession {
  const game = session.games.find((candidate) => candidate.id === gameId);
  if (!game || game.status !== 'PROPOSED' && game.status !== 'IN_PROGRESS') {
    throw new Error('Only a proposed or active game can replace a player.');
  }
  const team: 'A' | 'B' | null = game.teamA.includes(outgoingPlayerId) ? 'A'
    : game.teamB.includes(outgoingPlayerId) ? 'B'
    : null;
  if (!team) throw new Error('That player is not in the current game.');
  if ([...game.teamA, ...game.teamB].includes(incomingPlayerId)) {
    throw new Error('The replacement is already in the game.');
  }
  const incoming = session.players.find((player) => player.playerId === incomingPlayerId);
  if (incoming?.state !== 'WAITING') throw new Error('The replacement must be first in the waiting queue.');

  const inProgress = game.status === 'IN_PROGRESS';
  const players = session.players.map((player) => {
    if (player.playerId === outgoingPlayerId) return { ...player, state: outgoingState };
    if (inProgress && player.playerId === incomingPlayerId) return { ...player, state: 'PLAYING' as const };
    return player;
  });
  const replace = (ids: string[]) => ids.map((id) => id === outgoingPlayerId ? incomingPlayerId : id);
  const replacements = [
    ...(game.replacements ?? []),
    { outgoingPlayerId, incomingPlayerId, team, createdAt: now }
  ];

  return {
    ...session,
    players,
    games: session.games.map((candidate) => candidate.id === gameId
      ? {
        ...candidate,
        teamA: replace(candidate.teamA),
        teamB: replace(candidate.teamB),
        stayTeam: candidate.stayTeam === team ? null : candidate.stayTeam,
        replacements
      }
      : candidate),
    updatedAt: now
  };
}

export function rankWaitingPlayers(session: PickupSession, excludedPlayerIds: string[] = []): SessionPlayer[] {
  const excluded = new Set(excludedPlayerIds);
  const rotationSize = Math.max(session.nextTieBreakOrder, 1);

  return session.players
    .filter((player) => player.state === 'WAITING' && !excluded.has(player.playerId))
    .sort((left, right) =>
      right.consecutiveGamesSat - left.consecutiveGamesSat
      || right.fairnessCredit - left.fairnessCredit
      || winnerScore(right) - winnerScore(left)
      || rotatingRank(left, session.tieBreakCursor, rotationSize)
        - rotatingRank(right, session.tieBreakCursor, rotationSize)
      || left.playerId.localeCompare(right.playerId));
}

export function selectNextPlayers(session: PickupSession, limit = 10): string[] {
  return rankWaitingPlayers(session).slice(0, limit).map((player) => player.playerId);
}

export function selectPlayersForGame(session: PickupSession): TeamSelectionResult {
  const stayTeam = getStayTeam(session.games);
  if (stayTeam && stayTeam.playerIds.every((playerId) =>
    session.players.some((player) => player.playerId === playerId && player.state === 'WAITING'))) {
    const challengers = rankWaitingPlayers(session, stayTeam.playerIds).slice(0, 5);
    if (challengers.length === 5) {
      return {
        selectedPlayerIds: [...stayTeam.playerIds, ...challengers.map((player) => player.playerId)],
        stayTeam
      };
    }
  }

  return { selectedPlayerIds: selectNextPlayers(session), stayTeam: null };
}

export function getStayTeam(gameHistory: PickupGame[]): StayTeam | null {
  const run = latestWinningRun(gameHistory);
  return run?.consecutiveWins === 1 ? run : null;
}

function winnerScore(player: SessionPlayer): number {
  return player.lastResult === 'WIN' ? WINNER_BONUS : 0;
}

function rotatingRank(player: SessionPlayer, cursor: number, size: number): number {
  return (player.tieBreakOrder - cursor + size) % size;
}
