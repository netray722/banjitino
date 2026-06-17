import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { FifaMatchDetails, FifaScoreboard } from './fifa.models';
import { normalizeFifaMatchDetails, normalizeFifaScoreboard } from './fifa.utils';

@Injectable({ providedIn: 'root' })
export class FifaDataService {
  private readonly http = inject(HttpClient);

  getScoreboard(): Observable<FifaScoreboard> {
    return this.http.get<unknown>('/api/fifa/scoreboard').pipe(map((payload) => normalizeFifaScoreboard(payload)));
  }

  getMatchDetails(matchId: string): Observable<FifaMatchDetails> {
    return this.http
      .get<unknown>(`/api/fifa/match/${encodeURIComponent(matchId)}`)
      .pipe(map((payload) => normalizeFifaMatchDetails(payload)));
  }
}
