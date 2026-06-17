import { FifaEvent, FifaMatch, FifaMatchDetails, FifaMatchStatus, FifaPlayer, FifaScoreboard, FifaTeam } from './fifa.models';

interface LocalizedText {
  Description?: string;
}

interface RawFifaTeam {
  Score?: number;
  IdTeam?: string;
  IdCountry?: string;
  Tactics?: string;
  TeamName?: LocalizedText[];
  Abbreviation?: string;
  ShortClubName?: string;
  Players?: RawFifaPlayer[];
  Goals?: RawFifaEvent[];
  Bookings?: RawFifaEvent[];
  Substitutions?: RawFifaSubstitution[];
}

interface RawFifaPlayer {
  IdPlayer?: string;
  ShirtNumber?: number;
  Captain?: boolean;
  PlayerName?: LocalizedText[];
  ShortName?: LocalizedText[];
  Position?: number;
  Status?: number;
}

interface RawFifaEvent {
  Minute?: string;
  IdPlayer?: string;
  IdTeam?: string;
  Type?: number;
}

interface RawFifaSubstitution {
  Minute?: string;
  IdTeam?: string;
  PlayerOffName?: LocalizedText[];
  PlayerOnName?: LocalizedText[];
}

interface RawFifaMatch {
  IdMatch?: string;
  Date?: string;
  MatchTime?: string;
  MatchStatus?: number;
  Home?: RawFifaTeam;
  Away?: RawFifaTeam;
  HomeTeam?: RawFifaTeam;
  AwayTeam?: RawFifaTeam;
  HomeTeamScore?: number | null;
  AwayTeamScore?: number | null;
  GroupName?: LocalizedText[];
  StageName?: LocalizedText[];
  Stadium?: {
    Name?: LocalizedText[];
    CityName?: LocalizedText[];
  };
  Attendance?: string;
}

export function normalizeFifaScoreboard(payload: unknown, now = new Date()): FifaScoreboard {
  const root = payload as { Results?: RawFifaMatch[]; matchDate?: string };
  const matchDate = root.matchDate ?? localDateKey(now);
  const matches = (root.Results ?? [])
    .map((match) => normalizeFifaMatch(match, now))
    .filter((match) => Boolean(match.id))
    .filter((match) => localDateKey(new Date(match.startTimeUtc)) === matchDate)
    .sort((left, right) => left.startTimeUtc.localeCompare(right.startTimeUtc));

  return {
    matchDate,
    matches
  };
}

export function normalizeFifaMatchDetails(payload: unknown, now = new Date()): FifaMatchDetails {
  const match = payload as RawFifaMatch;
  const home = normalizeTeam(match.HomeTeam ?? match.Home);
  const away = normalizeTeam(match.AwayTeam ?? match.Away);
  const playerLookup = new Map<string, string>();

  for (const player of [...normalizePlayers(match.HomeTeam ?? match.Home), ...normalizePlayers(match.AwayTeam ?? match.Away)]) {
    playerLookup.set(player.id, player.shortName || player.name);
  }

  return {
    id: match.IdMatch ?? '',
    statusText: statusText(match, now),
    venue: text(match.Stadium?.Name),
    city: text(match.Stadium?.CityName),
    attendance: match.Attendance ?? '',
    homeTeam: {
      ...home,
      tactics: match.HomeTeam?.Tactics ?? match.Home?.Tactics ?? '',
      players: normalizePlayers(match.HomeTeam ?? match.Home)
    },
    awayTeam: {
      ...away,
      tactics: match.AwayTeam?.Tactics ?? match.Away?.Tactics ?? '',
      players: normalizePlayers(match.AwayTeam ?? match.Away)
    },
    goals: [
      ...normalizeEvents(match.HomeTeam?.Goals, home.code, playerLookup, goalType),
      ...normalizeEvents(match.AwayTeam?.Goals, away.code, playerLookup, goalType)
    ].sort(sortEvents),
    bookings: [
      ...normalizeEvents(match.HomeTeam?.Bookings, home.code, playerLookup, bookingType),
      ...normalizeEvents(match.AwayTeam?.Bookings, away.code, playerLookup, bookingType)
    ].sort(sortEvents),
    substitutions: [
      ...normalizeSubstitutions(match.HomeTeam?.Substitutions, home.code),
      ...normalizeSubstitutions(match.AwayTeam?.Substitutions, away.code)
    ].sort(sortEvents)
  };
}

