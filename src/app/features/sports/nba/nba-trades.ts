import { NBA_TEAM_OPTIONS } from './nba-data.constants';
import { nbaPlayerKey } from './nba-data';
import { NBA_TRADE_TEAM_ALIASES } from './nba-trades.constants';
import { NbaTradeAsset, NbaTradeEntry, NbaTradeGroup, NbaTradeMovement, NbaTradeTeam } from './nba.types';

interface ParsedTradeEntry {
  entry: NbaTradeEntry;
  team: NbaTradeTeam;
  movements: NbaTradeMovement[];
}

export function groupNbaTrades(entries: NbaTradeEntry[]): NbaTradeGroup[] {
  const byDate = new Map<string, NbaTradeEntry[]>();
  for (const entry of entries) byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
  return [...byDate.values()].flatMap(groupTradeDate).sort((left, right) => left.date.localeCompare(right.date));
}

function groupTradeDate(entries: NbaTradeEntry[]): NbaTradeGroup[] {
  const parsed = entries.map(parseTradeEntry);
  const neighbors = new Map(parsed.map((item) => [item.entry.id, new Set<string>()]));

  for (let leftIndex = 0; leftIndex < parsed.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < parsed.length; rightIndex += 1) {
      const left = parsed[leftIndex];
      const right = parsed[rightIndex];
      if (left.entry.teamCode === right.entry.teamCode || !hasReciprocalAssetEvidence(left, right)) continue;
      neighbors.get(left.entry.id)?.add(right.entry.id);
      neighbors.get(right.entry.id)?.add(left.entry.id);
    }
  }

  const byId = new Map(parsed.map((item) => [item.entry.id, item]));
  const seen = new Set<string>();
  const groups: NbaTradeGroup[] = [];
  for (const item of parsed) {
    if (seen.has(item.entry.id)) continue;
    const component: ParsedTradeEntry[] = [];
    const queue = [item.entry.id];
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const current = byId.get(id);
      if (!current) continue;
      component.push(current);
      queue.push(...(neighbors.get(id) ?? []));
    }
    groups.push(buildTradeGroup(component));
  }
  return groups;
}

function hasReciprocalAssetEvidence(left: ParsedTradeEntry, right: ParsedTradeEntry): boolean {
  if (!left.movements.some((movement) => movement.fromTeamCode === right.entry.teamCode || movement.toTeamCode === right.entry.teamCode)
    || !right.movements.some((movement) => movement.fromTeamCode === left.entry.teamCode || movement.toTeamCode === left.entry.teamCode)) {
    return false;
  }

  return left.movements.some((leftMovement) => right.movements.some((rightMovement) =>
    leftMovement.fromTeamCode === rightMovement.fromTeamCode
    && leftMovement.toTeamCode === rightMovement.toTeamCode
    && leftMovement.assets.some((leftAsset) => rightMovement.assets.some((rightAsset) => assetsMatch(leftAsset, rightAsset)))
  ));
}

function assetsMatch(left: NbaTradeAsset, right: NbaTradeAsset): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'player') return nbaPlayerKey(left.playerName ?? left.label) === nbaPlayerKey(right.playerName ?? right.label);
  if (left.kind === 'pick') return normalizedAssetLabel(left.label) === normalizedAssetLabel(right.label);
  if (left.kind === 'cash') return true;
  return false;
}

