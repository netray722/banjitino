import { Injectable, computed, inject, signal } from '@angular/core';

import {
  cancelPickupProposal,
  checkPlayerIn,
  checkPlayerOut,
  endPickupSession,
  findLatestGame,
  generatePickupGame,
  rebalancePickupGame,
  recordPickupWinner,
  replacePlayerInGame,
  startPickupGame,
  startPickupSession,
  swapGamePlayers
} from './pickup-five-session.actions';
import {
  addPlayer,
  addSession,
  addTestData,
  archivePlayer,
  changePlayerRole,
  changeSessionName,
  editPlayer,
  removeGame,
  removeSession
} from './pickup-five-state.actions';
import { createId, createInitialState } from './pickup-five-state.factory';
import { BrowserPickupFiveStorage } from './pickup-five-storage.service';
import { NBA_TEST_PLAYERS } from './pickup-five-test-data.constants';
import { PickupFiveState, PickupSession, PlayerProfile, PlayerRole, TeamSide } from './pickup-five.types';

@Injectable({ providedIn: 'root' })
export class PickupFiveStateService {
  private readonly storage = inject(BrowserPickupFiveStorage);

  private readonly stateSource = signal(this.storage.load() ?? createInitialState());
  private readonly noticeSource = signal('');
  private readonly noticeToneSource = signal<'info' | 'error'>('info');
  private readonly noticeSequenceSource = signal(0);

  readonly state = this.stateSource.asReadonly();
  readonly notice = this.noticeSource.asReadonly();
  readonly noticeTone = this.noticeToneSource.asReadonly();
  readonly noticeSequence = this.noticeSequenceSource.asReadonly();
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
  readonly proposedGame = computed(() => findLatestGame(
    this.currentSession()?.games ?? [],
    (game) => game.status === 'PROPOSED'
  ));
  readonly currentGame = computed(() => {
    const games = this.currentSession()?.games ?? [];
    return findLatestGame(games, (game) => game.status === 'IN_PROGRESS' || game.status === 'LOCKED')
      ?? findLatestGame(games, (game) => game.status === 'COMPLETED')
      ?? null;
  });

  createSession(name: string): void {
    const trimmedName = name.trim();
    if (!trimmedName) return this.showError('Enter a session name.');
    const now = new Date().toISOString();
    this.commit((state) => addSession(state, trimmedName, now), 'Session created. Check-in is ready.');
  }

  openCheckIn(): void {
    this.updateSession((session, now) => {
      if (session.status !== 'DRAFT') throw new Error('Only a draft session can open check-in.');
      return { ...session, status: 'CHECK_IN', updatedAt: now };
    }, 'Check-in is open.');
  }

  startSession(): void {
    this.updateSession(
      (session, now) => startPickupSession(session, this.state().players, this.state().sessions, now),
      'Session started and the first game is ready.'
    );
  }

  endSession(): void {
    this.updateSession(endPickupSession, 'Session ended. History was saved.');
  }

  addPlayerAndCheckIn(playerNumberValue: string, displayName: string, role: PlayerRole): void {
    const playerNumber = Number(playerNumberValue);
    const name = displayName.trim();
    if (!Number.isInteger(playerNumber) || playerNumber < 0 || playerNumber > 999) {
      return this.showError('Player number must be a whole number from 0 to 999.');
    }
    if (!name) return this.showError('Enter the player’s name.');
    if (!['Guard', 'Wing', 'Big'].includes(role)) return this.showError('Choose a player role.');
    const now = new Date().toISOString();
    this.commit((state) => addPlayer(state, playerNumber, name, role, now), 'Player added and checked in.');
  }

  checkIn(playerId: string): void {
    this.updateSession((session, now) => checkPlayerIn(session, playerId, now), 'Player checked in.');
  }

  checkOut(playerId: string): void {
    this.updateSession((session, now) => checkPlayerOut(session, playerId, now), 'Player checked out.');
  }

  replacePlayer(playerId: string): void {
    this.updateSession(
      (session, now) => replacePlayerInGame(session, playerId, now),
      'The first waiting player substituted in. The outgoing player kept their queue position.'
    );
  }

  updatePlayer(playerId: string, update: Partial<Pick<PlayerProfile, 'displayName' | 'playerNumber'>>): void {
    const now = new Date().toISOString();
    this.commit((state) => editPlayer(state, playerId, update, now), 'Player profile updated.');
  }

