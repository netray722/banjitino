import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { TimelineDateToolbarComponent } from '../../../../shared/timeline/timeline-date-toolbar/timeline-date-toolbar.component';
import { TimelinePreviousLoaderComponent } from '../../../../shared/timeline/timeline-previous-loader.component';
import { NBA_FIRST_TRANSACTION_SEASON } from '../nba-data.constants';
import { browserDateKey, currentNbaSeason, formatGameDate } from '../nba-data';
import { NbaDataService } from '../nba-data.service';
import { groupNbaTrades } from '../nba-trades';
import { NbaPlayerEnrichmentState, NbaTradeEntry, NbaTradeGroup } from '../nba.types';
import { TradeCardComponent } from '../trade-card/trade-card.component';
import { NbaTradeDay } from './trade-timeline.types';

@Component({
  selector: 'app-trade-timeline',
  imports: [TimelineDateToolbarComponent, TimelinePreviousLoaderComponent, TradeCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trade-timeline.component.html',
  styleUrl: './trade-timeline.component.scss'
})
export class TradeTimelineComponent implements OnInit {
  private readonly dataService = inject(NbaDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private generation = 0;

  protected readonly today = browserDateKey();
  protected readonly activeDate = signal(browserDateKey());
  protected readonly trades = signal<NbaTradeEntry[]>([]);
  protected readonly loadedSeasons = signal<string[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingOlder = signal(false);
  protected readonly refreshing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expandedTradeId = signal<string | null>(null);
  protected readonly playerEnrichment = signal<Record<string, NbaPlayerEnrichmentState>>({});
  protected readonly tradeGroups = computed(() => groupNbaTrades(this.trades()).filter((trade) => trade.date <= this.activeDate()));
  protected readonly days = computed<NbaTradeDay[]>(() => {
    const groups = new Map<string, NbaTradeGroup[]>();
    for (const trade of this.tradeGroups()) groups.set(trade.date, [...(groups.get(trade.date) ?? []), trade]);
    return [...groups].map(([date, trades]) => ({ date, trades })).sort((left, right) => left.date.localeCompare(right.date));
  });
  protected readonly hasEarlier = computed(() => {
    const oldest = Math.min(...this.loadedSeasons().map((season) => Number.parseInt(season.slice(0, 4), 10)));
    return Number.isFinite(oldest) && oldest > NBA_FIRST_TRANSACTION_SEASON;
  });

  ngOnInit(): void { void this.jumpToDate(browserDateKey(), false); }

  protected changeDate(value: string): void { void this.jumpToDate(value, true); }
  protected jumpToToday(): void { void this.jumpToDate(browserDateKey(), true); }
  protected showTodayButton(): boolean { return this.activeDate() !== browserDateKey(); }
  protected retry(): void { void this.jumpToDate(this.activeDate(), false); }
  protected refresh(): void { void this.refreshLoadedSeasons(); }
  protected dateLabel(date: string): string { return formatGameDate(date); }
  protected fullDateLabel(date: string): string {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(parseDate(date));
  }
  protected updatedLabel(): string {
    const date = this.lastUpdated;
    return date ? `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)}` : 'Loading trades';
  }
  protected playerStateFor(tradeId: string): NbaPlayerEnrichmentState | null { return this.playerEnrichment()[tradeId] ?? null; }
  protected toggleTrade(trade: NbaTradeGroup): void {
    if (this.expandedTradeId() === trade.id) {
      this.expandedTradeId.set(null);
      return;
    }
    this.expandedTradeId.set(trade.id);
    if (!this.playerEnrichment()[trade.id]) this.loadPlayerEnrichment(trade);
  }
  protected retryPlayerEnrichment(trade: NbaTradeGroup): void {
    this.dataService.clearPlayerSummaryCache(trade.playerNames, trade.season);
    this.loadPlayerEnrichment(trade);
  }
  protected loadEarlier(): void { void this.loadPreviousSeason(); }

  private lastUpdated: Date | null = null;

  private async jumpToDate(date: string, smooth: boolean): Promise<void> {
    const generation = ++this.generation;
    this.activeDate.set(date);
    this.loading.set(true);
    this.error.set(null);
    this.expandedTradeId.set(null);
    this.trades.set([]);
    this.loadedSeasons.set([]);
    this.playerEnrichment.set({});

    let season = currentNbaSeason(parseDate(date));
    while (seasonStart(season) >= NBA_FIRST_TRANSACTION_SEASON) {
      try {
        const entries = await this.loadSeasonEntries(season);
        if (generation !== this.generation) return;
        this.addSeason(season, entries);
        if (entries.some((entry) => entry.date <= date)) break;
        season = previousSeason(season);
      } catch {
        if (generation !== this.generation) return;
        this.error.set('Trade history is temporarily unavailable. Try again shortly.');
        break;
      }
    }

    if (generation !== this.generation) return;
    this.lastUpdated = new Date();
    this.loading.set(false);
    const landingDate = this.days().at(-1)?.date;
    if (landingDate) setTimeout(() => this.scrollToDay(landingDate, smooth));
  }

  private async loadPreviousSeason(): Promise<void> {
    if (this.loadingOlder() || !this.hasEarlier()) return;
    const oldest = this.loadedSeasons().reduce((left, right) => seasonStart(left) < seasonStart(right) ? left : right);
    const season = previousSeason(oldest);
    this.loadingOlder.set(true);
    try {
      this.addSeason(season, await this.loadSeasonEntries(season));
      this.error.set(null);
    } catch {
      this.error.set('Older trades could not be loaded. Your current timeline is still available.');
    } finally {
      this.loadingOlder.set(false);
    }
  }

  private async refreshLoadedSeasons(): Promise<void> {
    if (this.refreshing() || this.loading()) return;
    const seasons = this.loadedSeasons();
    this.refreshing.set(true);
    try {
      const refreshed = await Promise.all(seasons.map(async (season) => ({ season, entries: await this.loadSeasonEntries(season) })));
      this.trades.set(refreshed.flatMap(({ entries }) => entries));
      this.lastUpdated = new Date();
      this.error.set(null);
    } catch {
      this.error.set('Trades could not be refreshed. Previously loaded results are still shown.');
    } finally {
      this.refreshing.set(false);
    }
  }

  private async loadSeasonEntries(season: string): Promise<NbaTradeEntry[]> {
    const entries: NbaTradeEntry[] = [];
    let page = 1;
    let pageCount = 1;
    do {
      const result = await firstValueFrom(this.dataService.getTrades(season, page).pipe(takeUntilDestroyed(this.destroyRef)));
      entries.push(...result.trades);
      page = result.page + 1;
      pageCount = result.pageCount;
    } while (page <= pageCount);
    return [...new Map(entries.map((entry) => [entry.id, entry])).values()];
  }

  private addSeason(season: string, entries: NbaTradeEntry[]): void {
    this.loadedSeasons.update((seasons) => [...new Set([...seasons, season])]);
    this.trades.update((trades) => [...new Map([...trades, ...entries].map((entry) => [entry.id, entry])).values()]);
  }

  private scrollToDay(date: string, smooth: boolean): void {
    const element = this.host.nativeElement.querySelector<HTMLElement>(`[data-date="${date}"]`);
    if (typeof element?.scrollIntoView === 'function') element.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  }

  private loadPlayerEnrichment(trade: NbaTradeGroup): void {
    const existing = this.playerEnrichment()[trade.id]?.data ?? {};
    this.setPlayerState(trade.id, { data: existing, loading: true, error: null });
    this.dataService.getPlayerSummaries(trade.playerNames, trade.season).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (batch) => this.setPlayerState(trade.id, {
        data: { ...existing, ...batch.data },
        loading: false,
        error: batch.failedNames.length ? 'Some player details are temporarily unavailable.' : null
      }),
      error: () => this.setPlayerState(trade.id, { data: existing, loading: false, error: 'Player details are temporarily unavailable.' })
    });
  }

  private setPlayerState(tradeId: string, state: NbaPlayerEnrichmentState): void {
    this.playerEnrichment.update((states) => ({ ...states, [tradeId]: state }));
  }
}

function previousSeason(season: string): string {
  const start = seasonStart(season) - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

function seasonStart(season: string): number { return Number.parseInt(season.slice(0, 4), 10); }

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