export function formatFifaDate(value?: string, today = new Date()): string {
  if (!value) {
    return 'Today';
  }

  const selected = parseDateKey(value);
  const current = parseDateKey(localDateKey(today));
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
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(selected);
}

export function formatFifaKickoff(value: string): string {
  if (!value) {
    return 'Time TBD';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(new Date(value));
}

function normalizeFifaMatch(match: RawFifaMatch, now: Date): FifaMatch {
  return {
    id: match.IdMatch ?? '',
    status: matchStatus(match, now),
    statusText: statusText(match, now),
    startTimeUtc: match.Date ?? '',
    matchTime: match.MatchTime ?? '',
    group: text(match.GroupName),
    stage: text(match.StageName),
    venue: text(match.Stadium?.Name),
    city: text(match.Stadium?.CityName),
    attendance: match.Attendance ?? '',
    homeTeam: normalizeTeam(match.HomeTeam ?? match.Home),
    awayTeam: normalizeTeam(match.AwayTeam ?? match.Away)
  };
}

function normalizeTeam(team?: RawFifaTeam): FifaTeam {
  return {
    id: team?.IdTeam ?? '',
    name: text(team?.TeamName) || (team?.ShortClubName ?? ''),
    code: team?.Abbreviation ?? team?.IdCountry ?? '',
    score: typeof team?.Score === 'number' ? team.Score : null
  };
}

function normalizePlayers(team?: RawFifaTeam): FifaPlayer[] {
  return (team?.Players ?? []).map((player) => ({
    id: player.IdPlayer ?? '',
    name: text(player.PlayerName),
    shortName: text(player.ShortName) || text(player.PlayerName),
    shirtNumber: String(player.ShirtNumber ?? ''),
    position: positionName(player.Position),
    starter: player.Status === 1,
    captain: Boolean(player.Captain)
  }));
}

function normalizeEvents(
  events: RawFifaEvent[] | undefined,
  teamCode: string,
  playerLookup: Map<string, string>,
  detailMapper: (type?: number) => string
): FifaEvent[] {
  return (events ?? []).map((event) => ({
    minute: event.Minute ?? '',
    teamCode,
    player: playerLookup.get(event.IdPlayer ?? '') ?? 'Unknown player',
    detail: detailMapper(event.Type)
  }));
}

function normalizeSubstitutions(events: RawFifaSubstitution[] | undefined, teamCode: string): FifaEvent[] {
  return (events ?? []).map((event) => ({
    minute: event.Minute ?? '',
    teamCode,
    player: text(event.PlayerOnName),
    detail: `On for ${text(event.PlayerOffName) || 'teammate'}`
  }));
}

function matchStatus(match: RawFifaMatch, now: Date): FifaMatchStatus {
  const kickoff = match.Date ? new Date(match.Date) : null;
  const hasScore = typeof (match.HomeTeam ?? match.Home)?.Score === 'number' || typeof match.HomeTeamScore === 'number';

  if (kickoff && kickoff.getTime() > now.getTime() && !hasScore) {
    return 'scheduled';
  }
  if (match.MatchTime && match.MatchStatus !== 0) {
    return 'live';
  }
  return hasScore ? 'final' : 'scheduled';
}

function statusText(match: RawFifaMatch, now: Date): string {
  const status = matchStatus(match, now);
  if (status === 'scheduled') {
    return formatFifaKickoff(match.Date ?? '');
  }
  if (status === 'live') {
    return match.MatchTime || 'Live';
  }
  return 'Final';
}

function text(values?: LocalizedText[]): string {
  return values?.[0]?.Description ?? '';
}

function localDateKey(date: Date): string {
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

export function browserDateKey(date = new Date()): string {
  return localDateKey(date);
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function positionName(position?: number): string {
  return ['GK', 'DF', 'MF', 'FW'][position ?? -1] ?? '';
}

function goalType(type?: number): string {
  if (type === 1) {
    return 'Own goal';
  }
  if (type === 3) {
    return 'Penalty';
  }
  return 'Goal';
}

function bookingType(type?: number): string {
  return type === 2 ? 'Red card' : 'Yellow card';
}

function sortEvents(left: FifaEvent, right: FifaEvent): number {
  return parseMinute(left.minute) - parseMinute(right.minute);
}

function parseMinute(value: string): number {
  return Number.parseInt(value, 10) || 0;
}
