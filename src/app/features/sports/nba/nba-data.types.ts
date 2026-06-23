export interface RawTeam {
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

export interface RawStatistics {
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

export interface RawPlayer {
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

export interface RawStatsResultSet {
  name?: string;
  headers?: string[];
  rowSet?: unknown[][];
}

export interface RawEspnCompetitor {
  id?: string;
  homeAway?: 'home' | 'away';
  score?: string;
  team?: { abbreviation?: string; color?: string; id?: string; location?: string; logo?: string; name?: string };
  linescores?: Array<{ value?: number }>;
  record?: string;
  records?: Array<{ summary?: string; type?: string }>;
}

export interface RawEspnBoxTeam {
  homeAway?: 'home' | 'away';
  team?: { id?: string; abbreviation?: string; color?: string; location?: string; name?: string };
  statistics?: Array<{ name?: string; displayValue?: string }>;
}

export interface RawEspnPlayerGroup {
  team?: { id?: string };
  statistics?: RawEspnStatBlock[];
}

export interface RawEspnStatBlock {
  athletes?: RawEspnAthleteStats[];
  keys?: string[];
  totals?: string[];
}

export interface RawEspnAthleteStats {
  athlete?: { displayName?: string; id?: string; jersey?: string; position?: { abbreviation?: string }; shortName?: string };
  didNotPlay?: boolean;
  starter?: boolean;
  stats?: string[];
}

export interface NbaScoreboardPayload {
  scoreboard?: {
    gameDate?: string;
    games?: Array<{
      gameId?: string; gameStatus?: number; gameStatusText?: string; period?: number; gameClock?: string;
      gameTimeUTC?: string; gameLabel?: string; seriesText?: string; awayTeam?: RawTeam; homeTeam?: RawTeam;
    }>;
  };
}

export interface EspnScoreboardPayload {
  day?: { date?: string };
  events?: Array<{
    id?: string; date?: string; name?: string;
    competitions?: Array<{
      competitors?: RawEspnCompetitor[]; notes?: Array<{ headline?: string }>;
      status?: { displayClock?: string; period?: number; type?: { id?: string; completed?: boolean; detail?: string; shortDetail?: string } };
    }>;
  }>;
}

export interface StatsScoreboardPayload { resultSets?: RawStatsResultSet[]; }

export interface NbaBoxScorePayload {
  game?: {
    gameId?: string; gameStatusText?: string; arena?: { arenaName?: string };
    awayTeam?: RawTeam; homeTeam?: RawTeam;
  };
}

export interface EspnBoxScorePayload {
  boxscore?: { teams?: RawEspnBoxTeam[]; players?: RawEspnPlayerGroup[] };
  gameInfo?: { venue?: { fullName?: string } };
  header?: {
    competitions?: Array<{ competitors?: RawEspnCompetitor[]; status?: { type?: { shortDetail?: string; detail?: string } } }>;
    id?: string;
  };
}

export interface EspnStandingStat {
  name?: string;
  value?: number;
  displayValue?: string;
}

export interface EspnStandingEntry {
  team?: { id?: string; abbreviation?: string };
  stats?: EspnStandingStat[];
}

export interface EspnStandingsPayload {
  children?: Array<{
    name?: string;
    abbreviation?: string;
    standings?: { entries?: EspnStandingEntry[] };
  }>;
}
