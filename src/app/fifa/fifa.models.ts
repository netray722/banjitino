export type FifaMatchStatus = 'scheduled' | 'live' | 'final';

export interface FifaTeam {
  id: string;
  name: string;
  code: string;
  score: number | null;
}

export interface FifaMatch {
  id: string;
  status: FifaMatchStatus;
  statusText: string;
  startTimeUtc: string;
  matchTime: string;
  group: string;
  stage: string;
  venue: string;
  city: string;
  attendance: string;
  homeTeam: FifaTeam;
  awayTeam: FifaTeam;
}

export interface FifaScoreboard {
  matchDate: string;
  matches: FifaMatch[];
}

export interface FifaPlayer {
  id: string;
  name: string;
  shortName: string;
  shirtNumber: string;
  position: string;
  starter: boolean;
  captain: boolean;
}

export interface FifaEvent {
  minute: string;
  teamCode: string;
  player: string;
  detail: string;
}

export interface FifaMatchDetails {
  id: string;
  statusText: string;
  venue: string;
  city: string;
  attendance: string;
  homeTeam: FifaTeam & { tactics: string; players: FifaPlayer[] };
  awayTeam: FifaTeam & { tactics: string; players: FifaPlayer[] };
  goals: FifaEvent[];
  bookings: FifaEvent[];
  substitutions: FifaEvent[];
}

export interface FifaDetailsState {
  data: FifaMatchDetails | null;
  loading: boolean;
  error: string | null;
}
