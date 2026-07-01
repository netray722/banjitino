import { ESPN_STAT_DEFINITIONS, STAT_DEFINITIONS } from './fifa-data.constants';
import { EspnFifaCompetitor, EspnFifaMatchDetailsPayload, EspnFifaScoreboardPayload, EspnRoster, EspnStandingEntry, EspnStandingStat, EspnStandingsPayload, EspnSummaryEvent, EspnSummaryTeam, FifaScoreboardPayload, LocalizedText, RawFifaEvent, RawFifaMatch, RawFifaOfficial, RawFifaPlayer, RawFifaSubstitution, RawFifaTeam, RawFifaWeather, StatValues } from './fifa-data.types';
import { FifaEvent, FifaMatch, FifaMatchDetails, FifaMatchFact, FifaMatchStatus, FifaPlayer, FifaScoreboard, FifaStanding, FifaStandingsLookup, FifaTeam, FifaTeamStat } from './fifa.types';

const FIFA_TIME_ZONE = 'America/New_York';

export function normalizeFifaStandings(payload: unknown): FifaStanding[] {
  const root = payload as EspnStandingsPayload;
  return (root.children ?? []).flatMap((group) =>
    (group.standings?.entries ?? []).flatMap((entry) => {
      const teamId = entry.team?.id ?? '';
      const teamCode = entry.team?.abbreviation?.toUpperCase() ?? '';
      if (!teamId && !teamCode) return [];

      return [{
        teamId,
        teamCode,
        group: group.name ?? '',
        rank: standingValue(entry, 'rank') || entry.note?.rank || 0,
        wins: standingValue(entry, 'wins'),
        draws: standingValue(entry, 'ties'),
        losses: standingValue(entry, 'losses'),
        points: standingValue(entry, 'points'),
        goalDifference: standingValue(entry, 'pointDifferential')
      }];
    })
  );
}

export function buildFifaStandingsLookup(standings: FifaStanding[]): FifaStandingsLookup {
  const lookup: Record<string, FifaStanding> = {};
  for (const standing of standings) {
    if (standing.teamId) lookup[`id:${standing.teamId}`] = standing;
    if (standing.teamCode) lookup[`code:${standing.teamCode.toUpperCase()}`] = standing;
  }
  return lookup;
}

export function findFifaStanding(lookup: FifaStandingsLookup, team: FifaTeam): FifaStanding | null {
  return lookup[`id:${team.id}`] ?? lookup[`code:${team.code.toUpperCase()}`] ?? null;
}

function standingValue(entry: EspnStandingEntry, name: string): number {
  const stat = entry.stats?.find((candidate) => candidate.name === name);
  return standingStatNumber(stat);
}

