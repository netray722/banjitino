import {
  PickupGame,
  PickupSession,
  PlayerProfile,
  SessionPlayer,
  StayTeam,
  TeamBalanceResult,
  TeamSelectionResult
} from './pickup-five.types';

export const TEAM_BUILDING_WEIGHTS = {
  strengthImbalance: 1000,
  dominantFive: 5000,
  dominantFour: 1200,
  highWinRateStack: 150,
  teammateRepeat: 6,
  recentTeammate: [18, 8, 3]
} as const;

export const WINNER_BONUS = 0.15;

const PRESENT_STATES = new Set(['WAITING', 'PLAYING', 'LEAVING_AFTER_GAME']);
const SESSION_STRENGTH_MAX_WEIGHT = 0.45;
const SESSION_STRENGTH_FULL_WEIGHT_GAMES = 8;

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

export function estimatePlayerStrength(
  playerId: string,
  currentSession: PickupSession,
  sessionHistory: PickupSession[]
): number {
  let careerGames = 0;
  let careerWins = 0;
  for (const session of sessionHistory) {
    if (session.id === currentSession.id) continue;
    const player = session.players.find((candidate) => candidate.playerId === playerId);
    if (!player) continue;
    careerGames += player.gamesPlayed;
    careerWins += player.wins;
  }

  const current = currentSession.players.find((player) => player.playerId === playerId);
  const currentGames = current?.gamesPlayed ?? 0;
  const currentWins = current?.wins ?? 0;
  const careerRate = careerGames > 0 ? careerWins / careerGames : 0.5;
  const currentRate = (currentWins + 2) / (currentGames + 4);
  const currentWeight = Math.min(currentGames / SESSION_STRENGTH_FULL_WEIGHT_GAMES, 1)
    * SESSION_STRENGTH_MAX_WEIGHT;

  return careerRate * (1 - currentWeight) + currentRate * currentWeight;
}

export function buildTeams(
  selectedPlayerIds: string[],
  profiles: PlayerProfile[],
  currentSession: PickupSession,
  sessionHistory: PickupSession[] = [currentSession],
  variant = 0
): TeamBalanceResult {
  const uniqueIds = [...new Set(selectedPlayerIds)];
  if (uniqueIds.length !== 10) throw new Error('Exactly ten distinct players are required.');

  const profileIds = new Set(profiles.map((player) => player.id));
  if (uniqueIds.some((id) => !profileIds.has(id))) throw new Error('Every selected player needs a profile.');

  const strengths = new Map(uniqueIds.map((playerId) => [
    playerId,
    estimatePlayerStrength(playerId, currentSession, sessionHistory)
  ]));
  const teammateHistory = currentSession.teammateHistory ?? buildTeammateHistory(currentSession.games);
  const recentGames = currentSession.games.filter((game) => Boolean(game.startedAt)).slice(-3);
  const winningRun = latestWinningRun(currentSession.games);
  const dominantTeam = winningRun && winningRun.consecutiveWins >= 2 ? winningRun.playerIds : null;
  const candidates: TeamBalanceResult[] = [];

  for (const remainingFour of combinations(uniqueIds.slice(1), 4)) {
    const teamA = [uniqueIds[0], ...remainingFour];
    const teamASet = new Set(teamA);
    const teamB = uniqueIds.filter((id) => !teamASet.has(id));
    candidates.push({
      teamA,
      teamB,
      evaluatedSplits: 126,
      score: scoreTeamSplit(teamA, teamB, strengths, teammateHistory, recentGames, dominantTeam)
    });
  }

  candidates.sort((left, right) => left.score - right.score || teamKey(left).localeCompare(teamKey(right)));
  return candidates[variant % Math.min(6, candidates.length)];
}

