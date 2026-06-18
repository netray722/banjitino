import { BoxScore, BoxScoreTeam, GameStatus, NbaGame, PlayerStats, Scoreboard, TeamSummary } from '../models/nba.models';

const TEAM_COLORS: Record<string, string> = {
  ATL: '#e03a3e', BKN: '#111111', BOS: '#007a33', CHA: '#1d1160', CHI: '#ce1141',
  CLE: '#860038', DAL: '#00538c', DEN: '#0e2240', DET: '#c8102e', GSW: '#1d428a',
  HOU: '#ce1141', IND: '#002d62', LAC: '#c8102e', LAL: '#552583', MEM: '#5d76a9',
  MIA: '#98002e', MIL: '#00471b', MIN: '#0c2340', NOP: '#0c2340', NYK: '#f58426',
  OKC: '#007ac1', ORL: '#0077c0', PHI: '#006bb6', PHX: '#1d1160', POR: '#e03a3e',
  SAC: '#5a2d81', SAS: '#5f5f5f', TOR: '#ce1141', UTA: '#006435', WAS: '#002b5c'
};

const ESPN_CODE_OVERRIDES: Record<string, string> = {
  GS: 'GSW',
  NY: 'NYK',
  NO: 'NOP',
  SA: 'SAS',
  UTAH: 'UTA',
  WSH: 'WAS'
};

interface RawTeam {
  teamId?: number;
  teamCity?: string;
  teamName?: string;
  teamTricode?: string;
  wins?: number;
  losses?: number;
  score?: number;
  periods?: Array<{ score?: number }>;
  players?: RawPlayer[];
  statistics?: RawStatistics;
}

interface RawStatistics {
  points?: number;
  reboundsTotal?: number;
  assists?: number;
  steals?: number;
  blocks?: number;
  turnovers?: number;
  plusMinusPoints?: number;
  minutes?: string;
  fieldGoalsMade?: number;
  fieldGoalsAttempted?: number;
  threePointersMade?: number;
  threePointersAttempted?: number;
  freeThrowsMade?: number;
  freeThrowsAttempted?: number;
}

interface RawPlayer {
  personId?: number;
  name?: string;
  nameI?: string;
  jerseyNum?: string;
  position?: string;
  starter?: string;
  played?: string;
  order?: number;
  statistics?: RawStatistics;
}

interface RawStatsResultSet {
  name?: string;
  headers?: string[];
  rowSet?: unknown[][];
}

interface RawEspnCompetitor {
  id?: string;
  homeAway?: 'home' | 'away';
  score?: string;
  team?: {
    abbreviation?: string;
    color?: string;
    id?: string;
    location?: string;
    logo?: string;
    name?: string;
  };
  linescores?: Array<{ value?: number }>;
  record?: string;
  records?: Array<{ summary?: string; type?: string }>;
}

export function normalizeScoreboard(payload: unknown): Scoreboard {
  const espnScoreboard = normalizeEspnScoreboard(payload);
  if (espnScoreboard) {
    return espnScoreboard;
  }

  const statsScoreboard = normalizeStatsScoreboard(payload);
  if (statsScoreboard) {
    return statsScoreboard;
  }

  const root = payload as {
    scoreboard?: {
      gameDate?: string;
      games?: Array<{
        gameId?: string;
        gameStatus?: number;
        gameStatusText?: string;
        period?: number;
        gameClock?: string;
        gameTimeUTC?: string;
        gameLabel?: string;
        seriesText?: string;
        awayTeam?: RawTeam;
        homeTeam?: RawTeam;
      }>;
    };
  };
  const scoreboard = root.scoreboard;

  return {
    gameDate: scoreboard?.gameDate ?? '',
    games: (scoreboard?.games ?? [])
      .map((game): NbaGame => ({
        id: game.gameId ?? '',
        source: 'nba',
        status: mapStatus(game.gameStatus),
        statusText: game.gameStatusText ?? 'Scheduled',
        period: game.period ?? 0,
        clock: formatGameClock(game.gameClock),
        startTimeUtc: game.gameTimeUTC ?? '',
        label: game.gameLabel ?? '',
        seriesText: game.seriesText ?? '',
        awayTeam: normalizeTeam(game.awayTeam),
        homeTeam: normalizeTeam(game.homeTeam)
      }))
      .filter((game) => Boolean(game.id))
      .sort((left, right) => left.startTimeUtc.localeCompare(right.startTimeUtc))
  };
}