  setRole(playerId: string, role: PlayerRole): void {
    const now = new Date().toISOString();
    this.commit((state) => changePlayerRole(state, playerId, role, now), 'Player role updated.');
  }

  removePlayer(playerId: string): void {
    const now = new Date().toISOString();
    this.commit(
      (state) => archivePlayer(state, playerId, now),
      'Player removed from the active roster. Past game history was preserved.'
    );
  }

  deleteGame(sessionId: string, gameId: string): void {
    const now = new Date().toISOString();
    this.commit(
      (state) => removeGame(state, sessionId, gameId, now),
      'Game record deleted. Queue fairness and player totals were not rewound.'
    );
  }

  deleteSession(sessionId: string): void {
    this.commit(
      (state) => removeSession(state, sessionId),
      'Session and its games deleted. The player roster was kept.'
    );
  }

  renameSession(sessionId: string, name: string): void {
    const trimmedName = name.trim();
    if (!trimmedName) return this.showError('Session name cannot be empty.');
    const now = new Date().toISOString();
    this.commit((state) => changeSessionName(state, sessionId, trimmedName, now), 'Session renamed.');
  }

  resetAllData(): void {
    this.commit(() => createInitialState(), 'All locally saved Pickup Five data was cleared.');
  }

  loadTestData(playerCount = 12): string | null {
    if (!Number.isInteger(playerCount) || playerCount < 10 || playerCount > NBA_TEST_PLAYERS.length) {
      this.showError(`Enter a whole number from 10 to ${NBA_TEST_PLAYERS.length}.`);
      return null;
    }
    const sessionId = createId();
    const now = new Date();
    this.commit(
      (state) => addTestData(state, playerCount, sessionId, now),
      `${playerCount} NBA test players and three completed games added.`
    );
    return this.state().sessions.some((session) => session.id === sessionId) ? sessionId : null;
  }

  generateGame(): void {
    this.updateSession(
      (session, now) => generatePickupGame(session, this.state().players, this.state().sessions, now),
      'Proposed teams are ready for review.'
    );
  }

  rebalanceGame(): void {
    this.updateSession(
      (session, now) => rebalancePickupGame(session, this.state().players, this.state().sessions, now),
      'The same ten players were rebalanced.'
    );
  }

  swapPlayers(firstPlayerId: string, secondPlayerId: string): void {
    this.updateSession(
      (session, now) => swapGamePlayers(session, firstPlayerId, secondPlayerId, now),
      'Players swapped.'
    );
  }

  startGame(): void {
    this.updateSession(startPickupGame, 'Game started and locked.');
  }

  recordWinner(winner: TeamSide): void {
    this.updateSession(
      (session, now) => recordPickupWinner(session, winner, this.state().players, this.state().sessions, now),
      `Team ${winner === 'A' ? 'White' : 'Black'} recorded as the winner. The next game is ready when enough players are waiting.`
    );
  }

  cancelProposedGame(): void {
    this.updateSession(cancelPickupProposal, 'Proposed game cancelled.');
  }

  sessionPlayer(playerId: string) {
    return this.currentSession()?.players.find((player) => player.playerId === playerId) ?? null;
  }

  profile(playerId: string): PlayerProfile | null {
    return this.state().players.find((player) => player.id === playerId) ?? null;
  }

  clearNotice(): void {
    this.noticeSource.set('');
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
      this.stateSource.set(storedState);
      this.showError('Newer session data was found and reloaded. Try the action again.');
      return;
    }

    try {
      const next = { ...update(visibleState), revision: visibleState.revision + 1 };
      this.storage.save(next, visibleState.revision);
      this.stateSource.set(next);
      this.noticeSource.set(successMessage);
      this.noticeToneSource.set('info');
      this.noticeSequenceSource.update((sequence) => sequence + 1);
    } catch (error) {
      const latest = this.storage.load();
      if (latest) this.stateSource.set(latest);
      this.showError(error instanceof Error ? error.message : 'The action could not be completed.');
    }
  }

  private showError(message: string): void {
    this.noticeSource.set(message);
    this.noticeToneSource.set('error');
    this.noticeSequenceSource.update((sequence) => sequence + 1);
  }
}
