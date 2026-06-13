export type GameStatus = 'scheduled' | 'live' | 'final';

export interface TeamSummary {
  id: number;
  city: string;
  name: string;
  code: string;
  wins: number;
  losses: number;
  score: number;
  color: string;
  periods: number[];
}

export interface NbaGame {
  id: string;
  status: GameStatus;
  statusText: string;
  period: number;
  clock: string;
  startTimeUtc: string;
  label: string;
  seriesText: string;
  awayTeam: TeamSummary;
  homeTeam: TeamSummary;
}

export interface Scoreboard {
  gameDate: string;
  games: NbaGame[];
}

export interface PlayerStats {
  id: number;
  name: string;
  shortName: string;
  jersey: string;
  position: string;
  starter: boolean;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  plusMinus: number;
  fieldGoals: string;
  threePointers: string;
  freeThrows: string;
}

export interface BoxScoreTeam {
  id: number;
  city: string;
  name: string;
  code: string;
  score: number;
  color: string;
  players: PlayerStats[];
  totals: {
    points: number;
    rebounds: number;
    assists: number;
    fieldGoals: string;
    threePointers: string;
    freeThrows: string;
  };
}

export interface BoxScore {
  gameId: string;
  statusText: string;
  arena: string;
  awayTeam: BoxScoreTeam;
  homeTeam: BoxScoreTeam;
}

export interface BoxScoreState {
  data: BoxScore | null;
  loading: boolean;
  error: string | null;
}