function normalizeEspnScoreboard(payload: unknown): Scoreboard | null {
  const root = payload as {
    day?: { date?: string };
    events?: Array<{
      id?: string;
      date?: string;
      name?: string;
      competitions?: Array<{
        competitors?: RawEspnCompetitor[];
        notes?: Array<{ headline?: string }>;
        status?: {
          displayClock?: string;
          period?: number;
          type?: {
            id?: string;
            completed?: boolean;
            detail?: string;
            shortDetail?: string;
          };
        };
      }>;
    }>;
  };

  if (!Array.isArray(root.events)) {
    return null;
  }

  return {
    gameDate: statsDateKey(root.day?.date ?? root.events[0]?.date),
    games: root.events
      .map((event): NbaGame => {
        const competition = event.competitions?.[0];
        const competitors = competition?.competitors ?? [];
        const away = competitors.find((competitor) => competitor.homeAway === 'away');
        const home = competitors.find((competitor) => competitor.homeAway === 'home');
        const status = competition?.status;

        return {
          id: event.id ?? '',
          source: 'espn',
          status: espnStatus(status?.type?.id, status?.type?.completed),
          statusText: status?.type?.shortDetail ?? status?.type?.detail ?? 'Scheduled',
          period: status?.period ?? 0,
          clock: status?.displayClock ?? '',
          startTimeUtc: event.date ?? '',
          label: event.name ?? '',
          seriesText: competition?.notes?.[0]?.headline ?? '',
          awayTeam: normalizeEspnTeam(away),
          homeTeam: normalizeEspnTeam(home)
        };
      })
      .filter((game) => Boolean(game.id))
      .sort((left, right) => left.startTimeUtc.localeCompare(right.startTimeUtc))
  };
}

function normalizeEspnTeam(competitor?: RawEspnCompetitor): TeamSummary {
  const code = nbaCode(competitor?.team?.abbreviation ?? '');
  const [wins, losses] = espnRecord(competitor).split('-').map((value) => Number.parseInt(value, 10) || 0);

  return {
    id: Number.parseInt(competitor?.team?.id ?? competitor?.id ?? '0', 10) || 0,
    city: competitor?.team?.location ?? '',
    name: competitor?.team?.name ?? '',
    code,
    wins,
    losses,
    score: Number.parseInt(competitor?.score ?? '0', 10) || 0,
    color: competitor?.team?.color ? `#${competitor.team.color}` : TEAM_COLORS[code] ?? '#4b5563',
    periods: (competitor?.linescores ?? []).map((period) => period.value ?? 0),
    logoUrl: competitor?.team?.logo
  };
}

function nbaCode(code: string): string {
  return ESPN_CODE_OVERRIDES[code] ?? code;
}

function espnRecord(competitor?: RawEspnCompetitor): string {
  return competitor?.records?.find((record) => record.type === 'total')?.summary ?? competitor?.record ?? '0-0';
}

function espnStatus(statusId?: string, completed = false): GameStatus {
  if (completed || statusId === '3') {
    return 'final';
  }
  if (statusId === '2') {
    return 'live';
  }
  return 'scheduled';
}

function normalizeStatsScoreboard(payload: unknown): Scoreboard | null {
  const root = payload as { resultSets?: RawStatsResultSet[] };
  const gameHeader = resultSet(root.resultSets, 'GameHeader');
  const lineScore = resultSet(root.resultSets, 'LineScore');
  if (!gameHeader || !lineScore) {
    return null;
  }

  const games = rows(gameHeader);
  const lines = rows(lineScore);
  const linesByGame = new Map<string, Record<string, unknown>[]>();
  for (const line of lines) {
    const gameId = textValue(line['GAME_ID']);
    linesByGame.set(gameId, [...(linesByGame.get(gameId) ?? []), line]);
  }

  return {
    gameDate: statsDateKey(games[0]?.['GAME_DATE_EST']),
    games: games
      .map((game): NbaGame => {
        const gameId = textValue(game['GAME_ID']);
        const teamLines = linesByGame.get(gameId) ?? [];
        const awayId = numberValue(game['VISITOR_TEAM_ID']);
        const homeId = numberValue(game['HOME_TEAM_ID']);
        const awayTeam = normalizeStatsTeam(teamLines.find((line) => numberValue(line['TEAM_ID']) === awayId));
        const homeTeam = normalizeStatsTeam(teamLines.find((line) => numberValue(line['TEAM_ID']) === homeId));

        return {
          id: gameId,
          source: 'nba',
          status: mapStatus(numberValue(game['GAME_STATUS_ID'])),
          statusText: textValue(game['GAME_STATUS_TEXT']) || 'Scheduled',
          period: numberValue(game['LIVE_PERIOD']),
          clock: textValue(game['LIVE_PC_TIME']),
          startTimeUtc: statsStartTime(game['GAME_DATE_EST'], game['GAME_SEQUENCE']),
          label: '',
          seriesText: '',
          awayTeam,
          homeTeam
        };
      })
      .filter((game) => Boolean(game.id))
      .sort((left, right) => left.startTimeUtc.localeCompare(right.startTimeUtc))
  };
}

