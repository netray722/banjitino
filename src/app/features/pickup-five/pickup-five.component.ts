import { DOCUMENT, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { LucideEllipsis, LucidePencil, LucideTrash2, LucideX } from '@lucide/angular';

import { selectNextPlayers } from './pickup-five-scheduling';
import { PickupFiveStateService } from './pickup-five-state.service';
import { NBA_TEST_PLAYERS } from './pickup-five-test-data.constants';
import { PickupGame, PickupSession, PlayerProfile, PlayerRole, SessionPlayerState } from './pickup-five.types';

type PickupTab = 'court' | 'organizer';

@Component({
  selector: 'app-pickup-five',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, LucideEllipsis, LucidePencil, LucideTrash2, LucideX],
  templateUrl: './pickup-five.component.html',
  styleUrl: './pickup-five.component.scss'
})
export class PickupFiveComponent {
  private readonly document = inject(DOCUMENT);
  private readonly view = this.document.defaultView;

  protected readonly pickup = inject(PickupFiveStateService);
  private readonly noticeAutoDismiss = effect((onCleanup) => {
    this.pickup.noticeSequence();
    if (!this.pickup.notice() || !this.view) return;
    const delay = this.pickup.noticeTone() === 'error' ? 8000 : 4500;
    const timeoutId = this.view.setTimeout(() => this.pickup.clearNotice(), delay);
    onCleanup(() => this.view?.clearTimeout(timeoutId));
  });
  protected readonly activeTab = signal<PickupTab>('court');
  protected readonly searchQuery = signal('');
  protected readonly selectedSwapPlayerId = signal<string | null>(null);
  protected readonly selectedHistorySessionId = signal<string | null>(this.pickup.state().activeSessionId);
  protected readonly selectedGame = signal<PickupGame | null>(null);
  protected readonly roles: PlayerRole[] = ['Guard', 'Wing', 'Big'];
  protected readonly maximumTestPlayerCount = NBA_TEST_PLAYERS.length;
  protected readonly defaultSessionName = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric'
  }).format(new Date()).replace(',', '');
  protected readonly session = this.pickup.currentSession;
  protected readonly proposedGame = this.pickup.proposedGame;
  protected readonly liveGame = computed(() => {
    const game = this.pickup.currentGame();
    return game?.status === 'IN_PROGRESS' || game?.status === 'LOCKED' ? game : null;
  });
  protected readonly courtGame = computed(() => this.liveGame() ?? this.proposedGame());
  protected readonly filteredPlayers = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    return this.pickup.players().filter((player) => !query
      || player.displayName.toLowerCase().includes(query)
      || player.playerNumber.toString().includes(query));
  });
  protected readonly waitingPlayers = computed(() => {
    const session = this.session();
    if (!session) return [];
    return selectNextPlayers(session, session.players.length)
      .map((id) => this.pickup.profile(id))
      .filter((player): player is PlayerProfile => Boolean(player));
  });
  protected readonly presentCount = computed(() => this.session()?.players.filter((player) =>
    player.state === 'WAITING' || player.state === 'PLAYING' || player.state === 'LEAVING_AFTER_GAME').length ?? 0);
  protected readonly checkInOpen = computed(() =>
    this.session()?.status !== 'ENDED' && Boolean(this.session()));
  protected readonly sessionHistory = computed(() => [...this.pickup.state().sessions]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()));
  protected readonly selectedHistorySession = computed<PickupSession | null>(() => {
    const sessions = this.pickup.state().sessions;
    return sessions.find((session) => session.id === this.selectedHistorySessionId())
      ?? this.session()
      ?? this.sessionHistory().at(0)
      ?? null;
  });
  protected readonly historyGames = computed(() => [...(this.selectedHistorySession()?.games ?? [])]
    .filter((game) => game.status === 'COMPLETED')
    .sort((left, right) => new Date(right.completedAt ?? right.createdAt).getTime()
      - new Date(left.completedAt ?? left.createdAt).getTime()));

  protected showTab(tab: PickupTab): void {
    this.activeTab.set(tab);
  }

  protected openCheckIn(dialog: HTMLDialogElement): void {
    this.searchQuery.set('');
    dialog.showModal();
  }

  protected closeCheckIn(dialog: HTMLDialogElement): void {
    dialog.close();
  }

  protected updateSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected createSession(name: string): void {
    const session = this.session();
    if (session && session.status !== 'ENDED'
      && !this.view?.confirm('Create a new session? The current session will remain in history.')) return;
    this.pickup.createSession(name);
    this.selectedHistorySessionId.set(this.session()?.id ?? null);
    this.activeTab.set('organizer');
  }

  protected addPlayer(
    numberInput: HTMLInputElement,
    nameInput: HTMLInputElement,
    roleSelect: HTMLSelectElement
  ): void {
    const playerCount = this.pickup.players().length;
    this.pickup.addPlayerAndCheckIn(numberInput.value, nameInput.value, roleSelect.value as PlayerRole);
    if (this.pickup.players().length > playerCount) {
      numberInput.value = '';
      nameInput.value = '';
      roleSelect.value = 'Wing';
      numberInput.focus();
    }
  }

  protected checkOut(playerId: string): void {
    const player = this.pickup.profile(playerId);
    const game = this.courtGame();
    const isInOpenGame = Boolean(game && [...game.teamA, ...game.teamB].includes(playerId));
    const action = isInOpenGame
      ? 'The first waiting player will substitute immediately.'
      : 'They will be removed from the waiting queue.';
    if (!this.view?.confirm(`Check out ${player?.displayName ?? 'this player'}? ${action}`)) return;
    this.pickup.checkOut(playerId);
  }

  protected replacePlayer(playerId: string): void {
    const player = this.pickup.profile(playerId);
    if (!this.view?.confirm(
      `Replace ${player?.displayName ?? 'this player'}? The first waiting player will sub in, and the outgoing player keeps a fair queue position.`
    )) return;
    this.pickup.replacePlayer(playerId);
  }

  protected startSession(): void {
    this.pickup.startSession();
    if (this.session()?.status === 'ACTIVE') this.activeTab.set('court');
  }

  protected endSession(): void {
    if (!this.view?.confirm('End this session? All present players will be checked out.')) return;
    this.pickup.endSession();
    this.activeTab.set('organizer');
  }

  protected removePlayer(player: PlayerProfile, menu?: HTMLDetailsElement): void {
    if (menu) menu.open = false;
    if (!this.view?.confirm(
      `Remove ${player.displayName} from the roster? Past game history will keep their name.`
    )) return;
    this.pickup.removePlayer(player.id);
  }

  protected deleteGame(game: PickupGame): void {
    const session = this.selectedHistorySession();
    if (!session || !this.view?.confirm(
      `Delete Game ${game.number} from this session? This will not rewind queue fairness or player totals.`
    )) return;
    this.pickup.deleteGame(session.id, game.id);
  }

  protected renameSession(session: PickupSession, menu: HTMLDetailsElement): void {
    menu.open = false;
    const name = this.view?.prompt('Rename session', session.name)?.trim();
    if (!name || name === session.name) return;
    this.pickup.renameSession(session.id, name);
  }

  protected deleteSession(session: PickupSession, menu?: HTMLDetailsElement): void {
    if (menu) menu.open = false;
    if (!this.view?.confirm(
      `Delete “${session.name}” and all of its games? The registered player roster will remain.`
    )) return;
    this.pickup.deleteSession(session.id);
    if (this.selectedHistorySessionId() === session.id) {
      const sessions = this.pickup.state().sessions;
      this.selectedHistorySessionId.set(this.pickup.state().activeSessionId ?? sessions[sessions.length - 1]?.id ?? null);
    }
  }

  protected resetAllData(): void {
    if (!this.view?.confirm(
      'Clear all locally saved Pickup Five data? Every player, session, and game will be permanently removed.'
    )) return;
    this.pickup.resetAllData();
    this.selectedHistorySessionId.set(null);
    this.selectedGame.set(null);
    this.activeTab.set('organizer');
  }

  protected loadTestData(playerCount: string): void {
    const sessionId = this.pickup.loadTestData(Number(playerCount));
    if (sessionId) this.selectedHistorySessionId.set(sessionId);
  }

  protected selectHistorySession(sessionId: string): void {
    this.selectedHistorySessionId.set(sessionId);
  }

  protected openGameDetails(game: PickupGame, dialog: HTMLDialogElement): void {
    this.selectedGame.set(game);
    dialog.showModal();
  }

  protected closeGameDetails(dialog: HTMLDialogElement): void {
    dialog.close();
    this.selectedGame.set(null);
  }

  protected cancelGame(): void {
    if (!this.view?.confirm('Cancel the proposed game?')) return;
    this.pickup.cancelProposedGame();
  }

  protected recordWinner(winner: 'A' | 'B'): void {
    if (!this.view?.confirm(`Record Team ${winner} as the winner?`)) return;
    this.pickup.recordWinner(winner);
  }

  protected selectSwapPlayer(playerId: string): void {
    const selected = this.selectedSwapPlayerId();
    if (!selected) {
      this.selectedSwapPlayerId.set(playerId);
      return;
    }
    if (selected === playerId) {
      this.selectedSwapPlayerId.set(null);
      return;
    }
    this.pickup.swapPlayers(selected, playerId);
    this.selectedSwapPlayerId.set(null);
  }

  protected teamPlayers(game: PickupGame, team: 'A' | 'B'): PlayerProfile[] {
    return (team === 'A' ? game.teamA : game.teamB)
      .map((id) => this.pickup.profile(id))
      .filter((player): player is PlayerProfile => Boolean(player));
  }

  protected stateFor(playerId: string): SessionPlayerState {
    return this.pickup.sessionPlayer(playerId)?.state ?? 'REGISTERED';
  }

  protected isPresent(playerId: string): boolean {
    const state = this.stateFor(playerId);
    return state === 'WAITING' || state === 'PLAYING' || state === 'LEAVING_AFTER_GAME';
  }

  protected statusLabel(state: SessionPlayerState): string {
    const labels: Record<SessionPlayerState, string> = {
      REGISTERED: 'Registered',
      WAITING: 'Waiting',
      PLAYING: 'Playing',
      LEAVING_AFTER_GAME: 'Leaving after game',
      CHECKED_OUT: 'Checked out',
      NO_SHOW: 'No-show'
    };
    return labels[state];
  }

  protected playerStatsLabel(playerId: string): string {
    const player = this.pickup.sessionPlayer(playerId);
    if (!player) return '';
    const winPercentage = player.gamesPlayed === 0 ? 0 : Math.round(player.wins / player.gamesPlayed * 100);
    return `Game ${player.gamesPlayed} · W/L ${player.wins}–${player.losses} · Rate ${winPercentage}%`;
  }

  protected careerWinRateLabel(playerId: string): string {
    const winRate = this.pickup.careerWinRates().get(playerId);
    return winRate === undefined ? '—' : `${winRate}%`;
  }

  protected primaryRole(player: PlayerProfile): PlayerRole {
    return player.roles[0] ?? 'Wing';
  }

  protected isPartialSub(game: PickupGame, playerId: string): boolean {
    return game.status === 'IN_PROGRESS'
      && (game.replacements ?? []).some((replacement) => replacement.incomingPlayerId === playerId);
  }

  protected updateNumber(playerId: string, value: string): void {
    const playerNumber = Number(value);
    if (!Number.isInteger(playerNumber)) return;
    this.pickup.updatePlayer(playerId, { playerNumber });
  }

  protected updateName(playerId: string, value: string): void {
    this.pickup.updatePlayer(playerId, { displayName: value });
  }

  protected gameTime(game: PickupGame): string {
    const timestamp = game.completedAt ?? game.startedAt ?? game.createdAt;
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
  }

  protected gameDuration(game: PickupGame): string {
    if (!game.startedAt || !game.completedAt) return '—';
    const minutes = Math.max(1, Math.round(
      (new Date(game.completedAt).getTime() - new Date(game.startedAt).getTime()) / 60_000
    ));
    if (minutes < 60) return `${minutes} min`;
    const remainingMinutes = minutes % 60;
    return `${Math.floor(minutes / 60)} hr${remainingMinutes ? ` ${remainingMinutes} min` : ''}`;
  }

  protected completedGameCount(session: PickupSession): number {
    return session.games.filter((game) => game.status === 'COMPLETED').length;
  }

  protected historySessionName(session: PickupSession | null): string {
    if (!session) return 'Select a session';
    return session.name.startsWith('Test History — ') ? 'Test History' : session.name;
  }
}
