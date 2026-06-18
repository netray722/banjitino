import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideCalendarDays, LucideRefreshCw } from '@lucide/angular';
import { Subject, catchError, firstValueFrom, interval, of, takeUntil } from 'rxjs';

import { NbaDataService } from '../../data-access/nba-data.service';
import { BoxScore, BoxScoreState, NbaGame, Scoreboard } from '../../models/nba.models';
import { browserDateKey, formatGameDate } from '../../utils/nba.utils';
import { GameCardComponent } from '../game-card/game-card.component';

interface NbaTimelineDay {
  date: string;
  scoreboard: Scoreboard;
}

@Component({
  selector: 'app-nba-board',
  imports: [GameCardComponent, LucideCalendarDays, LucideRefreshCw],
  templateUrl: './nba-board.component.html',
  styleUrl: './nba-board.component.css'
})
export class NbaBoardComponent implements OnInit, AfterViewInit {
  private readonly dataService = inject(NbaDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly destroyed = new Subject<void>();
  private readonly cache = new Map<string, Scoreboard>();
  private readonly pending = new Map<string, Promise<Scoreboard | null>>();
  private observer?: IntersectionObserver;
  private generation = 0;
  private scrollFrame = 0;

  @ViewChild('previousSentinel') private previousSentinel?: ElementRef<HTMLElement>;
  @ViewChild('nextSentinel') private nextSentinel?: ElementRef<HTMLElement>;

  protected readonly days = signal<NbaTimelineDay[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingPrevious = signal(false);
  protected readonly hasEarlierDates = signal(true);
  protected readonly loadingNext = signal(false);
  protected readonly refreshing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expandedGameId = signal<string | null>(null);
  protected readonly boxScores = signal<Record<string, BoxScoreState>>({});
  protected readonly lastUpdated = signal<Date | null>(null);
  protected readonly activeDate = signal(browserDateKey());

  ngOnInit(): void {
    void this.jumpToDate(browserDateKey(), false);

    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.refreshActiveDate(true));

    interval(20_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const game = this.currentExpandedGame();
        if (game?.status === 'live') {
          this.loadBoxScore(game, true);
        }
      });

    this.destroyRef.onDestroy(() => {
      this.observer?.disconnect();
      this.destroyed.next();
      this.destroyed.complete();
      cancelAnimationFrame(this.scrollFrame);
    });
  }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !this.days().length) {
          continue;
        }
        if (entry.target === this.previousSentinel?.nativeElement) {
          void this.loadPrevious();
        } else if (entry.target === this.nextSentinel?.nativeElement) {
          void this.loadNext();
        }
      }
    }, { rootMargin: '120px 0px' });

    if (this.previousSentinel) this.observer.observe(this.previousSentinel.nativeElement);
    if (this.nextSentinel) this.observer.observe(this.nextSentinel.nativeElement);
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = requestAnimationFrame(() => {
      const sections = [...this.host.nativeElement.querySelectorAll<HTMLElement>('.timeline-day')];
      const marker = 180;
      const current = sections.find((section) => section.getBoundingClientRect().bottom > marker);
      const date = current?.dataset['date'];
      if (date) this.activeDate.set(date);
    });
  }

  protected refresh(): void {
    void this.refreshActiveDate(false);
  }

  protected openDatePicker(input: HTMLInputElement): void {
    input.focus();
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  }

  protected changeDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) void this.jumpToDate(value, true);
  }

  protected showTodayButton(): boolean {
    return this.activeDate() !== browserDateKey();
  }

  protected jumpToToday(): void {
    void this.jumpToDate(browserDateKey(), true);
  }

  protected toggleGame(game: NbaGame): void {
    if (this.expandedGameId() === game.id) {
      this.expandedGameId.set(null);
      return;
    }
    this.expandedGameId.set(game.id);
    if (game.status !== 'scheduled' && !this.boxScores()[game.id]?.data) this.loadBoxScore(game);
  }

  protected retryBoxScore(game: NbaGame): void {
    this.loadBoxScore(game);
  }

  protected loadEarlier(): void {
    void this.loadPrevious();
  }

  protected dateLabel(date: string): string {
    return formatGameDate(date);
  }

  protected fullDateLabel(date: string): string {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
      .format(parseDate(date));
  }

  protected updatedLabel(): string {
    const date = this.lastUpdated();
    return date ? `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)}` : 'Loading the schedule';
  }

  protected boxScoreFor(gameId: string): BoxScoreState | null {
    return this.boxScores()[gameId] ?? null;
  }

  private async jumpToDate(date: string, smooth: boolean): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set(null);
    this.expandedGameId.set(null);
    const landing = await this.findGameDay(date, 1) ?? await this.findGameDay(addDays(date, -1), -1);
    if (generation !== this.generation) return;
    if (!landing) {
      this.days.set([]);
      this.loading.set(false);
      this.error.set('No NBA games were found near that date.');
      return;
    }

    this.days.set([{ date: landing.gameDate, scoreboard: landing }]);
    this.hasEarlierDates.set(true);
    this.activeDate.set(landing.gameDate);
    this.lastUpdated.set(new Date());
    this.loading.set(false);
    const [previous, next] = await Promise.all([
      this.findGameDay(addDays(landing.gameDate, -1), -1),
      this.findGameDay(addDays(landing.gameDate, 1), 1)
    ]);
    if (generation !== this.generation) return;
    this.days.set(this.sortedUnique([previous, landing, next].filter((day): day is Scoreboard => Boolean(day))));
    setTimeout(() => {
      this.observeSentinels();
      this.scrollToDay(landing.gameDate, smooth);
    });
  }

  private async loadPrevious(): Promise<void> {
    if (this.loadingPrevious() || this.loading() || !this.hasEarlierDates()) return;
    const first = this.days()[0];
    if (!first) return;
    this.loadingPrevious.set(true);
    const scoreboard = await this.findGameDay(addDays(first.date, -1), -1);
    if (scoreboard) this.days.update((days) => this.sortedUnique([scoreboard, ...days.map((day) => day.scoreboard)]));
    else this.hasEarlierDates.set(false);
    this.loadingPrevious.set(false);
  }

  private async loadNext(): Promise<void> {
    if (this.loadingNext() || this.loading()) return;
    const last = this.days().at(-1);
    if (!last) return;
    this.loadingNext.set(true);
    const scoreboard = await this.findGameDay(addDays(last.date, 1), 1);
    if (scoreboard) this.days.update((days) => this.sortedUnique([...days.map((day) => day.scoreboard), scoreboard]));
    this.loadingNext.set(false);
  }

  private async findGameDay(start: string, direction: 1 | -1): Promise<Scoreboard | null> {
    let date = start;
    for (let attempt = 0; attempt < 45; attempt += 1) {
      const scoreboard = await this.fetchDate(date);
      if (scoreboard?.games.length) return { ...scoreboard, gameDate: date };
      date = addDays(date, direction);
    }
    return null;
  }

  private fetchDate(date: string, force = false): Promise<Scoreboard | null> {
    if (!force && this.cache.has(date)) return Promise.resolve(this.cache.get(date)!);
    if (!force && this.pending.has(date)) return this.pending.get(date)!;
    const request = firstValueFrom(
      this.dataService.getScoreboard(date === browserDateKey() ? undefined : date).pipe(
        catchError(() => of(null)),
        takeUntil(this.destroyed)
      )
    ).then((scoreboard) => {
      if (scoreboard) this.cache.set(date, { ...scoreboard, gameDate: date });
      this.pending.delete(date);
      return scoreboard ? { ...scoreboard, gameDate: date } : null;
    });
    this.pending.set(date, request);
    return request;
  }

  private async refreshActiveDate(background: boolean): Promise<void> {
    const date = this.activeDate();
    if (!this.days().some((day) => day.date === date) || this.refreshing()) return;
    this.refreshing.set(true);
    const scoreboard = await this.fetchDate(date, true);
    if (scoreboard) {
      this.days.update((days) => days.map((day) => day.date === date ? { date, scoreboard } : day));
      this.lastUpdated.set(new Date());
      this.error.set(null);
    } else if (!background) {
      this.error.set('Live scores are temporarily unavailable. Try again shortly.');
    }
    this.refreshing.set(false);
  }

  private sortedUnique(scoreboards: Scoreboard[]): NbaTimelineDay[] {
    return [...new Map(scoreboards.map((scoreboard) => [scoreboard.gameDate, scoreboard])).values()]
      .sort((left, right) => left.gameDate.localeCompare(right.gameDate))
      .map((scoreboard) => ({ date: scoreboard.gameDate, scoreboard }));
  }

  private scrollToDay(date: string, smooth: boolean): void {
    const element = this.host.nativeElement.querySelector<HTMLElement>(`[data-date="${date}"]`);
    if (typeof element?.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
    }
  }

  private observeSentinels(): void {
    if (!this.observer) return;
    if (this.previousSentinel) this.observer.observe(this.previousSentinel.nativeElement);
    if (this.nextSentinel) this.observer.observe(this.nextSentinel.nativeElement);
  }

  private currentExpandedGame(): NbaGame | undefined {
    const id = this.expandedGameId();
    return this.days().flatMap((day) => day.scoreboard.games).find((game) => game.id === id);
  }

  private loadBoxScore(game: NbaGame, background = false): void {
    if (!background) this.setBoxScoreState(game.id, { data: null, loading: true, error: null });
    this.dataService.getBoxScore(game).pipe(
      catchError(() => {
        this.setBoxScoreState(game.id, { data: this.boxScores()[game.id]?.data ?? null, loading: false, error: 'Box score is not available yet.' });
        return of(null);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((boxScore: BoxScore | null) => {
      if (boxScore) this.setBoxScoreState(game.id, { data: boxScore, loading: false, error: null });
    });
  }

  private setBoxScoreState(gameId: string, state: BoxScoreState): void {
    this.boxScores.update((scores) => ({ ...scores, [gameId]: state }));
  }
}

function addDays(date: string, amount: number): string {
  const value = parseDate(date);
  value.setDate(value.getDate() + amount);
  return browserDateKey(value);
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