function resultSet(resultSets: RawStatsResultSet[] | undefined, name: string): RawStatsResultSet | undefined {
  return resultSets?.find((set) => set.name === name);
}

function rows(resultSet: RawStatsResultSet): Record<string, unknown>[] {
  const headers = resultSet.headers ?? [];
  return (resultSet.rowSet ?? []).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]]))
  );
}

function normalizeStatsTeam(team?: Record<string, unknown>): TeamSummary {
  const code = textValue(team?.['TEAM_ABBREVIATION']);
  const [wins, losses] = textValue(team?.['TEAM_WINS_LOSSES']).split('-').map((value) => Number.parseInt(value, 10) || 0);

  return {
    id: numberValue(team?.['TEAM_ID']),
    city: textValue(team?.['TEAM_CITY_NAME']),
    name: textValue(team?.['TEAM_NICKNAME']),
    code,
    wins,
    losses,
    score: numberValue(team?.['PTS']),
    color: TEAM_COLORS[code] ?? '#4b5563',
    periods: periodScores(team)
  };
}

function periodScores(team?: Record<string, unknown>): number[] {
  if (!team) {
    return [];
  }

  return Object.entries(team)
    .filter(([key, value]) => /^PTS_QTR\d+$/.test(key) && value !== null && value !== undefined)
    .sort(([left], [right]) => Number(left.replace('PTS_QTR', '')) - Number(right.replace('PTS_QTR', '')))
    .map(([, value]) => numberValue(value));
}

function statsDateKey(value: unknown): string {
  const text = textValue(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }
  const [month, day, year] = text.split(/[/-]/);
  return year && month && day ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : '';
}

function statsStartTime(date: unknown, sequence: unknown): string {
  const dateKey = statsDateKey(date);
  const minutes = numberValue(sequence);
  return dateKey ? `${dateKey}T00:${String(minutes).padStart(2, '0')}:00Z` : '';
}

