import { TestBed } from '@angular/core/testing';

import { BrowserPickupFiveStorage, PickupFiveStorage } from './pickup-five-storage.service';
import { PickupFiveStateService } from './pickup-five-state.service';
import { NBA_TEST_PLAYERS } from './pickup-five-test-data.constants';
import {
  GameStatus,
  PickupFiveState,
  PickupGame,
  PickupSession,
  PlayerProfile,
  SessionPlayer
} from './pickup-five.types';

describe('PickupFiveStateService data management', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('clears every player and session while advancing the stored revision', () => {
    const service = createService(createState());

    service.resetAllData();

    expect(service.state().players).toEqual([]);
    expect(service.state().sessions).toEqual([]);
    expect(service.state().activeSessionId).toBeNull();
    expect(service.state().revision).toBe(4);
  });

  it('allows the current toast notification to be dismissed', () => {
    const service = createService(createState());
    service.deleteSession('session-1');

    service.clearNotice();

    expect(service.notice()).toBe('');
  });

  it('calculates career win rates across every saved session', () => {
    const state = createState();
    state.sessions.push({
      ...createSession(),
      id: 'session-2',
      players: [
        { ...createSessionPlayer('player-1', 0), gamesPlayed: 4, wins: 3, losses: 1 },
        { ...createSessionPlayer('player-2', 0), gamesPlayed: 2, wins: 2, losses: 0 }
      ]
    });
    const service = createService(state);

    expect(service.careerWinRates().get('player-1')).toBe(60);
    expect(service.careerWinRates().get('player-2')).toBe(67);
    expect(service.careerWinRates().has('new-player')).toBe(false);
  });

  it('deletes a session and clears the active session reference', () => {
    const service = createService(createState());

    service.deleteSession('session-1');

    expect(service.state().sessions).toEqual([]);
    expect(service.state().activeSessionId).toBeNull();
    expect(service.state().players).toHaveLength(2);
  });

  it('renames a session without changing its games', () => {
    const service = createService(createState());

    service.renameSession('session-1', 'Friday night run');

    expect(service.currentSession()?.name).toBe('Friday night run');
    expect(service.currentSession()?.games).toHaveLength(1);
  });

  it('deletes a completed game record without changing player fairness totals', () => {
    const state = createState();
    state.sessions[0].games.push(createGame('game-2', 'CANCELLED'));
    const service = createService(state);
    const fairnessBefore = service.state().sessions[0].players[0].fairnessCredit;

    service.deleteGame('session-1', 'game-1');

    expect(service.state().sessions[0].games.map((game) => game.id)).toEqual(['game-2']);
    expect(service.state().sessions[0].players[0].fairnessCredit).toBe(fairnessBefore);
  });

  it('removes a player from the active roster while retaining their historical profile', () => {
    const service = createService(createState());

    service.removePlayer('player-1');

    expect(service.players().map((player) => player.id)).toEqual(['player-2']);
    expect(service.profile('player-1')?.displayName).toBe('Player One');
    expect(service.profile('player-1')?.archivedAt).toBeTruthy();
    expect(service.currentSession()?.players.map((player) => player.playerId)).toEqual(['player-2']);
    expect(service.currentSession()?.games[0].teamA).toContain('player-1');
  });

  it('refuses to remove a player from an open game', () => {
    const state = createState();
    state.sessions[0].games = [createGame('game-1', 'IN_PROGRESS')];
    const service = createService(state);

    service.removePlayer('player-1');

    expect(service.players().map((player) => player.id)).toContain('player-1');
    expect(service.noticeTone()).toBe('error');
    expect(service.notice()).toContain('Replace or check out');
  });

  it('adds NBA test players and completed game history without removing existing data', () => {
    const service = createService(createState());

    const sessionId = service.loadTestData();

    expect(service.state().players.some((player) => player.displayName === 'Stephen Curry'
      && player.playerNumber === 30 && player.roles[0] === 'Guard')).toBe(true);
    expect(service.state().players.some((player) => player.displayName === 'Nikola Jokic'
      && player.playerNumber === 15 && player.roles[0] === 'Big')).toBe(true);
    expect(service.state().sessions.some((session) => session.id === 'session-1')).toBe(true);
    expect(service.state().activeSessionId).toBe('session-1');

    const testSession = service.state().sessions.find((session) => session.id === sessionId);
    expect(testSession?.status).toBe('ENDED');
    expect(testSession?.games).toHaveLength(3);
    expect(testSession?.games.every((game) => game.status === 'COMPLETED'
      && Boolean(game.winner) && Boolean(game.startedAt) && Boolean(game.completedAt))).toBe(true);
    expect(testSession?.players.filter((player) => player.gamesPlayed > 0)).toHaveLength(10);
  });

  it('loads the requested number of NBA mock players', () => {
    const service = createService(createState());

    const sessionId = service.loadTestData(17);
    const testSession = service.state().sessions.find((session) => session.id === sessionId);
    const nbaPlayerNames = new Set(NBA_TEST_PLAYERS.map((player) => player.displayName));

    expect(testSession?.players).toHaveLength(17);
    expect(testSession?.players.every((player) =>
      nbaPlayerNames.has(service.profile(player.playerId)?.displayName ?? ''))).toBe(true);
    expect(service.notice()).toContain('17 NBA test players');
  });

  it('rejects test player counts outside the available range', () => {
    const service = createService(createState());
    const sessionCount = service.state().sessions.length;

    expect(service.loadTestData(9)).toBeNull();
    expect(service.state().sessions).toHaveLength(sessionCount);
    expect(service.noticeTone()).toBe('error');
    expect(service.notice()).toContain(`10 to ${NBA_TEST_PLAYERS.length}`);
  });

  it('records teammate history only when a proposed game officially starts', () => {
    const service = createService(createReadyState());

    service.generateGame();
    service.rebalanceGame();

    expect(service.currentSession()?.teammateHistory ?? {}).toEqual({});

    service.startGame();

    const teammateHistory = service.currentSession()?.teammateHistory ?? {};
    expect(Object.keys(teammateHistory)).toHaveLength(20);
    expect(Object.values(teammateHistory).reduce((total, count) => total + count, 0)).toBe(20);
  });
});

