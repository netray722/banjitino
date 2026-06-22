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
  logoUrl?: string;
}

export interface NbaGame {
  id: string;
  source: 'nba' | 'espn';
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

export type NbaConference = 'East' | 'West';

export interface NbaStanding {
  teamId: number;
  teamCode: string;
  conference: NbaConference;
  seed: number;
  wins: number;
  losses: number;
  winPercentage: number;
  gamesBehind: number;
}

export type NbaStandingsLookup = Record<string, NbaStanding>;

export interface NbaTradeEntry {
  id: string;
  date: string;
  season: string;
  teamId: number;
  teamCode: string;
  teamName: string;
  teamLogoUrl: string;
  description: string;
}

export type NbaTradeAssetKind = 'player' | 'pick' | 'cash' | 'consideration';

export interface NbaTradeAsset {
  id: string;
  kind: NbaTradeAssetKind;
  label: string;
  playerName?: string;
  position?: string;
}

export interface NbaTradePlayer extends NbaTradeAsset {
  kind: 'player';
  playerName: string;
}

export interface NbaTradePick extends NbaTradeAsset {
  kind: 'pick';
}

export interface NbaTradeTeam {
  id: number;
  code: string;
  name: string;
  logoUrl: string;
  received: NbaTradeAsset[];
  sent: NbaTradeAsset[];
  sourceNotes: string[];
}

export interface NbaTradeGroup {
  id: string;
  date: string;
  season: string;
  teams: NbaTradeTeam[];
  playerNames: string[];
  sourceNotes: string[];
  combined: boolean;
}

export interface NbaTradeMovement {
  reporterTeamCode: string;
  fromTeamCode: string;
  toTeamCode: string;
  assets: NbaTradeAsset[];
}

export interface NbaPlayerSeasonSummary {
  id: string;
  name: string;
  season: string;
  position: string;
  headshotUrl: string;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
}

export interface NbaPlayerSearchMatch {
  id: string;
  name: string;
  headshotUrl: string;
}

export interface NbaPlayerEnrichmentState {
  data: Record<string, NbaPlayerSeasonSummary>;
  loading: boolean;
  error: string | null;
}

export interface NbaPlayerSummaryBatch {
  data: Record<string, NbaPlayerSeasonSummary>;
  failedNames: string[];
}

export interface NbaTradePage {
  season: string;
  page: number;
  pageCount: number;
  trades: NbaTradeEntry[];
}
