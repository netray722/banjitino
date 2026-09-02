import { Injectable, computed, inject, signal } from '@angular/core';

import {
  balanceTeams,
  checkInPlayer,
  checkOutPlayer,
  recordGameResult,
  selectNextPlayers,
  substitutePlayer
} from './pickup-five-scheduling';
import { BrowserPickupFiveStorage } from './pickup-five-storage.service';
import {
  PickupFiveState,
  PickupGame,
  PickupSession,
  PlayerProfile,
  PlayerRole
} from './pickup-five.types';

const DEFAULT_PIN = '2468';

@Injectable({ providedIn: 'root' })
export class PickupFiveStateService {
  private readonly storage = inject(BrowserPickupFiveStorage);

  readonly state = signal(this.storage.load() ?? initialState());
  readonly notice = signal('');
  readonly noticeTone = signal<'info' | 'error'>('info');
  readonly noticeSequence = signal(0);
  readonly players = computed(() => this.state().players
    .filter((player) => !player.archivedAt)
    .slice()
    .sort((left, right) => left.playerNumber - right.playerNumber));
  readonly careerWinRates = computed(() => {
    const totals = new Map<string, { wins: number; games: number }>();
    for (const session of this.state().sessions) {
      for (const player of session.players) {
        const current = totals.get(player.playerId) ?? { wins: 0, games: 0 };
        totals.set(player.playerId, {
          wins: current.wins + player.wins,
          games: current.games + player.wins + player.losses
        });
      }
    }

    return new Map([...totals]
      .filter(([, total]) => total.games > 0)
      .map(([playerId, total]) => [playerId, Math.round(total.wins / total.games * 100)]));
  });
  readonly currentSession = computed(() => {
    const state = this.state();
    return state.sessions.find((session) => session.id === state.activeSessionId) ?? null;
  });
  readonly proposedGame = computed(() => findLatest(
    this.currentSession()?.games ?? [],
    (game) => game.status === 'PROPOSED'
  ));
  readonly currentGame = computed(() => {
    const games = this.currentSession()?.games ?? [];
    return findLatest(games, (game) => game.status === 'IN_PROGRESS' || game.status === 'LOCKED')
      ?? findLatest(games, (game) => game.status === 'COMPLETED')
      ?? null;
  });

  createSession(name: string): void {
    const trimmedName = name.trim();
    if (!trimmedName) {
      this.showError('Enter a session name.');
      return;
    }
    const now = new Date().toISOString();
    this.commit((state) => {
      const activePlayers = state.players.filter((player) => !player.archivedAt);
      const session: PickupSession = {
        id: createId(),
        name: trimmedName,
        status: 'CHECK_IN',
        players: activePlayers.map((player, index) => newSessionPlayer(player.id, index)),
        games: [],
        tieBreakCursor: 0,
        nextTieBreakOrder: activePlayers.length,
        createdAt: now,
        updatedAt: now
      };
      return { ...state, activeSessionId: session.id, sessions: [...state.sessions, session] };
    }, 'Session created. Check-in is ready.');
  }

  openCheckIn(): void {
    this.updateSession((session, now) => {
      if (session.status !== 'DRAFT') throw new Error('Only a draft session can open check-in.');
      return { ...session, status: 'CHECK_IN', updatedAt: now };
    }, 'Check-in is open.');
  }

  startSession(): void {
    this.updateSession((session, now) => {
      if (session.status !== 'DRAFT' && session.status !== 'CHECK_IN') {
        throw new Error('This session has already started.');
      }
      const active = { ...session, status: 'ACTIVE' as const, updatedAt: now };
      const proposed = proposeGameIfPossible(active, this.state().players, now);
      if (proposed === active) throw new Error('Ten waiting players are required to start the first game.');
      return proposed;
    }, 'Session started and the first game is ready.');
  }

  endSession(): void {
    this.updateSession((session, now) => ({
      ...session,
      status: 'ENDED',
      players: session.players.map((player) => ({ ...player, state: 'CHECKED_OUT' as const })),
      games: session.games.map((game) => game.status === 'PROPOSED'
        || game.status === 'IN_PROGRESS'
        || game.status === 'LOCKED'
        ? { ...game, status: 'CANCELLED' as const }
        : game),
      updatedAt: now
    }), 'Session ended. History was saved.');
  }