export function scoreTeamSplit(
  teamA: string[],
  teamB: string[],
  strengths: ReadonlyMap<string, number>,
  teammateHistory: Readonly<Record<string, number>>,
  recentGames: PickupGame[],
  dominantTeam: string[] | null
): number {
  const strength = (team: string[]) => team.reduce((sum, playerId) => sum + (strengths.get(playerId) ?? 0.5), 0);
  const strengthImbalance = Math.abs(strength(teamA) - strength(teamB));
  const strongest = [...teamA, ...teamB]
    .sort((left, right) => (strengths.get(right) ?? 0.5) - (strengths.get(left) ?? 0.5))
    .slice(0, 4);
  const strongestOnA = strongest.filter((playerId) => teamA.includes(playerId)).length;
  const highWinRateStack = Math.abs(strongestOnA - (strongest.length - strongestOnA));
  const pairs = [...teammatePairs(teamA), ...teammatePairs(teamB)];
  const teammateRepeats = pairs.reduce((sum, [left, right]) => sum + (teammateHistory[pairKey(left, right)] ?? 0), 0);
  const recentTeammates = [...recentGames].reverse().reduce((total, game, index) => {
    const previousPairs = new Set([
      ...teammatePairs(startedTeam(game, 'A')),
      ...teammatePairs(startedTeam(game, 'B'))
    ].map(([left, right]) => pairKey(left, right)));
    return total + pairs.filter(([left, right]) => previousPairs.has(pairKey(left, right))).length
      * TEAM_BUILDING_WEIGHTS.recentTeammate[index];
  }, 0);
  const dominantOverlap = dominantTeam
    ? Math.max(
      dominantTeam.filter((playerId) => teamA.includes(playerId)).length,
      dominantTeam.filter((playerId) => teamB.includes(playerId)).length
    )
    : 0;
  const dominantPenalty = dominantOverlap === 5 ? TEAM_BUILDING_WEIGHTS.dominantFive
    : dominantOverlap === 4 ? TEAM_BUILDING_WEIGHTS.dominantFour
    : 0;

  return strengthImbalance * TEAM_BUILDING_WEIGHTS.strengthImbalance
    + dominantPenalty
    + highWinRateStack * TEAM_BUILDING_WEIGHTS.highWinRateStack
    + teammateRepeats * TEAM_BUILDING_WEIGHTS.teammateRepeat
    + recentTeammates;
}

export function updateTeammateHistory(
  session: PickupSession,
  teamA: string[],
  teamB: string[]
): PickupSession {
  const teammateHistory = { ...(session.teammateHistory ?? buildTeammateHistory(session.games)) };
  for (const [left, right] of [...teammatePairs(teamA), ...teammatePairs(teamB)]) {
    const key = pairKey(left, right);
    teammateHistory[key] = (teammateHistory[key] ?? 0) + 1;
  }
  return { ...session, teammateHistory };
}

export function updateFairnessCredits(
  session: PickupSession,
  game: PickupGame,
  winner: 'A' | 'B'
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

function latestWinningRun(gameHistory: PickupGame[]): StayTeam | null {
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

function buildTeammateHistory(games: PickupGame[]): Record<string, number> {
  const history: Record<string, number> = {};
  for (const game of games.filter((candidate) => Boolean(candidate.startedAt))) {
    for (const [left, right] of [
      ...teammatePairs(startedTeam(game, 'A')),
      ...teammatePairs(startedTeam(game, 'B'))
    ]) {
      const key = pairKey(left, right);
      history[key] = (history[key] ?? 0) + 1;
    }
  }
  return history;
}

function startedTeam(game: PickupGame, team: 'A' | 'B'): string[] {
  if (team === 'A') return game.creditedTeamA ?? game.teamA;
  return game.creditedTeamB ?? game.teamB;
}

function teammatePairs(team: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let left = 0; left < team.length; left += 1) {
    for (let right = left + 1; right < team.length; right += 1) {
      pairs.push([team[left], team[right]]);
    }
  }
  return pairs;
}

function pairKey(left: string, right: string): string {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function lineupKey(playerIds: string[]): string {
  return [...playerIds].sort().join('|');
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

function teamKey(result: TeamBalanceResult): string {
  return `${result.teamA.join(',')}|${result.teamB.join(',')}`;
}
