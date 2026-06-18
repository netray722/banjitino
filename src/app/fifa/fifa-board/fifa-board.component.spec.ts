import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { FifaDataService } from '../fifa-data.service';
import { fifaDetailsFixture, fifaScoreboardFixture } from '../fifa-test-data';
import { FifaBoardComponent } from './fifa-board.component';

describe('FifaBoardComponent', () => {
  it('renders matches and loads details when a completed match is expanded', async () => {
    const dataService = {
      getScoreboard: vi.fn(() => of(fifaScoreboardFixture)),
      getMatchDetails: vi.fn(() => of(fifaDetailsFixture))
    };

    await TestBed.configureTestingModule({
      imports: [FifaBoardComponent],
      providers: [{ provide: FifaDataService, useValue: dataService }]
    }).compileComponents();

    const fixture = TestBed.createComponent(FifaBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dataService.getScoreboard).toHaveBeenCalledWith('2026-06-17');
    const cards = fixture.nativeElement.querySelectorAll('.match-summary') as NodeListOf<HTMLButtonElement>;
    expect(cards.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('FIFA World Cup 2026');
    cards[0].click();
    fixture.detectChanges();
    expect(dataService.getMatchDetails).not.toHaveBeenCalled();

    cards[1].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dataService.getMatchDetails).toHaveBeenCalledWith('400021496');
    expect(fixture.nativeElement.textContent).toContain('Mercedes-Benz Stadium');

    const refreshButton = fixture.nativeElement.querySelector('.refresh-button') as HTMLButtonElement;
    refreshButton.click();
    fixture.detectChanges();
    expect(dataService.getScoreboard).toHaveBeenCalledTimes(2);

    const dateInput = fixture.nativeElement.querySelector('#fifa-date') as HTMLInputElement;
    dateInput.value = '2026-06-18';
    dateInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(dataService.getScoreboard).toHaveBeenLastCalledWith('2026-06-18');
    fixture.destroy();
  });

  it('opens the native date picker from the desktop date button', async () => {
    const dataService = {
      getScoreboard: vi.fn(() => of(fifaScoreboardFixture)),
      getMatchDetails: vi.fn(() => of(fifaDetailsFixture))
    };

    await TestBed.configureTestingModule({
      imports: [FifaBoardComponent],
      providers: [{ provide: FifaDataService, useValue: dataService }]
    }).compileComponents();

    const fixture = TestBed.createComponent(FifaBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const dateInput = fixture.nativeElement.querySelector('#fifa-date') as HTMLInputElement & {
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
});