  addPlayerAndCheckIn(playerNumberValue: string, displayName: string, role: PlayerRole): void {
    const playerNumber = Number(playerNumberValue);
    const name = displayName.trim();
    if (!Number.isInteger(playerNumber) || playerNumber < 0 || playerNumber > 999) {
      this.showError('Player number must be a whole number from 0 to 999.');
      return;
    }
    if (!name) {
      this.showError('Enter the player’s name.');
      return;
    }
    if (!['Guard', 'Wing', 'Big'].includes(role)) {
      this.showError('Choose a player role.');
      return;
    }

    const now = new Date().toISOString();
    this.commit((state) => {
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
        displayName: name,
        roles: [role],
        createdAt: now,
        updatedAt: now
      };
      const sessions = state.sessions.map((session) => session.id === state.activeSessionId
        ? checkInPlayer(session, profile.id, now)
        : session);
      return { ...state, players: [...state.players, profile], sessions };
    }, 'Player added and checked in.');
  }

  checkIn(playerId: string): void {
    this.updateSession((session, now) => {
      if (session.status !== 'DRAFT' && session.status !== 'CHECK_IN' && session.status !== 'ACTIVE') {
        throw new Error('Check-in is not open for this session.');
      }
      return checkInPlayer(session, playerId, now);
    }, 'Player checked in.');
  }

  checkOut(playerId: string): void {
    this.updateSession((session, now) => {
      const game = findLatest(session.games, (candidate) =>
        (candidate.status === 'PROPOSED' || candidate.status === 'IN_PROGRESS')
        && [...candidate.teamA, ...candidate.teamB].includes(playerId));
      if (game) {
        const incomingPlayerId = replacementCandidate(session, game);
        if (!incomingPlayerId) throw new Error('No waiting player is available to substitute in.');
        return substitutePlayer(session, game.id, playerId, incomingPlayerId, 'CHECKED_OUT', now);
      }
      return checkOutPlayer(session, playerId, now);
    }, 'Player checked out.');
  }

  replacePlayer(playerId: string): void {
    this.updateSession((session, now) => {
      const game = findLatest(session.games, (candidate) =>
        (candidate.status === 'PROPOSED' || candidate.status === 'IN_PROGRESS')
        && [...candidate.teamA, ...candidate.teamB].includes(playerId));
      if (!game) throw new Error('That player is not in the current game.');
      const incomingPlayerId = replacementCandidate(session, game);
      if (!incomingPlayerId) throw new Error('No waiting player is available to substitute in.');
      return substitutePlayer(session, game.id, playerId, incomingPlayerId, 'WAITING', now);
    }, 'The first waiting player substituted in. The outgoing player kept their queue position.');
  }

  updatePlayer(playerId: string, update: Partial<Pick<PlayerProfile, 'displayName' | 'playerNumber'>>): void {
    const now = new Date().toISOString();
    this.commit((state) => {
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
    }, 'Player profile updated.');
  }

  setRole(playerId: string, role: PlayerRole): void {
    const now = new Date().toISOString();
    this.commit((state) => ({
      ...state,
      players: state.players.map((player) => player.id === playerId
        ? { ...player, roles: [role], updatedAt: now }
        : player)
    }), 'Player role updated.');
  }

  removePlayer(playerId: string): void {
    const now = new Date().toISOString();
    this.commit((state) => {
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
    }, 'Player removed from the active roster. Past game history was preserved.');
  }

  deleteGame(sessionId: string, gameId: string): void {
    this.commit((state) => {
      const session = state.sessions.find((candidate) => candidate.id === sessionId);
      const game = session?.games.find((candidate) => candidate.id === gameId);
      if (!session || !game) throw new Error('That game no longer exists.');
      if (game.status !== 'COMPLETED' && game.status !== 'CANCELLED') {
        throw new Error('Finish or cancel the open game before deleting its record.');
      }
      return {
        ...state,
        sessions: state.sessions.map((candidate) => candidate.id === sessionId
          ? { ...candidate, games: candidate.games.filter((item) => item.id !== gameId), updatedAt: new Date().toISOString() }
          : candidate)
      };
    }, 'Game record deleted. Queue fairness and player totals were not rewound.');
  }

  deleteSession(sessionId: string): void {
    this.commit((state) => {
      if (!state.sessions.some((session) => session.id === sessionId)) {
        throw new Error('That session no longer exists.');
      }
      return {
        ...state,
        activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        sessions: state.sessions.filter((session) => session.id !== sessionId)
      };
    }, 'Session and its games deleted. The player roster was kept.');
  }

  renameSession(sessionId: string, name: string): void {
    const trimmedName = name.trim();
    if (!trimmedName) {
      this.showError('Session name cannot be empty.');
      return;
    }
    const now = new Date().toISOString();
    this.commit((state) => {
      if (!state.sessions.some((session) => session.id === sessionId)) {
        throw new Error('That session no longer exists.');
      }
      return {
        ...state,
        sessions: state.sessions.map((session) => session.id === sessionId
          ? { ...session, name: trimmedName, updatedAt: now }
          : session)
      };
    }, 'Session renamed.');
  }

  resetAllData(): void {
    this.commit(() => initialState(), 'All locally saved Pickup Five data was cleared.');
  }

  generateGame(): void {
    this.updateSession((session, now) => {
      if (session.status !== 'ACTIVE') throw new Error('Start the session before generating a game.');
      if (session.games.some((game) => game.status === 'PROPOSED' || game.status === 'IN_PROGRESS')) {
        throw new Error('Finish or cancel the open game first.');
      }
      const proposed = proposeGameIfPossible(session, this.state().players, now);
      if (proposed === session) throw new Error('Ten waiting players are required.');
      return proposed;
    }, 'Proposed teams are ready for review.');
  }

  rebalanceGame(): void {
    this.updateSession((session, now) => {
      const game = findLatest(session.games, (candidate) => candidate.status === 'PROPOSED');
      if (!game) throw new Error('There is no proposed game to rebalance.');
      const selected = [...game.teamA, ...game.teamB];
      const balance = balanceTeams(selected, this.state().players, session.games, game.rebalanceCount + 1);
      return {
        ...session,
        games: session.games.map((candidate) => candidate.id === game.id
          ? {
            ...candidate,
            teamA: balance.teamA,
            teamB: balance.teamB,
            rebalanceCount: candidate.rebalanceCount + 1
          }
          : candidate),
        updatedAt: now
      };
    }, 'The same ten players were rebalanced.');
  }

  swapPlayers(firstPlayerId: string, secondPlayerId: string): void {
    this.updateSession((session, now) => {
      const game = findLatest(session.games, (candidate) => candidate.status === 'PROPOSED');
      if (!game) throw new Error('There is no proposed game to edit.');
      const firstTeam = game.teamA.includes(firstPlayerId) ? 'A' : game.teamB.includes(firstPlayerId) ? 'B' : null;
      const secondTeam = game.teamA.includes(secondPlayerId) ? 'A' : game.teamB.includes(secondPlayerId) ? 'B' : null;
      if (!firstTeam || !secondTeam || firstTeam === secondTeam) {
        throw new Error('Choose one player from each team.');
      }
      const teamA = game.teamA.map((id) => id === firstPlayerId ? secondPlayerId : id === secondPlayerId ? firstPlayerId : id);
      const teamB = game.teamB.map((id) => id === firstPlayerId ? secondPlayerId : id === secondPlayerId ? firstPlayerId : id);
      return {
        ...session,
        games: session.games.map((candidate) => candidate.id === game.id ? { ...candidate, teamA, teamB } : candidate),
        updatedAt: now
      };
    }, 'Players swapped.');
  }

  startGame(): void {
    this.updateSession((session, now) => {
      const game = findLatest(session.games, (candidate) => candidate.status === 'PROPOSED');
      if (!game) throw new Error('Generate a proposed game first.');
      const participants = new Set([...game.teamA, ...game.teamB]);
      if (game.teamA.length !== 5 || game.teamB.length !== 5 || participants.size !== 10) {
        throw new Error('A game must contain exactly two distinct teams of five.');
      }
      const unavailable = session.players.some((player) =>
        participants.has(player.playerId) && player.state !== 'WAITING');
      if (unavailable) throw new Error('A proposed player is no longer waiting. Regenerate the game.');

      return {
        ...session,
        players: session.players.map((player) => participants.has(player.playerId)
          ? { ...player, state: 'PLAYING' as const }
          : player),
        games: session.games.map((candidate) => candidate.id === game.id
          ? {
            ...candidate,
            status: 'IN_PROGRESS' as const,
            creditedTeamA: [...candidate.teamA],
            creditedTeamB: [...candidate.teamB],
            replacements: [],
            startedAt: now
          }
          : candidate),
        updatedAt: now
      };
    }, 'Game started and locked.');
  }

  recordWinner(winner: 'A' | 'B'): void {
    this.updateSession((session, now) => {
      const game = findLatest(session.games, (candidate) =>
        candidate.status === 'IN_PROGRESS' || candidate.status === 'LOCKED');
      if (!game) throw new Error('There is no game in progress.');
      const result = recordGameResult(session, game.id, winner, now);
      return result.applied ? proposeGameIfPossible(result.session, this.state().players, now) : session;
    }, `Team ${winner} recorded as the winner. The next game is ready when enough players are waiting.`);
  }

  cancelProposedGame(): void {
    this.updateSession((session, now) => {
      const game = findLatest(session.games, (candidate) => candidate.status === 'PROPOSED');
      if (!game) throw new Error('There is no proposed game to cancel.');
      return cancelProposal(session, game.id, now);
    }, 'Proposed game cancelled.');
  }

  sessionPlayer(playerId: string) {
    return this.currentSession()?.players.find((player) => player.playerId === playerId) ?? null;
  }

  profile(playerId: string): PlayerProfile | null {
    return this.state().players.find((player) => player.id === playerId) ?? null;
  }

  clearNotice(): void {
    this.notice.set('');
  }

  private updateSession(
    update: (session: PickupSession, now: string) => PickupSession,
    successMessage: string
  ): void {
    const now = new Date().toISOString();
    this.commit((state) => {
      if (!state.activeSessionId) throw new Error('Create a session first.');
      return {
        ...state,
        sessions: state.sessions.map((session) => session.id === state.activeSessionId
          ? update(session, now)
          : session)
      };
    }, successMessage);
  }

  private commit(update: (state: PickupFiveState) => PickupFiveState, successMessage: string): void {
    const visibleState = this.state();
    const storedState = this.storage.load() ?? visibleState;
    if (storedState.revision !== visibleState.revision) {
      this.state.set(storedState);
      this.showError('Newer session data was found and reloaded. Try the action again.');
      return;
    }

    try {
      const next = { ...update(visibleState), revision: visibleState.revision + 1 };
      this.storage.save(next, visibleState.revision);
      this.state.set(next);
      this.notice.set(successMessage);
      this.noticeTone.set('info');
      this.noticeSequence.update((sequence) => sequence + 1);
    } catch (error) {
      const latest = this.storage.load();
      if (latest) this.state.set(latest);
      this.showError(error instanceof Error ? error.message : 'The action could not be completed.');
    }
  }

  private showError(message: string): void {
    this.notice.set(message);
    this.noticeTone.set('error');
    this.noticeSequence.update((sequence) => sequence + 1);
  }
}

