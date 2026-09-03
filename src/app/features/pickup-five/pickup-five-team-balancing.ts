import {
  SESSION_STRENGTH_FULL_WEIGHT_GAMES,
  SESSION_STRENGTH_MAX_WEIGHT,
  TEAM_BUILDING_WEIGHTS
} from './pickup-five.constants';
import { PickupGame, PickupSession, PlayerProfile, TeamBalanceResult, TeamSide } from './pickup-five.types';
import { latestWinningRun } from './pickup-five-winning-run';

export { TEAM_BUILDING_WEIGHTS } from './pickup-five.constants';

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

function startedTeam(game: PickupGame, team: TeamSide): string[] {
  return team === 'A' ? game.creditedTeamA ?? game.teamA : game.creditedTeamB ?? game.teamB;
}

function teammatePairs(team: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let left = 0; left < team.length; left += 1) {
    for (let right = left + 1; right < team.length; right += 1) pairs.push([team[left], team[right]]);
  }
  return pairs;
}

function pairKey(left: string, right: string): string {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
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
