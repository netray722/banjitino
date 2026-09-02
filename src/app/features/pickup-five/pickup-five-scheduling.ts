import {
  PickupGame,
  PickupSession,
  PlayerProfile,
  PlayerRole,
  SessionPlayer,
  TeamBalanceResult
} from './pickup-five.types';

export const TEAM_BALANCING_WEIGHTS = {
  guardDifference: 40,
  wingDifference: 40,
  bigDifference: 40,
  recentTeammateRepeat: 0.8,
  recentOpponentRepeat: 0.35
} as const;

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
        replacements
      }
      : candidate),
    updatedAt: now
  };
}

export function selectNextPlayers(session: PickupSession, limit = 10): string[] {
  const waiting = session.players.filter((player) => player.state === 'WAITING');
  const rotationSize = Math.max(session.nextTieBreakOrder, 1);

  return waiting
    .sort((left, right) =>
      right.consecutiveGamesSat - left.consecutiveGamesSat
      || right.fairnessCredit - left.fairnessCredit
      || winnerScore(right) - winnerScore(left)
      || rotatingRank(left, session.tieBreakCursor, rotationSize)
        - rotatingRank(right, session.tieBreakCursor, rotationSize)
      || left.playerId.localeCompare(right.playerId))
    .slice(0, limit)
    .map((player) => player.playerId);
}

export function balanceTeams(
  selectedPlayerIds: string[],
  profiles: PlayerProfile[],
  gameHistory: PickupGame[] = [],
  variant = 0
): TeamBalanceResult {
  const uniqueIds = [...new Set(selectedPlayerIds)];
  if (uniqueIds.length !== 10) throw new Error('Exactly ten distinct players are required.');

  const profileMap = new Map(profiles.map((player) => [player.id, player]));
  if (uniqueIds.some((id) => !profileMap.has(id))) throw new Error('Every selected player needs a profile.');

  const recentGames = gameHistory.filter((game) => game.status === 'COMPLETED').slice(-5);
  const candidates: TeamBalanceResult[] = [];

  for (const remainingFour of combinations(uniqueIds.slice(1), 4)) {
    const teamA = [uniqueIds[0], ...remainingFour];
    const teamASet = new Set(teamA);
    const teamB = uniqueIds.filter((id) => !teamASet.has(id));
    candidates.push({
      teamA,
      teamB,
      evaluatedSplits: 126,
      score: teamScore(teamA, teamB, profileMap, recentGames)
    });
  }

  candidates.sort((left, right) => left.score - right.score || teamKey(left).localeCompare(teamKey(right)));
  const alternativeCount = Math.min(6, candidates.length);
  return candidates[variant % alternativeCount];
}

