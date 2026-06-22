import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { NbaDataService } from './nba-data.service';
import { browserDateKey } from './nba-data';
import { finalGame } from './nba-test-data';

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

  it('requests and normalizes current standings', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [NbaDataService, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(NbaDataService);
    const http = TestBed.inject(HttpTestingController);
    let seed = 0;
    service.getStandings().subscribe((standings) => seed = standings[0].seed);
    http.expectOne('/api/nba/standings').flush({ children: [{ name: 'Eastern Conference', standings: { entries: [{ team: { id: '18', abbreviation: 'NY' }, stats: [{ name: 'playoffSeed', value: 3 }] }] } }] });
    expect(seed).toBe(3);
    http.verify();
  });

  it('requests a paginated season trade feed', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [NbaDataService, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(NbaDataService);
    const http = TestBed.inject(HttpTestingController);
    service.getTrades('2025-26', 2).subscribe();
    http.expectOne('/api/nba/trades?season=2025-26&dates=20250701-20260630&page=2&limit=100').flush({ pageIndex: 2, pageCount: 3, transactions: [] });
    http.verify();
  });

  it('resolves and caches exact player search results with trade-season averages', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [NbaDataService, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(NbaDataService);
    const http = TestBed.inject(HttpTestingController);
    let points = 0;
    service.getPlayerSummaries(['Anthony Davis', 'Anthony Davis'], '2025-26').subscribe((batch) => points = batch.data['anthonydavis'].points ?? 0);
    http.expectOne('/api/nba/player-search?query=Anthony%20Davis&region=us&lang=en&section=nba').flush({ results: [{ type: 'player', contents: [{
      type: 'player', displayName: 'Anthony Davis', description: 'NBA', defaultLeagueSlug: 'nba', uid: 's:40~l:46~a:6583', image: { default: 'ad.png' }
    }] }] });
    http.expectOne('/api/nba/player-stats/6583?region=us&lang=en&contentorigin=espn&season=2026&seasontype=2').flush({ categories: [{
      name: 'averages', names: ['avgPoints', 'avgRebounds', 'avgAssists'], statistics: [{ season: { year: 2026 }, position: 'F', stats: ['20.4', '11.1', '2.8'] }]
    }] });
    expect(points).toBe(20.4);
    service.getPlayerSummaries(['Anthony Davis'], '2025-26').subscribe();
    http.expectNone('/api/nba/player-search?query=Anthony%20Davis&region=us&lang=en&section=nba');
    http.verify();
  });

  it('returns successful player enrichment when another player fails and retries only failures', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [NbaDataService, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(NbaDataService);
    const http = TestBed.inject(HttpTestingController);
    let result: { keys: string[]; failed: string[] } = { keys: [], failed: [] };
    service.getPlayerSummaries(['Anthony Davis', 'Missing Player'], '2025-26').subscribe((batch) => {
      result = { keys: Object.keys(batch.data), failed: batch.failedNames };
    });
    http.expectOne((request) => request.url === '/api/nba/player-search' && request.params.get('query') === 'Anthony Davis').flush({ results: [{ type: 'player', contents: [{
      type: 'player', displayName: 'Anthony Davis', description: 'NBA', defaultLeagueSlug: 'nba', uid: 's:40~l:46~a:6583', image: { default: 'ad.png' }
    }] }] });
    http.expectOne((request) => request.url === '/api/nba/player-search' && request.params.get('query') === 'Missing Player').flush('Offline', { status: 503, statusText: 'Unavailable' });
    http.expectOne((request) => request.url === '/api/nba/player-stats/6583').flush({ categories: [{
      name: 'averages', names: ['avgPoints', 'avgRebounds', 'avgAssists'], statistics: [{ season: { year: 2026 }, stats: ['20', '10', '3'] }]
    }] });
    expect(result).toEqual({ keys: ['anthonydavis'], failed: ['Missing Player'] });

    service.clearPlayerSummaryCache(['Anthony Davis', 'Missing Player'], '2025-26');
    service.getPlayerSummaries(['Anthony Davis', 'Missing Player'], '2025-26').subscribe();
    http.expectNone((request) => request.url === '/api/nba/player-search' && request.params.get('query') === 'Anthony Davis');
    http.expectOne((request) => request.url === '/api/nba/player-search' && request.params.get('query') === 'Missing Player').flush({ results: [] });
    http.verify();
  });
});
