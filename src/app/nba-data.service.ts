import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BoxScore, Scoreboard } from './nba.models';
import { normalizeBoxScore, normalizeScoreboard } from './nba.utils';

@Injectable({ providedIn: 'root' })
export class NbaDataService {
  private readonly http = inject(HttpClient);

  getScoreboard(): Observable<Scoreboard> {
    return this.http.get<unknown>('/api/nba/scoreboard').pipe(map(normalizeScoreboard));
  }

  getBoxScore(gameId: string): Observable<BoxScore> {
    return this.http
      .get<unknown>(`/api/nba/boxscore/${encodeURIComponent(gameId)}`)
      .pipe(map(normalizeBoxScore));
  }
}
