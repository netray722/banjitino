import { checkInPlayer } from './pickup-five-scheduling';
import { createId, createSessionPlayer, createTestSession } from './pickup-five-state.factory';
import { NBA_TEST_PLAYERS } from './pickup-five-test-data.constants';
import { PickupFiveState, PickupSession, PlayerProfile, PlayerRole } from './pickup-five.types';

export function addSession(state: PickupFiveState, name: string, now: string): PickupFiveState {
  const activePlayers = state.players.filter((player) => !player.archivedAt);
  const session: PickupSession = {
    id: createId(),
    name,
    status: 'CHECK_IN',
    players: activePlayers.map((player, index) => createSessionPlayer(player.id, index)),
    games: [],
    tieBreakCursor: 0,
    nextTieBreakOrder: activePlayers.length,
    teammateHistory: {},
    createdAt: now,
    updatedAt: now
  };
  return { ...state, activeSessionId: session.id, sessions: [...state.sessions, session] };
}

export function addPlayer(
  state: PickupFiveState,
  playerNumber: number,
  displayName: string,
  role: PlayerRole,
  now: string
): PickupFiveState {
  const activeSession = state.sessions.find((session) => session.id === state.activeSessionId);
  if (!activeSession || activeSession.status === 'ENDED') {
    throw new Error('Create a session before adding a player.');
  }
  if (state.players.some((player) => !player.archivedAt && player.playerNumber === playerNumber)) {
    throw new Error(`Player #${playerNumber} already exists.`);
  }
  const profile: PlayerProfile = {
    id: createId(),
    playerNumber,
    displayName,
    roles: [role],
    createdAt: now,
    updatedAt: now
  };
  const sessions = state.sessions.map((session) => session.id === state.activeSessionId
    ? checkInPlayer(session, profile.id, now)
    : session);
  return { ...state, players: [...state.players, profile], sessions };
}

export function editPlayer(
  state: PickupFiveState,
  playerId: string,
  update: Partial<Pick<PlayerProfile, 'displayName' | 'playerNumber'>>,
  now: string
): PickupFiveState {
  if (update.playerNumber !== undefined && state.players.some((player) =>
    player.id !== playerId && player.playerNumber === update.playerNumber)) {
    throw new Error(`Player #${update.playerNumber} already exists.`);
  }
  if (update.displayName !== undefined && !update.displayName.trim()) {
    throw new Error('Player name cannot be empty.');
  }
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId
      ? { ...player, ...update, displayName: update.displayName?.trim() ?? player.displayName, updatedAt: now }
      : player)
  };
}

export function changePlayerRole(
  state: PickupFiveState,
  playerId: string,
  role: PlayerRole,
  now: string
): PickupFiveState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId
      ? { ...player, roles: [role], updatedAt: now }
      : player)
  };
}

export function archivePlayer(state: PickupFiveState, playerId: string, now: string): PickupFiveState {
  const player = state.players.find((candidate) => candidate.id === playerId && !candidate.archivedAt);
  if (!player) throw new Error('That player is no longer in the roster.');
  const isInOpenGame = state.sessions.some((session) => session.games.some((game) =>
    (game.status === 'PROPOSED' || game.status === 'LOCKED' || game.status === 'IN_PROGRESS')
    && [...game.teamA, ...game.teamB].includes(playerId)));
  if (isInOpenGame) throw new Error('Replace or check out this player before removing them from the roster.');

  return {
    ...state,
    players: state.players.map((candidate) => candidate.id === playerId
      ? { ...candidate, archivedAt: now, updatedAt: now }
      : candidate),
    sessions: state.sessions.map((session) =>
      session.id === state.activeSessionId && session.status !== 'ENDED'
        ? { ...session, players: session.players.filter((candidate) => candidate.playerId !== playerId), updatedAt: now }
        : session)
  };
}

export function removeGame(state: PickupFiveState, sessionId: string, gameId: string, now: string): PickupFiveState {
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  const game = session?.games.find((candidate) => candidate.id === gameId);
  if (!session || !game) throw new Error('That game no longer exists.');
  if (game.status !== 'COMPLETED' && game.status !== 'CANCELLED') {
    throw new Error('Finish or cancel the open game before deleting its record.');
  }
  return {
    ...state,
    sessions: state.sessions.map((candidate) => candidate.id === sessionId
      ? { ...candidate, games: candidate.games.filter((item) => item.id !== gameId), updatedAt: now }
      : candidate)
  };
}

export function removeSession(state: PickupFiveState, sessionId: string): PickupFiveState {
  if (!state.sessions.some((session) => session.id === sessionId)) {
    throw new Error('That session no longer exists.');
  }
  return {
    ...state,
    activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
    sessions: state.sessions.filter((session) => session.id !== sessionId)
  };
}

export function changeSessionName(
  state: PickupFiveState,
  sessionId: string,
  name: string,
  now: string
): PickupFiveState {
  if (!state.sessions.some((session) => session.id === sessionId)) {
    throw new Error('That session no longer exists.');
  }
  return {
    ...state,
    sessions: state.sessions.map((session) => session.id === sessionId
      ? { ...session, name, updatedAt: now }
      : session)
  };
}

export function addTestData(
  state: PickupFiveState,
  playerCount: number,
  sessionId: string,
  now: Date
): PickupFiveState {
  const players = [...state.players];
  const testPlayerIds: string[] = [];

  for (const testPlayer of NBA_TEST_PLAYERS) {
    if (testPlayerIds.length === playerCount) break;
    const existing = players.find((player) => !player.archivedAt
      && player.displayName.toLocaleLowerCase() === testPlayer.displayName.toLocaleLowerCase());
    if (existing) {
      testPlayerIds.push(existing.id);
      continue;
    }
    if (players.some((player) => !player.archivedAt && player.playerNumber === testPlayer.playerNumber)) continue;

    const timestamp = now.toISOString();
    const profile: PlayerProfile = {
      id: createId(),
      playerNumber: testPlayer.playerNumber,
      displayName: testPlayer.displayName,
      roles: [testPlayer.role],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    players.push(profile);
    testPlayerIds.push(profile.id);
  }

  if (testPlayerIds.length < playerCount) {
    throw new Error(`Only ${testPlayerIds.length} NBA test players are available with unused jersey numbers.`);
  }

  return { ...state, players, sessions: [...state.sessions, createTestSession(sessionId, testPlayerIds, now)] };
}
