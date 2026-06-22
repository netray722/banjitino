import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { browserDateKey } from '../nba-data';
import { NbaDataService } from '../nba-data.service';
import { boxScoreFixture, scoreboardFixture, standingsFixture } from '../nba-test-data';
import { NbaBoardComponent } from './nba-board.component';

describe('NbaBoardComponent', () => {
  it('renders games and loads a box score when a completed game is expanded', async () => {
    const dataService = {
      getScoreboard: vi.fn(() => of(scoreboardFixture)),
      getBoxScore: vi.fn(() => of(boxScoreFixture)),
      getStandings: vi.fn(() => of(standingsFixture))
    };

    await TestBed.configureTestingModule({
      imports: [NbaBoardComponent],
      providers: [{ provide: NbaDataService, useValue: dataService }]
    }).compileComponents();

    const fixture = TestBed.createComponent(NbaBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dataService.getScoreboard).toHaveBeenCalledWith(undefined);
    expect(dataService.getStandings).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.game-summary').length).toBeGreaterThanOrEqual(2);
    });
    const cards = fixture.nativeElement.querySelector(`[data-date="${browserDateKey()}"]`)
      .querySelectorAll('.game-summary') as NodeListOf<HTMLButtonElement>;
    expect(cards.length).toBe(2);
    cards[0].click();
    fixture.detectChanges();
    expect(dataService.getBoxScore).not.toHaveBeenCalled();

    cards[1].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dataService.getBoxScore).toHaveBeenCalledWith(scoreboardFixture.games[1]);
    expect(fixture.nativeElement.textContent).toContain('E. Player');

    cards[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-box-score')).toBeNull();

    const refreshButton = fixture.nativeElement.querySelector('.refresh-button') as HTMLButtonElement;
    refreshButton.click();
    fixture.detectChanges();
    expect(dataService.getScoreboard.mock.calls.length).toBeGreaterThan(1);

    const dateInput = fixture.nativeElement.querySelector('#nba-date') as HTMLInputElement;
    dateInput.value = '2026-06-20';
    dateInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(dataService.getScoreboard).toHaveBeenCalledWith('2026-06-20');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.today-button')).not.toBeNull();
    });
    (fixture.nativeElement.querySelector('.today-button') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.today-button')).toBeNull();
    });
    fixture.destroy();
  });

  it('opens the native date picker from the desktop date button', async () => {
    const dataService = {
      getScoreboard: vi.fn(() => of(scoreboardFixture)),
      getBoxScore: vi.fn(() => of(boxScoreFixture)),
      getStandings: vi.fn(() => of(standingsFixture))
    };

    await TestBed.configureTestingModule({
      imports: [NbaBoardComponent],
      providers: [{ provide: NbaDataService, useValue: dataService }]
    }).compileComponents();

    const fixture = TestBed.createComponent(NbaBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const dateInput = fixture.nativeElement.querySelector('#nba-date') as HTMLInputElement & {
      showPicker: () => void;
    };
    const showPicker = vi.fn();
    dateInput.showPicker = showPicker;

    const dateButton = fixture.nativeElement.querySelector('.date-picker') as HTMLButtonElement;
    dateButton.click();

    expect(showPicker).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(dateInput);
    fixture.destroy();
  });

  it('prevents overlapping standings requests and preserves the last successful standings', async () => {
    TestBed.resetTestingModule();
    const pending = new Subject<typeof standingsFixture>();
    const dataService = {
      getScoreboard: vi.fn(() => of(scoreboardFixture)),
      getBoxScore: vi.fn(() => of(boxScoreFixture)),
      getStandings: vi.fn()
        .mockReturnValueOnce(pending)
        .mockReturnValueOnce(throwError(() => new Error('offline')))
    };
    await TestBed.configureTestingModule({
      imports: [NbaBoardComponent],
      providers: [{ provide: NbaDataService, useValue: dataService }]
    }).compileComponents();
    const fixture = TestBed.createComponent(NbaBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('.refresh-button') as HTMLButtonElement).click();
    expect(dataService.getStandings).toHaveBeenCalledOnce();

    pending.next(standingsFixture);
    pending.complete();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('#3 East · 42-28');
    });

    (fixture.nativeElement.querySelector('.refresh-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dataService.getStandings).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('#3 East · 42-28');
    fixture.destroy();
  });
});
