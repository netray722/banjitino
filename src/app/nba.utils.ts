import { BoxScore, BoxScoreTeam, GameStatus, NbaGame, PlayerStats, Scoreboard, TeamSummary } from './nba.models';

const TEAM_COLORS: Record<string, string> = {
  ATL: '#e03a3e', BKN: '#111111', BOS: '#007a33', CHA: '#1d1160', CHI: '#ce1141',
  CLE: '#860038', DAL: '#00538c', DEN: '#0e2240', DET: '#c8102e', GSW: '#1d428a',
  HOU: '#ce1141', IND: '#002d62', LAC: '#c8102e', LAL: '#552583', MEM: '#5d76a9',
  MIA: '#98002e', MIL: '#00471b', MIN: '#0c2340', NOP: '#0c2340', NYK: '#f58426',
  OKC: '#007ac1', ORL: '#0077c0', PHI: '#006bb6', PHX: '#1d1160', POR: '#e03a3e',
  SAC: '#5a2d81', SAS: '#5f5f5f', TOR: '#ce1141', UTA: '#006435', WAS: '#002b5c'
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

export function normalizeScoreboard(payload: unknown): Scoreboard {
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

export function normalizeBoxScore(payload: unknown): BoxScore {
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

export function formatGameDate(value?: string): string {
  if (!value) {
    return 'Today';
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date(`${value}T12:00:00`));
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
