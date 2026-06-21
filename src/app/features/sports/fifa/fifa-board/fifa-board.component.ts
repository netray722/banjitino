import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideCalendarDays, LucideRefreshCw } from '@lucide/angular';
import { Subject, catchError, firstValueFrom, interval, of, takeUntil } from 'rxjs';

import { TimelinePreviousLoaderComponent } from '../../../../shared/timeline/timeline-previous-loader.component';
import { browserDateKey, formatFifaDate } from '../fifa-data';
import { FifaDataService } from '../fifa-data.service';
import { FifaDetailsState, FifaMatch, FifaMatchDetails, FifaScoreboard } from '../fifa.types';
import { FifaMatchCardComponent } from '../fifa-match-card/fifa-match-card.component';
import { TOURNAMENT_END, TOURNAMENT_START } from './fifa-board.constants';
import { FifaTimelineDay } from './fifa-board.types';

@Component({ selector: 'app-fifa-board', imports: [FifaMatchCardComponent, TimelinePreviousLoaderComponent, LucideCalendarDays, LucideRefreshCw], templateUrl: './fifa-board.component.html', styleUrl: './fifa-board.component.scss' })
export class FifaBoardComponent implements OnInit, AfterViewInit {
  private readonly dataService = inject(FifaDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly destroyed = new Subject<void>();
  private readonly cache = new Map<string, FifaScoreboard>();
  private readonly pending = new Map<string, Promise<FifaScoreboard | null>>();
  private observer?: IntersectionObserver;
  private generation = 0;
  private scrollFrame = 0;

  private readonly nextSentinel = viewChild<ElementRef<HTMLElement>>('nextSentinel');

  protected readonly days = signal<FifaTimelineDay[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingPrevious = signal(false);
  protected readonly hasEarlierDates = signal(true);
  protected readonly loadingNext = signal(false);
  protected readonly refreshing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expandedMatchId = signal<string | null>(null);
  protected readonly details = signal<Record<string, FifaDetailsState>>({});
  protected readonly lastUpdated = signal<Date | null>(null);
  protected readonly activeDate = signal(clampDate(browserDateKey()));

  ngOnInit(): void {
    void this.jumpToDate(clampDate(browserDateKey()), false);
    this.startScoreboardRefresh();
    this.startLiveDetailsRefresh();
    this.registerCleanup();
  }

  ngAfterViewInit(): void {
    this.observeUpcomingDates();
  }

  private startScoreboardRefresh(): void {
    interval(30_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => void this.refreshActiveDate(true));
  }

  private startLiveDetailsRefresh(): void {
    interval(20_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const match = this.currentExpandedMatch();
      if (match?.status === 'live') this.loadDetails(match, true);
    });
  }

  private registerCleanup(): void {
    this.destroyRef.onDestroy(() => {
      this.observer?.disconnect();
      this.destroyed.next();
      this.destroyed.complete();
      cancelAnimationFrame(this.scrollFrame);
    });
  }

  private observeUpcomingDates(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !this.days().length) continue;
        if (entry.target === this.nextSentinel()?.nativeElement) void this.loadNext();
      }
    }, { rootMargin: '120px 0px' });
    const nextSentinel = this.nextSentinel();
    if (nextSentinel) this.observer.observe(nextSentinel.nativeElement);
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = requestAnimationFrame(() => {
      const section = [...this.host.nativeElement.querySelectorAll<HTMLElement>('.timeline-day')]
        .find((item) => item.getBoundingClientRect().bottom > 180);
      const date = section?.dataset['date'];
      if (date) this.activeDate.set(date);
    });
  }

  protected refresh(): void { void this.refreshActiveDate(false); }
  protected openDatePicker(input: HTMLInputElement): void { input.focus(); if (typeof input.showPicker === 'function') input.showPicker(); else input.click(); }
  protected changeDate(event: Event): void { const value = (event.target as HTMLInputElement).value; if (value) void this.jumpToDate(clampDate(value), true); }
  protected showTodayButton(): boolean { const today = browserDateKey(); return today >= TOURNAMENT_START && today <= TOURNAMENT_END && this.activeDate() !== today; }
  protected jumpToToday(): void { void this.jumpToDate(browserDateKey(), true); }
  protected toggleMatch(match: FifaMatch): void {
    if (this.expandedMatchId() === match.id) { this.expandedMatchId.set(null); return; }
    this.expandedMatchId.set(match.id);
    if (match.status !== 'scheduled' && !this.details()[match.id]?.data) this.loadDetails(match);
  }
  protected retryDetails(match: FifaMatch): void { this.loadDetails(match); }
  protected loadEarlier(): void { void this.loadPrevious(); }
  protected dateLabel(date: string): string { return formatFifaDate(date); }
  protected fullDateLabel(date: string): string { return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(parseDate(date)); }
  protected updatedLabel(): string { const date = this.lastUpdated(); return date ? `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)}` : 'Loading the tournament'; }
  protected detailsFor(matchId: string): FifaDetailsState | null { return this.details()[matchId] ?? null; }

  private async jumpToDate(date: string, smooth: boolean): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true); this.error.set(null); this.expandedMatchId.set(null);
    const landing = await this.findGameDay(date, 1) ?? await this.findGameDay(addDays(date, -1), -1);
    if (generation !== this.generation) return;
    if (!landing) { this.days.set([]); this.loading.set(false); this.error.set('No World Cup matches were found in the tournament window.'); return; }
    this.days.set([{ date: landing.matchDate, scoreboard: landing }]); this.hasEarlierDates.set(landing.matchDate > TOURNAMENT_START); this.activeDate.set(landing.matchDate); this.lastUpdated.set(new Date()); this.loading.set(false);
    const [previous, next] = await Promise.all([this.findGameDay(addDays(landing.matchDate, -1), -1), this.findGameDay(addDays(landing.matchDate, 1), 1)]);
    if (generation !== this.generation) return;
    this.days.set(this.sortedUnique([previous, landing, next].filter((day): day is FifaScoreboard => Boolean(day))));
    setTimeout(() => { this.observeSentinels(); this.scrollToDay(landing.matchDate, smooth); });
  }

  private async loadPrevious(): Promise<void> {
    if (this.loadingPrevious() || this.loading() || !this.hasEarlierDates()) return;
    const first = this.days()[0]; if (!first || first.date <= TOURNAMENT_START) return;
    this.loadingPrevious.set(true);
    const scoreboard = await this.findGameDay(addDays(first.date, -1), -1);
    if (scoreboard) {
      this.days.update((days) => this.sortedUnique([scoreboard, ...days.map((day) => day.scoreboard)]));
      this.hasEarlierDates.set(scoreboard.matchDate > TOURNAMENT_START);
    }
    else this.hasEarlierDates.set(false);
    this.loadingPrevious.set(false);
  }
  private async loadNext(): Promise<void> {
    if (this.loadingNext() || this.loading()) return;
    const last = this.days().at(-1); if (!last || last.date >= TOURNAMENT_END) return;
    this.loadingNext.set(true);
    const scoreboard = await this.findGameDay(addDays(last.date, 1), 1);
    if (scoreboard) this.days.update((days) => this.sortedUnique([...days.map((day) => day.scoreboard), scoreboard]));
    this.loadingNext.set(false);
  }

  private async findGameDay(start: string, direction: 1 | -1): Promise<FifaScoreboard | null> {
    let date = start;
    while (date >= TOURNAMENT_START && date <= TOURNAMENT_END) {
      const scoreboard = await this.fetchDate(date);
      if (scoreboard?.matches.length) return { ...scoreboard, matchDate: date };
      date = addDays(date, direction);
    }
    return null;
  }
  private fetchDate(date: string, force = false): Promise<FifaScoreboard | null> {
    if (!force && this.cache.has(date)) return Promise.resolve(this.cache.get(date)!);
    if (!force && this.pending.has(date)) return this.pending.get(date)!;
    const request = firstValueFrom(this.dataService.getScoreboard(date).pipe(catchError(() => of(null)), takeUntil(this.destroyed)))
      .then((scoreboard) => { if (scoreboard) this.cache.set(date, { ...scoreboard, matchDate: date }); this.pending.delete(date); return scoreboard ? { ...scoreboard, matchDate: date } : null; });
    this.pending.set(date, request); return request;
  }
  private async refreshActiveDate(background: boolean): Promise<void> {
    const date = this.activeDate();
    if (!this.days().some((day) => day.date === date) || this.refreshing()) return;
    this.refreshing.set(true);
    const scoreboard = await this.fetchDate(date, true);
    if (scoreboard) { this.days.update((days) => days.map((day) => day.date === date ? { date, scoreboard } : day)); this.lastUpdated.set(new Date()); this.error.set(null); }
    else if (!background) this.error.set('FIFA World Cup scores are temporarily unavailable.');
    this.refreshing.set(false);
  }
  private sortedUnique(scoreboards: FifaScoreboard[]): FifaTimelineDay[] {
    return [...new Map(scoreboards.map((scoreboard) => [scoreboard.matchDate, scoreboard])).values()]
      .sort((left, right) => left.matchDate.localeCompare(right.matchDate)).map((scoreboard) => ({ date: scoreboard.matchDate, scoreboard }));
  }
  private scrollToDay(date: string, smooth: boolean): void { const element = this.host.nativeElement.querySelector<HTMLElement>(`[data-date="${date}"]`); if (typeof element?.scrollIntoView === 'function') element.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' }); }
  private observeSentinels(): void { const nextSentinel = this.nextSentinel(); if (this.observer && nextSentinel) this.observer.observe(nextSentinel.nativeElement); }
  private currentExpandedMatch(): FifaMatch | undefined { const id = this.expandedMatchId(); return this.days().flatMap((day) => day.scoreboard.matches).find((match) => match.id === id); }
  private loadDetails(match: FifaMatch, background = false): void {
    if (!background) this.setDetailsState(match.id, { data: null, loading: true, error: null });
    this.dataService.getMatchDetails(match.id).pipe(catchError(() => { this.setDetailsState(match.id, { data: this.details()[match.id]?.data ?? null, loading: false, error: 'Match details are not available yet.' }); return of(null); }), takeUntilDestroyed(this.destroyRef))
      .subscribe((details: FifaMatchDetails | null) => { if (details) this.setDetailsState(match.id, { data: details, loading: false, error: null }); });
  }
  private setDetailsState(matchId: string, state: FifaDetailsState): void { this.details.update((details) => ({ ...details, [matchId]: state })); }
}

function clampDate(date: string): string { return date < TOURNAMENT_START ? TOURNAMENT_START : date > TOURNAMENT_END ? TOURNAMENT_END : date; }
function addDays(date: string, amount: number): string { const value = parseDate(date); value.setDate(value.getDate() + amount); return browserDateKey(value); }
function parseDate(value: string): Date { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day, 12); }
