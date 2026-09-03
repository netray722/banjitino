import { PickupFiveState, PickupGame, PickupSession, SessionPlayer } from './pickup-five.types';

const DEFAULT_PIN = '2468';

export function createInitialState(): PickupFiveState {
  return {
    schemaVersion: 1,
    revision: 0,
    activeSessionId: null,
    players: [],
    sessions: [],
    organizerPinHash: hashPin(DEFAULT_PIN)
  };
}

export function createSessionPlayer(playerId: string, tieBreakOrder: number): SessionPlayer {
  return {
    playerId,
    state: 'REGISTERED',
    fairnessCredit: 0,
    consecutiveGamesSat: 0,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    lastResult: null,
    lastGameId: null,
    tieBreakOrder,
    checkedInAt: null
  };
}

export function createTestSession(sessionId: string, playerIds: string[], now: Date): PickupSession {
  const timestamp = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const gameData: Array<{ teamA: number[]; teamB: number[]; winner: 'A' | 'B'; start: number; duration: number }> = [
    { teamA: [0, 1, 2, 3, 4], teamB: [5, 6, 7, 8, 9], winner: 'A', start: 85, duration: 18 },
    { teamA: [0, 2, 5, 7, 8], teamB: [1, 3, 4, 6, 9], winner: 'B', start: 60, duration: 16 },
    { teamA: [1, 2, 4, 6, 8], teamB: [0, 3, 5, 7, 9], winner: 'A', start: 35, duration: 21 }
  ];
  const games: PickupGame[] = gameData.map((data, index) => ({
    id: createId(),
    number: index + 1,
    status: 'COMPLETED',
    teamA: data.teamA.map((playerIndex) => playerIds[playerIndex]),
    teamB: data.teamB.map((playerIndex) => playerIds[playerIndex]),
    winner: data.winner,
    fairnessApplied: true,
    rebalanceCount: 0,
    creditedTeamA: data.teamA.map((playerIndex) => playerIds[playerIndex]),
    creditedTeamB: data.teamB.map((playerIndex) => playerIds[playerIndex]),
    replacements: [],
    createdAt: timestamp(data.start + 2),
    startedAt: timestamp(data.start),
    completedAt: timestamp(data.start - data.duration)
  }));

  return {
    id: sessionId,
    name: 'Test History',
    status: 'ENDED',
    players: playerIds.map((playerId, tieBreakOrder) => {
      const playerGames = games.filter((game) => [...game.teamA, ...game.teamB].includes(playerId));
      const wins = playerGames.filter((game) => game.winner === (game.teamA.includes(playerId) ? 'A' : 'B')).length;
      const lastGame = playerGames[playerGames.length - 1] ?? null;
      return {
        ...createSessionPlayer(playerId, tieBreakOrder),
        state: 'CHECKED_OUT',
        gamesPlayed: playerGames.length,
        wins,
        losses: playerGames.length - wins,
        lastResult: lastGame ? (lastGame.winner === (lastGame.teamA.includes(playerId) ? 'A' : 'B') ? 'WIN' : 'LOSS') : null,
        lastGameId: lastGame?.id ?? null,
        checkedInAt: timestamp(90)
      };
    }),
    games,
    tieBreakCursor: 0,
    nextTieBreakOrder: playerIds.length,
    createdAt: timestamp(90),
    updatedAt: now.toISOString()
  };
}

export function createId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function hashPin(pin: string): string {
  let hash = 2166136261;
  for (const character of pin) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
