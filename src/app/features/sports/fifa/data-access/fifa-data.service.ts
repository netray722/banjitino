import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { FifaMatchDetails, FifaScoreboard } from '../models/fifa.models';
import { normalizeFifaMatchDetails, normalizeFifaScoreboard } from '../utils/fifa.utils';

@Injectable({ providedIn: 'root' })
export class FifaDataService {
  private readonly http = inject(HttpClient);

  getScoreboard(matchDate: string): Observable<FifaScoreboard> {
    return this.http
      .get<unknown>('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard', {
        params: { dates: matchDate.replace(/-/g, '') }
      })
      .pipe(map((payload) => normalizeFifaScoreboard({ ...(payload as Record<string, unknown>), matchDate })));
  }

  getMatchDetails(matchId: string): Observable<FifaMatchDetails> {
    return this.http
      .get<unknown>('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary', {
        params: { event: matchId }
      })
      .pipe(map((payload) => normalizeFifaMatchDetails(payload)));
  }
}