function standingStatNumber(stat: EspnStandingStat | undefined): number {
  if (stat?.value !== undefined && Number.isFinite(stat.value)) return stat.value;
  const parsed = Number.parseFloat(stat?.displayValue?.replace(/[^\d.-]/g, '') ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeFifaScoreboard(payload: unknown, now = new Date()): FifaScoreboard {
  const espnScoreboard = normalizeEspnFifaScoreboard(payload, now);
  if (espnScoreboard) {
    return espnScoreboard;
  }

  const root = payload as FifaScoreboardPayload;
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

function normalizeEspnFifaScoreboard(payload: unknown, now: Date): FifaScoreboard | null {
  const root = payload as EspnFifaScoreboardPayload;
  if (!Array.isArray(root.events)) return null;

  const matchDate = root.matchDate ?? localDateKey(now);
  const matches = root.events.map((event): FifaMatch => {
    const competition = event.competitions?.[0];
    const home = competition?.competitors?.find((team) => team.homeAway === 'home');
    const away = competition?.competitors?.find((team) => team.homeAway === 'away');
    const state = competition?.status?.type?.state;
    const status: FifaMatchStatus = state === 'in' ? 'live' : state === 'post' ? 'final' : 'scheduled';
    const group = competition?.altGameNote?.match(/Group\s+[A-Z]/i)?.[0] ?? '';
    const startTimeUtc = event.date ?? '';
    return {
      id: event.id ?? '',
      status,
      statusText: status === 'scheduled'
        ? formatFifaKickoff(startTimeUtc)
        : status === 'live'
          ? competition?.status?.displayClock || 'Live'
          : 'Final',
      startTimeUtc,
      matchTime: status === 'live' ? competition?.status?.displayClock ?? '' : '',
      group,
      stage: titleCase(event.season?.slug ?? ''),
      venue: competition?.venue?.fullName ?? '',
      city: competition?.venue?.address?.city ?? '',
      attendance: '',
      homeTeam: normalizeEspnFifaTeam(home, status),
      awayTeam: normalizeEspnFifaTeam(away, status)
    };
  }).filter((match) => Boolean(match.id))
    .filter((match) => localDateKey(new Date(match.startTimeUtc)) === matchDate)
    .sort((left, right) => left.startTimeUtc.localeCompare(right.startTimeUtc));

  return { matchDate, matches };
}

function normalizeEspnFifaTeam(competitor: EspnFifaCompetitor | undefined, status: FifaMatchStatus): FifaTeam {
  return {
    id: competitor?.team?.id ?? '',
    name: competitor?.team?.displayName ?? competitor?.team?.name ?? '',
    code: competitor?.team?.abbreviation ?? '',
    score: status === 'scheduled' ? null : Number.parseInt(competitor?.score ?? '0', 10) || 0,
    penaltyScore: status === 'scheduled' ? null : statNumber(competitor?.shootoutScore ?? competitor?.penaltyScore)
  };
}

function titleCase(value: string): string {
  return value.split('-').map((word) => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ');
}

export function normalizeFifaMatchDetails(payload: unknown, now = new Date()): FifaMatchDetails {
  const espnDetails = normalizeEspnFifaMatchDetails(payload);
  if (espnDetails) {
    return espnDetails;
  }

  const match = payload as RawFifaMatch;
  const home = normalizeTeam(match.HomeTeam ?? match.Home, match.HomeTeamPenaltyScore);
  const away = normalizeTeam(match.AwayTeam ?? match.Away, match.AwayTeamPenaltyScore);
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
    facts: normalizeFacts(match, home, away),
    stats: normalizeStats(match),
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

function normalizeEspnFifaMatchDetails(payload: unknown): FifaMatchDetails | null {
  const root = payload as EspnFifaMatchDetailsPayload;
  if (!root.header?.competitions?.length || !root.boxscore?.teams?.length) return null;

  const competition = root.header.competitions[0];
  const headerHome = competition.competitors?.find((team) => team.homeAway === 'home');
  const headerAway = competition.competitors?.find((team) => team.homeAway === 'away');
  const statsHome = root.boxscore.teams.find((team) => team.homeAway === 'home') ?? root.boxscore.teams[0];
  const statsAway = root.boxscore.teams.find((team) => team.homeAway === 'away') ?? root.boxscore.teams[1];
  const home = espnDetailTeam(headerHome ?? statsHome, root.rosters?.find((team) => team.homeAway === 'home') ?? root.rosters?.[0]);
  const away = espnDetailTeam(headerAway ?? statsAway, root.rosters?.find((team) => team.homeAway === 'away') ?? root.rosters?.[1]);
  const teamCodes = new Map([[home.id, home.code], [away.id, away.code]]);
  // ESPN only exposes scoring plays in competition.details. Cards and
  // substitutions live in the top-level keyEvents feed when it is available.
  const events = root.keyEvents?.length ? root.keyEvents : competition.details ?? [];
  const referee = root.gameInfo?.officials?.find((official) => official.position?.name === 'Referee')?.displayName ?? root.gameInfo?.officials?.[0]?.displayName ?? '';
  const group = competition.altGameNote?.match(/Group\s+[A-Z0-9]+/i)?.[0] ?? '';

  return {
    id: root.header.id ?? '',
    statusText: competition.status?.type?.shortDetail ?? '',
    venue: root.gameInfo?.venue?.fullName ?? '',
    city: root.gameInfo?.venue?.address?.city ?? '',
    attendance: root.gameInfo?.attendance ? new Intl.NumberFormat().format(root.gameInfo.attendance) : '',
    homeTeam: home,
    awayTeam: away,
    facts: [
      fact('Stage', root.header.season?.type?.name ?? ''),
      fact('Group', group),
      fact('Referee', referee),
      fact('Kickoff', competition.date ? formatFifaKickoff(competition.date) : '')
    ].filter((item): item is FifaMatchFact => Boolean(item)),
    stats: espnDetailStats(statsHome, statsAway),
    goals: events.filter((event) => event.scoringPlay).map((event) => espnDetailEvent(event, teamCodes)).sort(sortEvents),
    bookings: events.filter((event) => event.type?.type?.includes('card')).map((event) => espnDetailEvent(event, teamCodes)).sort(sortEvents),
    substitutions: events.filter((event) => event.type?.type === 'substitution').map((event) => ({
      minute: event.clock?.displayValue ?? '',
      teamCode: teamCodes.get(event.team?.id ?? '') ?? event.team?.abbreviation ?? '',
      player: event.participants?.[0]?.athlete?.displayName ?? 'Substitution',
      detail: event.participants?.[1]?.athlete?.displayName ? `On for ${event.participants[1].athlete?.displayName}` : 'Substitution'
    })).sort(sortEvents)
  };
}

function espnDetailTeam(team: EspnSummaryTeam | undefined, roster: EspnRoster | undefined): FifaMatchDetails['homeTeam'] {
  const source = team?.team ?? roster?.team;
  return {
    id: source?.id ?? '',
    name: source?.displayName ?? source?.name ?? '',
    code: source?.abbreviation ?? '',
    score: team?.score === undefined ? null : Number.parseInt(team.score, 10) || 0,
    penaltyScore: statNumber(team?.shootoutScore ?? team?.penaltyScore),
    tactics: roster?.formation ?? '',
    players: []
  };
}

function espnDetailEvent(event: EspnSummaryEvent, teamCodes: Map<string, string>): FifaEvent {
  return {
    minute: event.clock?.displayValue ?? '',
    teamCode: teamCodes.get(event.team?.id ?? '') ?? event.team?.abbreviation ?? '',
    player: event.participants?.[0]?.athlete?.displayName ?? 'Unknown player',
    detail: event.type?.text ?? ''
  };
}

function espnDetailStats(home: EspnSummaryTeam | undefined, away: EspnSummaryTeam | undefined): FifaTeamStat[] {
  const value = (team: EspnSummaryTeam | undefined, name: string) => team?.statistics?.find((stat) => stat.name === name)?.displayValue ?? '';
  return ESPN_STAT_DEFINITIONS.flatMap((definition) => {
    const homeValue = value(home, definition.name);
    const awayValue = value(away, definition.name);
    if (!homeValue && !awayValue) return [];
    return [{
      label: definition.label,
      homeValue: homeValue + (definition.suffix && !homeValue.includes(definition.suffix) ? definition.suffix : ''),
      awayValue: awayValue + (definition.suffix && !awayValue.includes(definition.suffix) ? definition.suffix : ''),
      winner: definition.lowerIsBetter
        ? statWinner(awayValue, homeValue)
        : statWinner(homeValue, awayValue),
      lowerIsBetter: definition.lowerIsBetter
    }];
  });
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
    timeZone: FIFA_TIME_ZONE,
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
    homeTeam: normalizeTeam(match.HomeTeam ?? match.Home, match.HomeTeamPenaltyScore),
    awayTeam: normalizeTeam(match.AwayTeam ?? match.Away, match.AwayTeamPenaltyScore)
  };
}

function normalizeTeam(team?: RawFifaTeam, penaltyScore?: unknown): FifaTeam {
  return {
    id: team?.IdTeam ?? '',
    name: text(team?.TeamName) || (team?.ShortClubName ?? ''),
    code: team?.Abbreviation ?? team?.IdCountry ?? '',
    score: typeof team?.Score === 'number' ? team.Score : null,
    penaltyScore: statNumber(penaltyScore ?? team?.PenaltyScore ?? team?.ShootoutScore)
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

function normalizeStats(match: RawFifaMatch): FifaTeamStat[] {
  return STAT_DEFINITIONS.flatMap((definition) => {
    const values = findStatValues(match, definition.aliases);
    if (!hasStatValue(values.home) && !hasStatValue(values.away)) {
      return [];
    }

    return [{
      label: definition.label,
      homeValue: formatStatValue(values.home, definition.suffix),
      awayValue: formatStatValue(values.away, definition.suffix),
      winner: statWinner(values.home, values.away)
    }];
  });
}

function normalizeFacts(match: RawFifaMatch, home: FifaTeam, away: FifaTeam): FifaMatchFact[] {
  return [
    fact('Match', match.MatchNumber ? `No. ${match.MatchNumber}` : ''),
    fact('Stage', text(match.StageName)),
    fact('Group', text(match.GroupName)),
    fact('Winner', winnerName(match.Winner, home, away)),
    fact('Referee', refereeName(match.Officials)),
    fact('Weather', weatherSummary(match.Weather)),
    fact('Local kickoff', match.LocalDate ? formatFifaKickoff(match.LocalDate) : '')
  ].filter((item): item is FifaMatchFact => Boolean(item));
}

function fact(label: string, value: string): FifaMatchFact | null {
  return value ? { label, value } : null;
}

function winnerName(winnerId: string | undefined, home: FifaTeam, away: FifaTeam): string {
  if (!winnerId) {
    return '';
  }
  if (winnerId === home.id) {
    return home.name || home.code;
  }
  if (winnerId === away.id) {
    return away.name || away.code;
  }
  return '';
}

function refereeName(officials: RawFifaOfficial | RawFifaOfficial[] | undefined): string {
  const officialList = Array.isArray(officials) ? officials : officials ? [officials] : [];
  const referee = officialList.find((official) =>
    official.OfficialType === 1 || text(official.TypeLocalized).toLowerCase() === 'referee'
  ) ?? officialList[0];

  return text(referee?.NameShort) || text(referee?.Name);
}

function weatherSummary(weather: RawFifaWeather | undefined): string {
  if (!weather) {
    return '';
  }

  const parts = [
    text(weather.TypeLocalized),
    weather.Temperature !== null && weather.Temperature !== undefined && weather.Temperature !== ''
      ? `${weather.Temperature} deg`
      : '',
    weather.Humidity !== null && weather.Humidity !== undefined && weather.Humidity !== ''
      ? `${weather.Humidity}% humidity`
      : '',
    weather.WindSpeed !== null && weather.WindSpeed !== undefined && weather.WindSpeed !== ''
      ? `${weather.WindSpeed} wind`
      : ''
  ].filter(Boolean);

  return parts.join(' - ');
}

function findStatValues(match: RawFifaMatch, aliases: string[]): StatValues {
  const sharedSources = [
    match.Statistics,
    match.MatchStatistics,
    match.HomeTeam?.Statistics,
    match.HomeTeam?.MatchStatistics,
    match.AwayTeam?.Statistics,
    match.AwayTeam?.MatchStatistics,
    match
  ];
  for (const source of sharedSources) {
    const values = findSharedStat(source, aliases);
    if (values.home !== undefined || values.away !== undefined) {
      return values;
    }
  }

  return {
    home: findTeamStat(match.HomeTeamStatistics ?? match.HomeTeam, aliases),
    away: findTeamStat(match.AwayTeamStatistics ?? match.AwayTeam, aliases)
  };
}

function findSharedStat(source: unknown, aliases: string[]): StatValues {
  if (!source || typeof source !== 'object') {
    return { home: undefined, away: undefined };
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const values = findSharedStat(item, aliases);
      if (values.home !== undefined || values.away !== undefined) {
        return values;
      }
    }
    return { home: undefined, away: undefined };
  }

  const record = source as Record<string, unknown>;
  const statName = statLabel(record);
  if (statName && aliases.some((alias) => sameStat(statName, alias))) {
    return {
      home: firstValue(record, ['Home', 'HomeValue', 'HomeTeamValue', 'ValueHome', 'HomeTeam']),
      away: firstValue(record, ['Away', 'AwayValue', 'AwayTeamValue', 'ValueAway', 'AwayTeam'])
    };
  }

  const directHome = firstMatchingProperty(record, aliases, ['Home', 'HomeValue', 'HomeTeam']);
  const directAway = firstMatchingProperty(record, aliases, ['Away', 'AwayValue', 'AwayTeam']);
  if (directHome !== undefined || directAway !== undefined) {
    return { home: directHome, away: directAway };
  }

  return { home: undefined, away: undefined };
}

function findTeamStat(source: unknown, aliases: string[]): unknown {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const value = findTeamStat(item, aliases);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  }

  const record = source as Record<string, unknown>;
  const statName = statLabel(record);
  if (statName && aliases.some((alias) => sameStat(statName, alias))) {
    return firstValue(record, ['Value', 'StatValue', 'Total', 'Amount']);
  }

  return firstMatchingProperty(record, aliases);
}

function statLabel(record: Record<string, unknown>): string {
  const value = firstValue(record, ['Name', 'Label', 'Type', 'Statistic', 'StatName', 'Description']);
  return typeof value === 'string' ? value : '';
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined) {
      return record[key];
    }
  }
  return undefined;
}

function firstMatchingProperty(record: Record<string, unknown>, aliases: string[], wrappers: string[] = []): unknown {
  for (const [key, value] of Object.entries(record)) {
    if (aliases.some((alias) => sameStat(key, alias))) {
      if (!wrappers.length) {
        return value;
      }
      return unwrapTeamValue(value, wrappers);
    }
  }
  return undefined;
}

function unwrapTeamValue(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  return firstValue(value as Record<string, unknown>, keys) ?? value;
}

function sameStat(left: string, right: string): boolean {
  return normalizeStatKey(left) === normalizeStatKey(right);
}

function normalizeStatKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatStatValue(value: unknown, suffix = ''): string {
  if (!hasStatValue(value)) {
    return '-';
  }

  const textValue = String(value);
  if (suffix && !textValue.includes(suffix)) {
    return `${textValue}${suffix}`;
  }
  return textValue;
}

function hasStatValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function statWinner(home: unknown, away: unknown): 'home' | 'away' | null {
  const homeNumber = statNumber(home);
  const awayNumber = statNumber(away);
  if (homeNumber === null || awayNumber === null || homeNumber === awayNumber) {
    return null;
  }
  return homeNumber > awayNumber ? 'home' : 'away';
}

function statNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
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
    day: '2-digit',
    timeZone: FIFA_TIME_ZONE
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
