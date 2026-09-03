import { PickupGame, PickupSession, PlayerProfile, PlayerRole, SessionPlayerState } from './pickup-five.types';

const STATUS_LABELS: Record<SessionPlayerState, string> = {
  REGISTERED: 'Registered',
  WAITING: 'Waiting',
  PLAYING: 'Playing',
  LEAVING_AFTER_GAME: 'Leaving after game',
  CHECKED_OUT: 'Checked out',
  NO_SHOW: 'No-show'
};

export function statusLabel(state: SessionPlayerState): string {
  return STATUS_LABELS[state];
}

export function primaryRole(player: PlayerProfile): PlayerRole {
  return player.roles[0] ?? 'Wing';
}

export function isPartialSub(game: PickupGame, playerId: string): boolean {
  return game.status === 'IN_PROGRESS'
    && (game.replacements ?? []).some((replacement) => replacement.incomingPlayerId === playerId);
}

export function teamName(team: 'A' | 'B'): 'White' | 'Black' {
  return team === 'A' ? 'White' : 'Black';
}

export function gameDuration(game: PickupGame): string {
  if (!game.startedAt || !game.completedAt) return '—';
  const minutes = Math.max(1, Math.round(
    (new Date(game.completedAt).getTime() - new Date(game.startedAt).getTime()) / 60_000
  ));
  if (minutes < 60) return `${minutes} min`;
  const remainingMinutes = minutes % 60;
  return `${Math.floor(minutes / 60)} hr${remainingMinutes ? ` ${remainingMinutes} min` : ''}`;
}

export function completedGameCount(session: PickupSession): number {
  return session.games.filter((game) => game.status === 'COMPLETED').length;
}

export function sessionDisplayName(session: PickupSession | null, fallback = 'Select a session'): string {
  if (!session) return fallback;
  if (session.name.startsWith('Test History — ')) return 'Test History';
  if (/^[A-Z][a-z]+ \d{2} \d{4}$/.test(session.name)) {
    return new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }).format(new Date(session.createdAt));
  }
  return session.name;
}
