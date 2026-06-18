import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { FifaDataService } from './fifa-data.service';

describe('FifaDataService', () => {
  it('loads and normalizes the daily FIFA scoreboard', () => {
    TestBed.configureTestingModule({
      providers: [FifaDataService, provideHttpClient(), provideHttpClientTesting()]
    });
    const service = TestBed.inject(FifaDataService);
    const http = TestBed.inject(HttpTestingController);
    let matchId = '';

    service.getScoreboard('2026-06-17').subscribe((scoreboard) => {
      matchId = scoreboard.matches[0].id;
    });

    http.expectOne('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260617').flush({
      matchDate: '2026-06-17',
      Results: [{
        IdMatch: '400021401',
        Date: '2026-06-17T16:00:00Z',
        HomeTeam: { TeamName: [{ Description: 'Canada' }], Abbreviation: 'CAN' },
        AwayTeam: { TeamName: [{ Description: 'Japan' }], Abbreviation: 'JPN' }
      }]
    });

    expect(matchId).toBe('400021401');
    http.verify();
  });

  it('loads ESPN match details by event id', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [FifaDataService, provideHttpClient(), provideHttpClientTesting()]
    });
    const service = TestBed.inject(FifaDataService);
    const http = TestBed.inject(HttpTestingController);

    service.getMatchDetails('760438').subscribe();
    http.expectOne('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=760438').flush({});
    http.verify();
  });
});
