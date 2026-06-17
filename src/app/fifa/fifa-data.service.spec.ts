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

    service.getScoreboard().subscribe((scoreboard) => {
      matchId = scoreboard.matches[0].id;
    });

    http.expectOne('/api/fifa/scoreboard').flush({
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

  it('encodes the match id in detail requests', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [FifaDataService, provideHttpClient(), provideHttpClientTesting()]
    });
    const service = TestBed.inject(FifaDataService);
    const http = TestBed.inject(HttpTestingController);

    service.getMatchDetails('400/21').subscribe();
    http.expectOne('/api/fifa/match/400%2F21').flush({ IdMatch: '400/21' });
    http.verify();
  });
});