function createService(initialState: PickupFiveState): PickupFiveStateService {
  let storedState: PickupFiveState | null = initialState;
  const storage: PickupFiveStorage = {
    load: () => storedState,
    save: (state, expectedRevision) => {
      if (storedState && storedState.revision !== expectedRevision) {
        throw new Error('Unexpected revision.');
      }
      storedState = state;
    }
  };
  TestBed.configureTestingModule({
    providers: [{ provide: BrowserPickupFiveStorage, useValue: storage }]
  });
  return TestBed.inject(PickupFiveStateService);
}

function createState(): PickupFiveState {
  return {
    schemaVersion: 1,
    revision: 3,
    activeSessionId: 'session-1',
    players: [createProfile('player-1', 1, 'Player One'), createProfile('player-2', 2, 'Player Two')],
    sessions: [createSession()],
    organizerPinHash: 'test'
  };
}

function createReadyState(): PickupFiveState {
  const players = Array.from({ length: 10 }, (_, index) =>
    createProfile(`ready-${index + 1}`, index + 1, `Ready Player ${index + 1}`));
  return {
    schemaVersion: 1,
    revision: 0,
    activeSessionId: 'ready-session',
    players,
    sessions: [{
      id: 'ready-session',
      name: 'Ready session',
      status: 'ACTIVE',
      players: players.map((player, index) => ({
        ...createSessionPlayer(player.id, 0),
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        lastResult: null,
        lastGameId: null,
        tieBreakOrder: index
      })),
      games: [],
      tieBreakCursor: 0,
      nextTieBreakOrder: 10,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }],
    organizerPinHash: 'test'
  };
}

function createProfile(id: string, playerNumber: number, displayName: string): PlayerProfile {
  return {
    id,
    playerNumber,
    displayName,
    roles: ['Wing'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function createSession(): PickupSession {
  return {
    id: 'session-1',
    name: 'Test session',
    status: 'ACTIVE',
    players: [createSessionPlayer('player-1', -0.2), createSessionPlayer('player-2', 0.2)],
    games: [createGame('game-1', 'COMPLETED')],
    tieBreakCursor: 0,
    nextTieBreakOrder: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function createSessionPlayer(playerId: string, fairnessCredit: number): SessionPlayer {
  return {
    playerId,
    state: 'WAITING',
    fairnessCredit,
    consecutiveGamesSat: 0,
    gamesPlayed: 1,
    wins: 0,
    losses: 1,
    lastResult: 'LOSS',
    lastGameId: 'game-1',
    tieBreakOrder: playerId === 'player-1' ? 0 : 1,
    checkedInAt: '2026-01-01T00:00:00.000Z'
  };
}

function createGame(id: string, status: GameStatus): PickupGame {
  return {
    id,
    number: id === 'game-1' ? 1 : 2,
    status,
    teamA: ['player-1'],
    teamB: ['player-2'],
    winner: status === 'COMPLETED' ? 'A' : null,
    fairnessApplied: status === 'COMPLETED',
    rebalanceCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    startedAt: '2026-01-01T00:01:00.000Z',
    completedAt: status === 'COMPLETED' ? '2026-01-01T00:02:00.000Z' : null
  };
}
