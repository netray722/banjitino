export interface LocalizedText { Description?: string; }

export interface RawFifaTeam {
  Score?: number; IdTeam?: string; IdCountry?: string; Tactics?: string; TeamName?: LocalizedText[];
  PenaltyScore?: number | string | null; ShootoutScore?: number | string | null;
  Abbreviation?: string; ShortClubName?: string; Players?: RawFifaPlayer[]; Goals?: RawFifaEvent[];
  Bookings?: RawFifaEvent[]; Substitutions?: RawFifaSubstitution[]; Statistics?: unknown; MatchStatistics?: unknown;
}

export interface RawFifaPlayer {
  IdPlayer?: string; ShirtNumber?: number; Captain?: boolean; PlayerName?: LocalizedText[];
  ShortName?: LocalizedText[]; Position?: number; Status?: number;
}

export interface RawFifaEvent { Minute?: string; IdPlayer?: string; IdTeam?: string; Type?: number; }
export interface RawFifaSubstitution { Minute?: string; IdTeam?: string; PlayerOffName?: LocalizedText[]; PlayerOnName?: LocalizedText[]; }
export interface RawFifaOfficial { Name?: LocalizedText[]; NameShort?: LocalizedText[]; OfficialType?: number; TypeLocalized?: LocalizedText[]; }
export interface RawFifaWeather { Humidity?: number | string | null; Temperature?: number | string | null; WindSpeed?: number | string | null; TypeLocalized?: LocalizedText[]; }

export interface RawFifaMatch {
  IdMatch?: string; Date?: string; LocalDate?: string; MatchTime?: string; MatchStatus?: number;
  MatchNumber?: number | string; Period?: number | string; ResultType?: number; Winner?: string;
  Home?: RawFifaTeam; Away?: RawFifaTeam; HomeTeam?: RawFifaTeam; AwayTeam?: RawFifaTeam;
  HomeTeamScore?: number | null; AwayTeamScore?: number | null; GroupName?: LocalizedText[]; StageName?: LocalizedText[];
  HomeTeamPenaltyScore?: number | string | null; AwayTeamPenaltyScore?: number | string | null;
  Stadium?: { Name?: LocalizedText[]; CityName?: LocalizedText[] }; Attendance?: string;
  Officials?: RawFifaOfficial | RawFifaOfficial[]; Weather?: RawFifaWeather; Statistics?: unknown;
  MatchStatistics?: unknown; HomeTeamStatistics?: unknown; AwayTeamStatistics?: unknown;
}

export interface EspnFifaCompetitor {
  homeAway?: 'home' | 'away'; score?: string; shootoutScore?: string; penaltyScore?: string;
  team?: { id?: string; abbreviation?: string; displayName?: string; name?: string };
}

export interface EspnSummaryTeam extends EspnFifaCompetitor {
  statistics?: Array<{ name?: string; displayValue?: string }>;
}

export interface EspnSummaryEvent {
  scoringPlay?: boolean; clock?: { displayValue?: string }; type?: { text?: string; type?: string };
  team?: { id?: string; abbreviation?: string; displayName?: string };
  participants?: Array<{ athlete?: { displayName?: string } }>;
}

export interface FifaScoreboardPayload { Results?: RawFifaMatch[]; matchDate?: string; }

export interface EspnFifaScoreboardPayload {
  matchDate?: string;
  events?: Array<{
    id?: string; date?: string; season?: { slug?: string };
    competitions?: Array<{
      altGameNote?: string; competitors?: EspnFifaCompetitor[];
      status?: { displayClock?: string; type?: { state?: string; shortDetail?: string } };
      venue?: { fullName?: string; address?: { city?: string } };
    }>;
  }>;
}

export interface EspnRoster {
  homeAway?: 'home' | 'away';
  formation?: string;
  team?: { id?: string; abbreviation?: string; displayName?: string; name?: string };
}

export interface EspnFifaMatchDetailsPayload {
  header?: {
    id?: string; season?: { type?: { name?: string } };
    competitions?: Array<{
      date?: string; altGameNote?: string; status?: { type?: { shortDetail?: string } };
      competitors?: EspnSummaryTeam[]; details?: EspnSummaryEvent[];
    }>;
  };
  boxscore?: { teams?: EspnSummaryTeam[] };
  rosters?: EspnRoster[];
  gameInfo?: {
    venue?: { fullName?: string; address?: { city?: string } }; attendance?: number;
    officials?: Array<{ displayName?: string; position?: { name?: string } }>;
  };
  keyEvents?: EspnSummaryEvent[];
}

export interface StatValues { home: unknown; away: unknown; }

export interface EspnStandingStat {
  name?: string;
  value?: number;
  displayValue?: string;
}

export interface EspnStandingEntry {
  team?: {
    id?: string;
    abbreviation?: string;
  };
  note?: {
    rank?: number;
  };
  stats?: EspnStandingStat[];
}

export interface EspnStandingsPayload {
  children?: Array<{
    name?: string;
    standings?: {
      entries?: EspnStandingEntry[];
    };
  }>;
}
