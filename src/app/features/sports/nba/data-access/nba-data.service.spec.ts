import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { NbaDataService } from './nba-data.service';
import { finalGame } from '../testing/test-data';
import { browserDateKey } from '../utils/nba.utils';

describe('NbaDataService', () => {
  it('loads and normalizes the daily scoreboard', () => {
    TestBed.configureTestingModule({
      providers: [NbaDataService, provideHttpClient(), provideHttpClientTesting()]
    });
    const service = TestBed.inject(NbaDataService);
    const http = TestBed.inject(HttpTestingController);
    let gameId = '';

    service.getScoreboard().subscribe((scoreboard) => {
      gameId = scoreboard.games[0].id;
    });

    http.expectOne('/api/nba/scoreboard').flush({
      scoreboard: {
        gameDate: '2026-06-13',
        games: [{
          gameId: '0022500001',
          gameStatus: 1,
          awayTeam: { teamTricode: 'NYK' },
          homeTeam: { teamTricode: 'LAL' }
        }]
      }
    });

    expect(gameId).toBe('0022500001');
    http.verify();
  });

  it('loads a dated scoreboard from ESPN', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [NbaDataService, provideHttpClient(), provideHttpClientTesting()]
    });
    const service = TestBed.inject(NbaDataService);
    const http = TestBed.inject(HttpTestingController);

    service.getScoreboard('2026-06-13').subscribe();

    http.expectOne('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20260613').flush({
      events: []
    });
    http.verify();
  });

  it('falls back to the ESPN schedule when the live NBA feed is unavailable', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [NbaDataService, provideHttpClient(), provideHttpClientTesting()]
    });
    const service = TestBed.inject(NbaDataService);
    const http = TestBed.inject(HttpTestingController);
    let gameCount = -1;

    service.getScoreboard().subscribe((scoreboard) => {
      gameCount = scoreboard.games.length;
    });

    http.expectOne('/api/nba/scoreboard').flush('Unavailable', {
      status: 502,
      statusText: 'Bad Gateway'
    });
    const date = browserDateKey().replace(/-/g, '');
    http.expectOne(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`
    ).flush({ events: [] });

    expect(gameCount).toBe(0);
    http.verify();
  });

  it('encodes the game id in NBA box-score requests', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [NbaDataService, provideHttpClient(), provideHttpClientTesting()]
    });
    const service = TestBed.inject(NbaDataService);
    const http = TestBed.inject(HttpTestingController);

    service.getBoxScore({ ...finalGame, id: '00225/1', source: 'nba' }).subscribe();
    http.expectOne('/api/nba/boxscore/00225%2F1').flush({ game: {} });
    http.verify();
  });

  it('loads ESPN box scores for ESPN games', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [NbaDataService, provideHttpClient(), provideHttpClientTesting()]
    });
    const service = TestBed.inject(NbaDataService);
    const http = TestBed.inject(HttpTestingController);

    service.getBoxScore({ ...finalGame, id: '401859967', source: 'espn' }).subscribe();
    http.expectOne('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401859967').flush({
      boxscore: { teams: [] }
    });
    http.verify();
  });
});
