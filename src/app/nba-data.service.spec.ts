import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { NbaDataService } from './nba-data.service';

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

  it('encodes the game id in box-score requests', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [NbaDataService, provideHttpClient(), provideHttpClientTesting()]
    });
    const service = TestBed.inject(NbaDataService);
    const http = TestBed.inject(HttpTestingController);

    service.getBoxScore('00225/1').subscribe();
    http.expectOne('/api/nba/boxscore/00225%2F1').flush({ game: {} });
    http.verify();
  });
});