function textValue(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeBoxScore(payload: unknown): BoxScore {
  const espnBoxScore = normalizeEspnBoxScore(payload);
  if (espnBoxScore) {
    return espnBoxScore;
  }

  const root = payload as {
    game?: {
      gameId?: string;
      gameStatusText?: string;
      arena?: { arenaName?: string };
      awayTeam?: RawTeam;
      homeTeam?: RawTeam;
    };
  };
  const game = root.game;

  return {
    gameId: game?.gameId ?? '',
    statusText: game?.gameStatusText ?? '',
    arena: game?.arena?.arenaName ?? '',
    awayTeam: normalizeBoxScoreTeam(game?.awayTeam),
    homeTeam: normalizeBoxScoreTeam(game?.homeTeam)
  };
}

interface RawEspnBoxTeam {
  homeAway?: 'home' | 'away';
  team?: {
    id?: string;
    abbreviation?: string;
    color?: string;
    location?: string;
    name?: string;
  };
  statistics?: Array<{ name?: string; displayValue?: string }>;
}

interface RawEspnPlayerGroup {
  team?: { id?: string };
  statistics?: RawEspnStatBlock[];
}

interface RawEspnStatBlock {
  athletes?: RawEspnAthleteStats[];
  keys?: string[];
  totals?: string[];
}

interface RawEspnAthleteStats {
  athlete?: {
    displayName?: string;
    id?: string;
    jersey?: string;
    position?: { abbreviation?: string };
    shortName?: string;
  };
  didNotPlay?: boolean;
  starter?: boolean;
  stats?: string[];
}

function normalizeEspnBoxScore(payload: unknown): BoxScore | null {
  const root = payload as {
    boxscore?: {
      teams?: RawEspnBoxTeam[];
      players?: RawEspnPlayerGroup[];
    };
    gameInfo?: {
      venue?: { fullName?: string };
    };
    header?: {
      competitions?: Array<{
        competitors?: RawEspnCompetitor[];
        status?: { type?: { shortDetail?: string; detail?: string } };
      }>;
      id?: string;
    };
  };

  if (!root.boxscore?.teams?.length) {
    return null;
  }

  const awayTeam = root.boxscore.teams.find((team) => team.homeAway === 'away');
  const homeTeam = root.boxscore.teams.find((team) => team.homeAway === 'home');
  const competition = root.header?.competitions?.[0];
  const competitors = competition?.competitors ?? [];

  return {
    gameId: root.header?.id ?? '',
    statusText: competition?.status?.type?.shortDetail ?? competition?.status?.type?.detail ?? '',
    arena: root.gameInfo?.venue?.fullName ?? '',
    awayTeam: normalizeEspnBoxScoreTeam(awayTeam, competitors.find((competitor) => competitor.homeAway === 'away'), root.boxscore.players),
    homeTeam: normalizeEspnBoxScoreTeam(homeTeam, competitors.find((competitor) => competitor.homeAway === 'home'), root.boxscore.players)
  };
}

function normalizeEspnBoxScoreTeam(
  boxTeam: RawEspnBoxTeam | undefined,
  competitor: RawEspnCompetitor | undefined,
  playerGroups: RawEspnPlayerGroup[] | undefined
): BoxScoreTeam {
  const code = nbaCode(boxTeam?.team?.abbreviation ?? competitor?.team?.abbreviation ?? '');
  const teamId = boxTeam?.team?.id ?? competitor?.team?.id ?? competitor?.id ?? '0';
  const playerGroup = playerGroups?.find((group) => group.team?.id === teamId);
  const playerStats = playerGroup?.statistics?.[0];

  return {
    id: Number.parseInt(teamId, 10) || 0,
    city: boxTeam?.team?.location ?? competitor?.team?.location ?? '',
    name: boxTeam?.team?.name ?? competitor?.team?.name ?? '',
    code,
    score: Number.parseInt(statDisplay(boxTeam, 'points') || competitor?.score || '0', 10) || 0,
    color: boxTeam?.team?.color ? `#${boxTeam.team.color}` : competitor?.team?.color ? `#${competitor.team.color}` : TEAM_COLORS[code] ?? '#4b5563',
    players: (playerStats?.athletes ?? [])
      .filter((athlete) => !athlete.didNotPlay && athlete.stats?.length)
      .map((athlete) => normalizeEspnPlayer(athlete, playerStats?.keys ?? [])),
    totals: {
      points: Number.parseInt(totalValue(playerStats, 'points') || statDisplay(boxTeam, 'points') || '0', 10) || 0,
      rebounds: Number.parseInt(totalValue(playerStats, 'rebounds') || statDisplay(boxTeam, 'totalRebounds') || '0', 10) || 0,
      assists: Number.parseInt(totalValue(playerStats, 'assists') || statDisplay(boxTeam, 'assists') || '0', 10) || 0,
      fieldGoals: totalValue(playerStats, 'fieldGoalsMade-fieldGoalsAttempted') || statDisplay(boxTeam, 'fieldGoalsMade-fieldGoalsAttempted') || '0-0',
      threePointers: totalValue(playerStats, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted') || statDisplay(boxTeam, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted') || '0-0',
      freeThrows: totalValue(playerStats, 'freeThrowsMade-freeThrowsAttempted') || statDisplay(boxTeam, 'freeThrowsMade-freeThrowsAttempted') || '0-0'
    }
  };
}

function normalizeEspnPlayer(athlete: RawEspnAthleteStats, keys: string[]): PlayerStats {
  const value = (key: string) => statAt(athlete.stats, keys, key);

  return {
    id: Number.parseInt(athlete.athlete?.id ?? '0', 10) || 0,
    name: athlete.athlete?.displayName ?? '',
    shortName: athlete.athlete?.shortName ?? athlete.athlete?.displayName ?? '',
    jersey: athlete.athlete?.jersey ?? '',
    position: athlete.athlete?.position?.abbreviation ?? '',
    starter: Boolean(athlete.starter),
    minutes: value('minutes') || '0',
    points: Number.parseInt(value('points'), 10) || 0,
    rebounds: Number.parseInt(value('rebounds'), 10) || 0,
    assists: Number.parseInt(value('assists'), 10) || 0,
    steals: Number.parseInt(value('steals'), 10) || 0,
    blocks: Number.parseInt(value('blocks'), 10) || 0,
    turnovers: Number.parseInt(value('turnovers'), 10) || 0,
    plusMinus: Number.parseInt(value('plusMinus'), 10) || 0,
    fieldGoals: value('fieldGoalsMade-fieldGoalsAttempted') || '0-0',
    threePointers: value('threePointFieldGoalsMade-threePointFieldGoalsAttempted') || '0-0',
    freeThrows: value('freeThrowsMade-freeThrowsAttempted') || '0-0'
  };
}

function statAt(values: string[] | undefined, keys: string[], key: string): string {
  const index = keys.indexOf(key);
  return index >= 0 ? values?.[index] ?? '' : '';
}

function totalValue(statistics: RawEspnStatBlock | undefined, key: string): string {
  return statAt(statistics?.totals, statistics?.keys ?? [], key);
}

function statDisplay(team: RawEspnBoxTeam | undefined, name: string): string {
  return team?.statistics?.find((statistic) => statistic.name === name)?.displayValue ?? '';
}

export function formatGameClock(clock?: string): string {
  if (!clock) {
    return '';
  }

  const match = /^PT(?:(\d+)M)?([\d.]+)S$/.exec(clock);
  if (!match) {
    return clock;
  }

  const minutes = Number(match[1] ?? 0);
  const seconds = Math.floor(Number(match[2] ?? 0));
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatMinutes(value?: string): string {
  return formatGameClock(value) || '0:00';
}

export function formatGameTime(value: string): string {
  if (!value) {
    return 'Time TBD';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(new Date(value));
}

export function formatGameDate(value?: string, today = new Date()): string {
  if (!value) {
    return 'Today';
  }

  const selected = parseDateKey(value);
  const current = parseDateKey(browserDateKey(today));
  const dayDelta = Math.round((selected.getTime() - current.getTime()) / 86_400_000);

  if (dayDelta === -1) {
    return 'Yesterday';
  }
  if (dayDelta === 0) {
    return 'Today';
  }
  if (dayDelta === 1) {
    return 'Tomorrow';
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(selected);
}

export function browserDateKey(date = new Date()): string {
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function periodLabel(period: number): string {
  if (period <= 0) {
    return '';
  }
  return period <= 4 ? `Q${period}` : `OT${period - 4}`;
}

function mapStatus(status?: number): GameStatus {
  if (status === 2) {
    return 'live';
  }
  if (status === 3) {
    return 'final';
  }
  return 'scheduled';
}

function normalizeTeam(team?: RawTeam): TeamSummary {
  const code = team?.teamTricode ?? '';
  return {
    id: team?.teamId ?? 0,
    city: team?.teamCity ?? '',
    name: team?.teamName ?? '',
    code,
    wins: team?.wins ?? 0,
    losses: team?.losses ?? 0,
    score: team?.score ?? 0,
    color: TEAM_COLORS[code] ?? '#4b5563',
    periods: (team?.periods ?? []).map((period) => period.score ?? 0)
  };
}

function normalizeBoxScoreTeam(team?: RawTeam): BoxScoreTeam {
  const code = team?.teamTricode ?? '';
  const statistics = team?.statistics ?? {};
  const players = (team?.players ?? [])
    .filter((player) => player.played === '1')
    .sort((left, right) => (left.order ?? 99) - (right.order ?? 99))
    .map(normalizePlayer);

  return {
    id: team?.teamId ?? 0,
    city: team?.teamCity ?? '',
    name: team?.teamName ?? '',
    code,
    score: team?.score ?? 0,
    color: TEAM_COLORS[code] ?? '#4b5563',
    players,
    totals: {
      points: statistics.points ?? team?.score ?? 0,
      rebounds: statistics.reboundsTotal ?? 0,
      assists: statistics.assists ?? 0,
      fieldGoals: shootingLine(statistics.fieldGoalsMade, statistics.fieldGoalsAttempted),
      threePointers: shootingLine(statistics.threePointersMade, statistics.threePointersAttempted),
      freeThrows: shootingLine(statistics.freeThrowsMade, statistics.freeThrowsAttempted)
    }
  };
}

function normalizePlayer(player: RawPlayer): PlayerStats {
  const statistics = player.statistics ?? {};
  return {
    id: player.personId ?? 0,
    name: player.name ?? '',
    shortName: player.nameI ?? player.name ?? '',
    jersey: player.jerseyNum ?? '',
    position: player.position ?? '',
    starter: player.starter === '1',
    minutes: formatMinutes(statistics.minutes),
    points: statistics.points ?? 0,
    rebounds: statistics.reboundsTotal ?? 0,
    assists: statistics.assists ?? 0,
    steals: statistics.steals ?? 0,
    blocks: statistics.blocks ?? 0,
    turnovers: statistics.turnovers ?? 0,
    plusMinus: statistics.plusMinusPoints ?? 0,
    fieldGoals: shootingLine(statistics.fieldGoalsMade, statistics.fieldGoalsAttempted),
    threePointers: shootingLine(statistics.threePointersMade, statistics.threePointersAttempted),
    freeThrows: shootingLine(statistics.freeThrowsMade, statistics.freeThrowsAttempted)
  };
}

function shootingLine(made?: number, attempted?: number): string {
  return `${made ?? 0}-${attempted ?? 0}`;
}