function normalizedAssetLabel(value: string): string {
  return value.toLowerCase().replace(/\b(?:a|an|one)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function buildTradeGroup(items: ParsedTradeEntry[]): NbaTradeGroup {
  const teamMap = new Map<string, NbaTradeTeam>();
  for (const { entry, team } of items) {
    const existing = teamMap.get(entry.teamCode);
    teamMap.set(entry.teamCode, existing ? {
      ...existing,
      received: uniqueAssets([...existing.received, ...team.received]),
      sent: uniqueAssets([...existing.sent, ...team.sent]),
      sourceNotes: [...existing.sourceNotes, entry.description]
    } : team);
  }
  const teams = [...teamMap.values()].sort((left, right) => left.name.localeCompare(right.name));
  const sourceNotes = items.map(({ entry }) => entry.description);
  const signature = `${items[0].entry.date}:${teams.map((team) => team.code).join('-')}:${sourceNotes.map(stableTextHash).sort().join('-')}`;
  return {
    id: `trade:${stableTextHash(signature)}`,
    date: items[0].entry.date,
    season: items[0].entry.season,
    teams,
    playerNames: [...new Map(teams.flatMap((team) => [...team.received, ...team.sent])
      .filter((asset) => asset.kind === 'player' && asset.playerName)
      .map((asset) => [nbaPlayerKey(asset.playerName!), asset.playerName!])).values()],
    sourceNotes,
    combined: teams.length > 1
  };
}

function parseTradeEntry(entry: NbaTradeEntry): ParsedTradeEntry {
  const received: NbaTradeAsset[] = [];
  const sent: NbaTradeAsset[] = [];
  const movements: NbaTradeMovement[] = [];

  for (const sentence of entry.description.split(/(?<=[.!?])\s+/)) {
    const acquired = /\bAcquired\s+(.+?)\s+from\s+(.+?)(?:\s+in exchange for\s+(.+)|\s+for\s+(.+))?[.!]?$/i.exec(sentence);
    if (acquired) {
      const otherTeam = resolveTeamCode(acquired[2]);
      const incoming = parseAssets(acquired[1]);
      const outgoing = parseAssets(acquired[3] ?? acquired[4] ?? '');
      received.push(...incoming);
      sent.push(...outgoing);
      if (otherTeam) {
        movements.push(movement(entry.teamCode, otherTeam, entry.teamCode, incoming));
        movements.push(movement(entry.teamCode, entry.teamCode, otherTeam, outgoing));
      }
    }

    const outgoingMatch = /\b(?:Traded|Sent)\s+(.+?)\s+to\s+(.+?)(?:\s+(?:in exchange )?for\s+(.+)|\s+as part of.+)?[.!]?$/i.exec(sentence);
    if (outgoingMatch) {
      const otherTeam = resolveTeamCode(outgoingMatch[2]);
      const outgoing = parseAssets(outgoingMatch[1]);
      const incoming = parseAssets(outgoingMatch[3] ?? '');
      sent.push(...outgoing);
      received.push(...incoming);
      if (otherTeam) {
        movements.push(movement(entry.teamCode, entry.teamCode, otherTeam, outgoing));
        movements.push(movement(entry.teamCode, otherTeam, entry.teamCode, incoming));
      }
    }
  }

  return {
    entry,
    team: {
      id: entry.teamId,
      code: entry.teamCode,
      name: entry.teamName,
      logoUrl: entry.teamLogoUrl,
      received: uniqueAssets(received),
      sent: uniqueAssets(sent),
      sourceNotes: [entry.description]
    },
    movements: movements.filter((candidate) => candidate.assets.length > 0)
  };
}

function movement(reporterTeamCode: string, fromTeamCode: string, toTeamCode: string, assets: NbaTradeAsset[]): NbaTradeMovement {
  return { reporterTeamCode, fromTeamCode, toTeamCode, assets };
}

function parseAssets(value: string): NbaTradeAsset[] {
  const text = value.trim().replace(/[.;]+$/, '');
  if (!text) return [];
  const assets: NbaTradeAsset[] = [];
  const positionPattern = /\b(G-F|F-C|Gs?|Fs?|Cs?)\s+(.+?)(?=\s+(?:G-F|F-C|Gs?|Fs?|Cs?)\s+|$)/giu;
  for (const match of text.matchAll(positionPattern)) {
    const names = match[2]
      .replace(/\s+(?:and\s+)?(?:a\s+)?(?:future\s+|\d{4}\s+)?(?:first|second)-round.+$/i, '')
      .replace(/\s+(?:and\s+)?(?:draft|cash)\s+considerations?.*$/i, '')
      .replace(/\s+and$/i, '')
      .split(/,\s*|\s+and\s+/)
      .map((name) => name.trim().replace(/^(?:a|an)\s+/i, ''))
      .filter(isPlayerName);
    for (const playerName of names) assets.push(asset('player', playerName, playerName, match[1].replace(/s$/i, '').toUpperCase()));
  }
  for (const match of text.matchAll(/(?:\b(?:a|an|one|two|three|four|five|six|\d{4})\s+)?(?:future\s+)?(?:first|second)-round\s+pick(?:s)?(?:\s+swap)?/gi)) {
    assets.push(asset('pick', match[0].trim()));
  }
  for (const match of text.matchAll(/\b(?:draft considerations?|draft consideration|cash considerations?|cash)\b/gi)) {
    assets.push(asset(/cash/i.test(match[0]) ? 'cash' : 'consideration', match[0].trim()));
  }
  if (!assets.length) assets.push(asset('consideration', text));
  return uniqueAssets(assets);
}

function asset(kind: NbaTradeAsset['kind'], label: string, playerName?: string, position?: string): NbaTradeAsset {
  return { id: `${kind}:${stableTextHash(label.toLowerCase())}`, kind, label, playerName, position };
}

function uniqueAssets(assets: NbaTradeAsset[]): NbaTradeAsset[] {
  return [...new Map(assets.map((item) => [item.id, item])).values()];
}

function isPlayerName(value: string): boolean {
  return /^\p{Lu}[\p{L}'’.\-]+(?:\s+\p{Lu}[\p{L}'’.\-]+){1,4}$/u.test(value)
    && !/pick|draft|cash|consideration/i.test(value);
}

function resolveTeamCode(value: string): string {
  const normalized = normalizeTeamName(value);
  for (const team of NBA_TEAM_OPTIONS) {
    if ((NBA_TRADE_TEAM_ALIASES[team.code] ?? [team.name]).some((alias) => normalized.includes(normalizeTeamName(alias)))) return team.code;
  }
  return '';
}

function normalizeTeamName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function stableTextHash(value: string): string {
  let hash = 0;
  for (const character of value) hash = Math.imul(31, hash) + character.charCodeAt(0) | 0;
  return Math.abs(hash).toString(36);
}