function initialState(): PickupFiveState {
  return {
    schemaVersion: 1,
    revision: 0,
    activeSessionId: null,
    players: [],
    sessions: [],
    organizerPinHash: hashPin(DEFAULT_PIN)
  };
}

function newSessionPlayer(playerId: string, tieBreakOrder: number) {
  return {
    playerId,
    state: 'REGISTERED' as const,
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

function proposeGameIfPossible(session: PickupSession, profiles: PlayerProfile[], now: string): PickupSession {
  if (session.status !== 'ACTIVE') return session;
  if (session.games.some((game) => game.status === 'PROPOSED' || game.status === 'IN_PROGRESS')) return session;
  const selected = selectNextPlayers(session);
  if (selected.length !== 10) return session;
  const balance = balanceTeams(selected, profiles, session.games);
  const game: PickupGame = {
    id: createId(),
    number: session.games.reduce((highest, candidate) => Math.max(highest, candidate.number), 0) + 1,
    status: 'PROPOSED',
    teamA: balance.teamA,
    teamB: balance.teamB,
    winner: null,
    fairnessApplied: false,
    rebalanceCount: 0,
    createdAt: now,
    startedAt: null,
    completedAt: null
  };
  return { ...session, games: [...session.games, game], updatedAt: now };
}

function cancelProposal(session: PickupSession, gameId: string, now: string): PickupSession {
  return {
    ...session,
    games: session.games.map((game) => game.id === gameId
      ? { ...game, status: 'CANCELLED' as const }
      : game),
    updatedAt: now
  };
}

function replacementCandidate(session: PickupSession, game: PickupGame): string | null {
  const currentPlayers = new Set([
    ...game.teamA,
    ...game.teamB,
    ...(game.creditedTeamA ?? []),
    ...(game.creditedTeamB ?? []),
    ...(game.replacements ?? []).flatMap((replacement) => [
      replacement.outgoingPlayerId,
      replacement.incomingPlayerId
    ])
  ]);
  return selectNextPlayers(session, session.players.length)
    .find((playerId) => !currentPlayers.has(playerId)) ?? null;
}

function createId(): string {
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

function findLatest(games: PickupGame[], predicate: (game: PickupGame) => boolean): PickupGame | null {
  for (let index = games.length - 1; index >= 0; index -= 1) {
    if (predicate(games[index])) return games[index];
  }
  return null;
}
