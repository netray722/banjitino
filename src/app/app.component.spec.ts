import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AppComponent } from './app.component';
import { NbaDataService } from './nba-data.service';
import { boxScoreFixture, scoreboardFixture } from './test-data';

describe('AppComponent', () => {
  it('renders games and loads a box score when a completed game is expanded', async () => {
    const dataService = {
      getScoreboard: vi.fn(() => of(scoreboardFixture)),
      getBoxScore: vi.fn(() => of(boxScoreFixture))
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: NbaDataService, useValue: dataService }]
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const cards = fixture.nativeElement.querySelectorAll('.game-summary') as NodeListOf<HTMLButtonElement>;
    expect(cards.length).toBe(2);
    cards[1].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dataService.getBoxScore).toHaveBeenCalledWith('0022500002');
    expect(fixture.nativeElement.textContent).toContain('E. Player');

    cards[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-box-score')).toBeNull();

    const refreshButton = fixture.nativeElement.querySelector('.refresh-button') as HTMLButtonElement;
    refreshButton.click();
    fixture.detectChanges();
    expect(dataService.getScoreboard).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });
});
