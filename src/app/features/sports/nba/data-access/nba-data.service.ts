import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';

import { BoxScore, NbaGame, Scoreboard } from '../models/nba.models';
import { browserDateKey, normalizeBoxScore, normalizeScoreboard } from '../utils/nba.utils';

@Injectable({ providedIn: 'root' })
export class NbaDataService {
  private readonly http = inject(HttpClient);

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

  private getEspnScoreboard(gameDate: string): Observable<unknown> {
    return this.http.get<unknown>(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      { params: { dates: gameDate.replace(/-/g, '') } }
    );
  }
}
