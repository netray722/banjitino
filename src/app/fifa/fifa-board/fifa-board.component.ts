import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideRefreshCw } from '@lucide/angular';
import { Subject, catchError, interval, merge, of, startWith, switchMap, tap } from 'rxjs';

import { FifaDataService } from '../fifa-data.service';
import { FifaDetailsState, FifaMatch, FifaMatchDetails, FifaScoreboard } from '../fifa.models';
import { browserDateKey, formatFifaDate } from '../fifa.utils';
import { FifaMatchCardComponent } from '../fifa-match-card/fifa-match-card.component';

@Component({
  selector: 'app-fifa-board',
  imports: [FifaMatchCardComponent, LucideRefreshCw],
  templateUrl: './fifa-board.component.html',
  styleUrl: './fifa-board.component.css'
})
export class FifaBoardComponent implements OnInit {
  private readonly dataService = inject(FifaDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequest = new Subject<void>();

  protected readonly scoreboard = signal<FifaScoreboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expandedMatchId = signal<string | null>(null);
  protected readonly details = signal<Record<string, FifaDetailsState>>({});
  protected readonly lastUpdated = signal<Date | null>(null);
  protected readonly selectedDate = signal(browserDateKey());

  ngOnInit(): void {
    merge(interval(30_000), this.refreshRequest)
      .pipe(
        startWith(0),
        tap(() => {
          this.refreshing.set(true);
          if (!this.scoreboard()) {
            this.loading.set(true);
          }
        }),
        switchMap(() =>
          this.dataService.getScoreboard(this.selectedDate()).pipe(
            catchError(() => {
              this.error.set('FIFA World Cup scores are temporarily unavailable.');
              return of(null);
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((scoreboard) => {
        if (scoreboard) {
          this.scoreboard.set(scoreboard);
          this.lastUpdated.set(new Date());
          this.error.set(null);
        }
        this.loading.set(false);
        this.refreshing.set(false);
      });

    interval(20_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const match = this.currentExpandedMatch();
        if (match?.status === 'live') {
          this.loadDetails(match, true);
        }
      });
  }

  protected refresh(): void {
    this.refreshRequest.next();
  }

  protected openDatePicker(input: HTMLInputElement): void {
    input.focus();

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.click();
  }

  protected changeDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value || value === this.selectedDate()) {
      return;
    }

    this.selectedDate.set(value);
    this.expandedMatchId.set(null);
    this.details.set({});
    this.scoreboard.set(null);
    this.refresh();
  }

  protected toggleMatch(match: FifaMatch): void {
    if (this.expandedMatchId() === match.id) {
      this.expandedMatchId.set(null);
      return;
    }

    this.expandedMatchId.set(match.id);
    if (match.status !== 'scheduled' && !this.details()[match.id]?.data) {
      this.loadDetails(match);
    }
  }

  protected retryDetails(match: FifaMatch): void {
    this.loadDetails(match);
  }

  protected pageDate(): string {
    return formatFifaDate(this.selectedDate());
  }

  protected updatedLabel(): string {
    const date = this.lastUpdated();
    if (!date) {
      return 'Waiting for World Cup data';
    }

    return `Updated ${new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)}`;
  }

  protected detailsFor(matchId: string): FifaDetailsState | null {
    return this.details()[matchId] ?? null;
  }

  private currentExpandedMatch(): FifaMatch | undefined {
    const id = this.expandedMatchId();
    return this.scoreboard()?.matches.find((match) => match.id === id);
  }

  private loadDetails(match: FifaMatch, background = false): void {
    if (!background) {
      this.setDetailsState(match.id, { data: null, loading: true, error: null });
    }

    this.dataService
      .getMatchDetails(match.id)
      .pipe(
        catchError(() => {
          this.setDetailsState(match.id, {
            data: this.details()[match.id]?.data ?? null,
            loading: false,
            error: 'Match details are not available yet.'
          });
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((details: FifaMatchDetails | null) => {
        if (details) {
          this.setDetailsState(match.id, { data: details, loading: false, error: null });
        }
      });
  }

  private setDetailsState(matchId: string, state: FifaDetailsState): void {
    this.details.update((details) => ({ ...details, [matchId]: state }));
  }
}
