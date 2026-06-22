import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap, tap } from 'rxjs';

import { NBA_MAX_PLAYER_ENRICHMENT_COUNT, NBA_TRADE_PAGE_SIZE } from './nba-data.constants';
import { browserDateKey, nbaPlayerKey, nbaSeasonDateRange, normalizeBoxScore, normalizeNbaPlayerSearch, normalizeNbaPlayerStats, normalizeNbaStandings, normalizeNbaTrades, normalizeScoreboard } from './nba-data';
import { BoxScore, NbaGame, NbaPlayerSeasonSummary, NbaPlayerSummaryBatch, NbaStanding, NbaTradePage, Scoreboard } from './nba.types';

@Injectable({ providedIn: 'root' })
export class NbaDataService {
  private readonly http = inject(HttpClient);
  private readonly playerCache = new Map<string, Observable<NbaPlayerSeasonSummary | null>>();
  private readonly successfulPlayerCacheKeys = new Set<string>();

  getScoreboard(gameDate?: string): Observable<Scoreboard> {
    if (gameDate) {
      return this.http
        .get<unknown>('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', {
          params: { dates: gameDate.replace(/-/g, '') }
        })
        .pipe(map(normalizeScoreboard));
    }

    return this.http.get<unknown>('/api/nba/scoreboard').pipe(
      catchError(() => this.getEspnScoreboard(browserDateKey())),
      map(normalizeScoreboard)
    );
  }

  getBoxScore(game: NbaGame): Observable<BoxScore> {
    if (game.source === 'espn') {
      return this.http
        .get<unknown>('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary', {
          params: { event: game.id }
        })
        .pipe(map(normalizeBoxScore));
    }

    return this.http
      .get<unknown>(`/api/nba/boxscore/${encodeURIComponent(game.id)}`)
      .pipe(map(normalizeBoxScore));
  }

  getStandings(): Observable<NbaStanding[]> {
    return this.http.get<unknown>('/api/nba/standings').pipe(map(normalizeNbaStandings));
  }

  getTrades(season: string, page = 1, limit = NBA_TRADE_PAGE_SIZE): Observable<NbaTradePage> {
    return this.http.get<unknown>('/api/nba/trades', {
      params: { season, dates: nbaSeasonDateRange(season), page, limit }
    }).pipe(map((payload) => normalizeNbaTrades(payload, season)));
  }

  getPlayerSummaries(names: string[], season: string): Observable<NbaPlayerSummaryBatch> {
    const uniqueNames = [...new Map(names.map((name) => [nbaPlayerKey(name), name])).values()].slice(0, NBA_MAX_PLAYER_ENRICHMENT_COUNT);
    if (!uniqueNames.length) return of({ data: {}, failedNames: [] });
    return forkJoin(uniqueNames.map((name) => this.getPlayerSummary(name, season).pipe(
      map((summary) => ({ name, summary, failed: false })),
      catchError(() => of({ name, summary: null, failed: true }))
    ))).pipe(
      map((results) => ({
        data: Object.fromEntries(results
          .map(({ summary }) => summary)
          .filter((summary): summary is NbaPlayerSeasonSummary => Boolean(summary))
          .map((summary) => [nbaPlayerKey(summary.name), summary])),
        failedNames: results.filter(({ failed }) => failed).map(({ name }) => name)
      }))
    );
  }

  private getPlayerSummary(name: string, season: string): Observable<NbaPlayerSeasonSummary | null> {
    const cacheKey = `${season}:${nbaPlayerKey(name)}`;
    const cached = this.playerCache.get(cacheKey);
    if (cached) return cached;
    const request = this.http.get<unknown>('/api/nba/player-search', {
      params: { query: name, region: 'us', lang: 'en', section: 'nba' }
    }).pipe(
      map((payload) => normalizeNbaPlayerSearch(payload, name)),
      switchMap((match) => match ? this.http.get<unknown>(`/api/nba/player-stats/${match.id}`, {
        params: { region: 'us', lang: 'en', contentorigin: 'espn', season: Number.parseInt(season.slice(0, 4), 10) + 1, seasontype: 2 }
      }).pipe(map((payload) => normalizeNbaPlayerStats(payload, match, season))) : of(null)),
      tap(() => this.successfulPlayerCacheKeys.add(cacheKey)),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.playerCache.set(cacheKey, request);
    return request;
  }

  clearPlayerSummaryCache(names: string[], season: string): void {
    for (const name of names) {
      const key = `${season}:${nbaPlayerKey(name)}`;
      if (!this.successfulPlayerCacheKeys.has(key)) this.playerCache.delete(key);
    }
  }

  private getEspnScoreboard(gameDate: string): Observable<unknown> {
    return this.http.get<unknown>(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      { params: { dates: gameDate.replace(/-/g, '') } }
    );
  }
}