export function recordGameResult(
  session: PickupSession,
  gameId: string,
  winner: 'A' | 'B',
  now: string
): { session: PickupSession; applied: boolean } {
  const game = session.games.find((candidate) => candidate.id === gameId);
  if (!game || game.status === 'COMPLETED' || game.fairnessApplied) {
    return { session, applied: false };
  }
  if (game.status !== 'IN_PROGRESS' && game.status !== 'LOCKED') {
    throw new Error('Only a started game can receive a result.');
  }

  const currentParticipants = new Set([...game.teamA, ...game.teamB]);
  if (currentParticipants.size !== 10) throw new Error('A result requires ten distinct players.');
  const creditedTeamA = game.creditedTeamA ?? game.teamA;
  const creditedTeamB = game.creditedTeamB ?? game.teamB;
  const creditedParticipants = new Set([...creditedTeamA, ...creditedTeamB]);
  const partialParticipants = new Set([...currentParticipants]
    .filter((playerId) => !creditedParticipants.has(playerId)));
  const activeCount = session.players.filter(isPresent).length;
  if (activeCount < 10) throw new Error('A completed 5v5 game requires ten present players.');
  const creditShare = 10 / activeCount;

  const players = session.players.map((player) => {
    const playedFullGame = creditedParticipants.has(player.playerId);
    const playedPartialGame = partialParticipants.has(player.playerId);
    if (!isPresent(player) && !playedFullGame) return player;
    if (playedPartialGame) {
      const won = (winner === 'A' ? game.teamA : game.teamB).includes(player.playerId);
      return {
        ...player,
        state: 'WAITING' as const,
        fairnessCredit: player.fairnessCredit + creditShare,
        lastResult: won ? 'WIN' as const : 'LOSS' as const,
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
      state: player.state === 'CHECKED_OUT' ? 'CHECKED_OUT' as const : 'WAITING' as const,
      fairnessCredit: player.fairnessCredit + creditShare - 1,
      consecutiveGamesSat: 0,
      gamesPlayed: player.gamesPlayed + 1,
      wins: player.wins + (won ? 1 : 0),
      losses: player.losses + (won ? 0 : 1),
      lastResult: won ? 'WIN' as const : 'LOSS' as const,
      lastGameId: game.id
    };
  });

  const games = session.games.map((candidate) => candidate.id === gameId
    ? { ...candidate, status: 'COMPLETED' as const, winner, fairnessApplied: true, completedAt: now }
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

function winnerScore(player: SessionPlayer): number {
  return player.lastResult === 'WIN' ? WINNER_BONUS : 0;
}

function rotatingRank(player: SessionPlayer, cursor: number, size: number): number {
  return (player.tieBreakOrder - cursor + size) % size;
}

function combinations<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  const visit = (start: number, selected: T[]): void => {
    if (selected.length === size) {
      result.push(selected);
      return;
    }
    for (let index = start; index <= values.length - (size - selected.length); index += 1) {
      visit(index + 1, [...selected, values[index]]);
    }
  };
  visit(0, []);
  return result;
}

function teamScore(
  teamA: string[],
  teamB: string[],
  profiles: Map<string, PlayerProfile>,
  recentGames: PickupGame[]
): number {
  const guardDifference = Math.abs(roleCount(teamA, profiles, 'Guard') - roleCount(teamB, profiles, 'Guard'));
  const wingDifference = Math.abs(roleCount(teamA, profiles, 'Wing') - roleCount(teamB, profiles, 'Wing'));
  const bigDifference = Math.abs(roleCount(teamA, profiles, 'Big') - roleCount(teamB, profiles, 'Big'));
  const repeats = repeatScore(teamA, teamB, recentGames);

  return guardDifference * TEAM_BALANCING_WEIGHTS.guardDifference
    + wingDifference * TEAM_BALANCING_WEIGHTS.wingDifference
    + bigDifference * TEAM_BALANCING_WEIGHTS.bigDifference
    + repeats.teammates * TEAM_BALANCING_WEIGHTS.recentTeammateRepeat
    + repeats.opponents * TEAM_BALANCING_WEIGHTS.recentOpponentRepeat;
}

function roleCount(team: string[], profiles: Map<string, PlayerProfile>, role: PlayerRole): number {
  return team.filter((id) => profiles.get(id)!.roles.includes(role)).length;
}

function repeatScore(teamA: string[], teamB: string[], games: PickupGame[]): { teammates: number; opponents: number } {
  let teammates = 0;
  let opponents = 0;
  const teamASet = new Set(teamA);

  for (const game of games) {
    const previousA = new Set(game.teamA);
    const previousB = new Set(game.teamB);
    for (let leftIndex = 0; leftIndex < teamA.length + teamB.length; leftIndex += 1) {
      const all = [...teamA, ...teamB];
      for (let rightIndex = leftIndex + 1; rightIndex < all.length; rightIndex += 1) {
        const left = all[leftIndex];
        const right = all[rightIndex];
        const togetherNow = teamASet.has(left) === teamASet.has(right);
        const togetherBefore = previousA.has(left) && previousA.has(right)
          || previousB.has(left) && previousB.has(right);
        const opposedBefore = previousA.has(left) && previousB.has(right)
          || previousB.has(left) && previousA.has(right);
        if (togetherNow && togetherBefore) teammates += 1;
        if (!togetherNow && opposedBefore) opponents += 1;
      }
    }
  }
  return { teammates, opponents };
}

function teamKey(result: TeamBalanceResult): string {
  return `${result.teamA.join(',')}|${result.teamB.join(',')}`;
}
