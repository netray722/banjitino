import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideRefreshCw } from '@lucide/angular';
import { Subject, catchError, interval, merge, of, startWith, switchMap, tap } from 'rxjs';

import { GameCardComponent } from './game-card/game-card.component';
import { BoxScore, BoxScoreState, NbaGame, Scoreboard } from './nba.models';
import { NbaDataService } from './nba-data.service';
import { formatGameDate } from './nba.utils';

@Component({
  selector: 'app-root',
  imports: [GameCardComponent, LucideRefreshCw],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly dataService = inject(NbaDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequest = new Subject<void>();

  protected readonly scoreboard = signal<Scoreboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expandedGameId = signal<string | null>(null);
  protected readonly boxScores = signal<Record<string, BoxScoreState>>({});
  protected readonly lastUpdated = signal<Date | null>(null);

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
          this.dataService.getScoreboard().pipe(
            catchError(() => {
              this.error.set('Live scores are temporarily unavailable. Try again shortly.');
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
        const game = this.currentExpandedGame();
        if (game?.status === 'live') {
          this.loadBoxScore(game, true);
        }
      });
  }

  protected refresh(): void {
    this.refreshRequest.next();
  }

  protected toggleGame(game: NbaGame): void {
    if (this.expandedGameId() === game.id) {
      this.expandedGameId.set(null);
      return;
    }

    this.expandedGameId.set(game.id);
    if (game.status !== 'scheduled' && !this.boxScores()[game.id]?.data) {
      this.loadBoxScore(game);
    }
  }

  protected retryBoxScore(game: NbaGame): void {
    this.loadBoxScore(game);
  }

  protected pageDate(): string {
    return formatGameDate(this.scoreboard()?.gameDate);
  }

  protected updatedLabel(): string {
    const date = this.lastUpdated();
    if (!date) {
      return 'Waiting for live data';
    }

    return `Updated ${new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)}`;
  }

  protected boxScoreFor(gameId: string): BoxScoreState | null {
    return this.boxScores()[gameId] ?? null;
  }

  private currentExpandedGame(): NbaGame | undefined {
    const id = this.expandedGameId();
    return this.scoreboard()?.games.find((game) => game.id === id);
  }

  private loadBoxScore(game: NbaGame, background = false): void {
    if (!background) {
      this.setBoxScoreState(game.id, { data: null, loading: true, error: null });
    }

    this.dataService
      .getBoxScore(game.id)
      .pipe(
        catchError(() => {
          this.setBoxScoreState(game.id, {
            data: this.boxScores()[game.id]?.data ?? null,
            loading: false,
            error: 'Box score is not available yet.'
          });
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((boxScore: BoxScore | null) => {
        if (boxScore) {
          this.setBoxScoreState(game.id, { data: boxScore, loading: false, error: null });
        }
      });
  }

  private setBoxScoreState(gameId: string, state: BoxScoreState): void {
    this.boxScores.update((scores) => ({ ...scores, [gameId]: state }));
  }
}
