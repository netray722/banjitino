import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { browserDateKey, currentNbaSeason } from '../nba-data';
import { NbaDataService } from '../nba-data.service';
import { tradePageFixture } from '../nba-test-data';
import { NbaTradeEntry, NbaTradePage } from '../nba.types';
import { TradeTimelineComponent } from './trade-timeline.component';

function page(season: string, trades: NbaTradeEntry[], pageIndex = 1, pageCount = 1): NbaTradePage {
  return { season, page: pageIndex, pageCount, trades };
}

describe('TradeTimelineComponent', () => {
  it('renders chronological combined trades without season or team filters', async () => {
    const season = currentNbaSeason();
    const lakers = { ...tradePageFixture.trades[0], id: 'lal', season, description: 'Acquired G Player Alpha from Boston in exchange for F Player Beta.' };
    const celtics = { ...tradePageFixture.trades[0], id: 'bos', season, teamId: 2, teamCode: 'BOS', teamName: 'Boston Celtics', description: 'Acquired F Player Beta from Los Angeles Lakers in exchange for G Player Alpha.' };
    const older = { ...lakers, id: 'older', date: '2026-01-15', description: 'Acquired G Player Older from Chicago.' };
    const dataService = {
      getTrades: vi.fn(() => of(page(season, [lakers, celtics, older]))),
      getPlayerSummaries: vi.fn(() => of({ data: {}, failedNames: [] })),
      clearPlayerSummaryCache: vi.fn()
    };
    await TestBed.configureTestingModule({
      imports: [TradeTimelineComponent],
      providers: [{ provide: NbaDataService, useValue: dataService }]
    }).compileComponents();
    const fixture = TestBed.createComponent(TradeTimelineComponent);
    fixture.detectChanges();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.trade-card')).toHaveLength(2);
    });
    expect(fixture.nativeElement.textContent).not.toContain('Player trade timeline');
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    expect(fixture.nativeElement.querySelector('.date-picker')).not.toBeNull();
    const headings = fixture.nativeElement.querySelectorAll('.trade-day h1') as NodeListOf<HTMLElement>;
    expect(headings[0].textContent).toContain('January 15');
    expect(headings[1].textContent).toContain('February 5');

    const cards = fixture.nativeElement.querySelectorAll('.trade-summary') as NodeListOf<HTMLButtonElement>;
    cards[0].click();
    fixture.detectChanges();
    expect(dataService.getPlayerSummaries).toHaveBeenCalledOnce();
    cards[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.trade-card.is-expanded')).toHaveLength(1);

    const dateInput = fixture.nativeElement.querySelector('#nba-trade-date') as HTMLInputElement;
    dateInput.value = '2026-02-06';
    dateInput.dispatchEvent(new Event('change'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      const todayButton = fixture.nativeElement.querySelector('.today-button') as HTMLButtonElement;
      expect(todayButton).not.toBeNull();
      expect(todayButton.disabled).toBe(false);
    });
    (fixture.nativeElement.querySelector('.today-button') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect((fixture.nativeElement.querySelector('#nba-trade-date') as HTMLInputElement).value).toBe(browserDateKey());
    });
    fixture.destroy();
  });

  it('defaults to today and falls back to the nearest trade in the previous season', async () => {
    TestBed.resetTestingModule();
    const currentSeason = currentNbaSeason();
    const previousStart = Number.parseInt(currentSeason.slice(0, 4), 10) - 1;
    const previousSeason = `${previousStart}-${String(previousStart + 1).slice(-2)}`;
    const previousTrade = { ...tradePageFixture.trades[0], id: 'previous', date: `${previousStart + 1}-02-05`, season: previousSeason };
    const dataService = {
      getTrades: vi.fn((season: string) => of(page(season, season === currentSeason ? [] : [previousTrade]))),
      getPlayerSummaries: vi.fn(() => of({ data: {}, failedNames: [] })),
      clearPlayerSummaryCache: vi.fn()
    };
    await TestBed.configureTestingModule({ imports: [TradeTimelineComponent], providers: [{ provide: NbaDataService, useValue: dataService }] }).compileComponents();
    const fixture = TestBed.createComponent(TradeTimelineComponent);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.trade-card')).not.toBeNull();
    });
    expect((fixture.nativeElement.querySelector('#nba-trade-date') as HTMLInputElement).value).toBe(browserDateKey());
    expect(dataService.getTrades).toHaveBeenCalledWith(currentSeason, 1);
    expect(dataService.getTrades).toHaveBeenCalledWith(previousSeason, 1);
    expect(fixture.nativeElement.querySelector('.date-picker').textContent).toContain('Today');
    fixture.destroy();
  });

  it('shows a retryable error without fabricated trade cards', async () => {
    TestBed.resetTestingModule();
    const dataService = { getTrades: vi.fn(() => throwError(() => new Error('offline'))) };
    await TestBed.configureTestingModule({ imports: [TradeTimelineComponent], providers: [{ provide: NbaDataService, useValue: dataService }] }).compileComponents();
    const fixture = TestBed.createComponent(TradeTimelineComponent);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('temporarily unavailable');
    });
    expect(fixture.nativeElement.querySelector('.trade-card')).toBeNull();
    fixture.destroy();
  });

  it('loads every page before rendering and combines a boundary-spanning trade', async () => {
    TestBed.resetTestingModule();
    const season = currentNbaSeason();
    const lakers = { ...tradePageFixture.trades[0], id: 'lal', season, description: 'Acquired G Player Alpha from Boston in exchange for F Player Beta.' };
    const celtics = { ...tradePageFixture.trades[0], id: 'bos', season, teamCode: 'BOS', teamName: 'Boston Celtics', description: 'Acquired F Player Beta from Los Angeles Lakers in exchange for G Player Alpha.' };
    const dataService = {
      getTrades: vi.fn((_season: string, pageIndex: number) => of(page(season, pageIndex === 1 ? [lakers] : [celtics], pageIndex, 2))),
      getPlayerSummaries: vi.fn(() => of({ data: {}, failedNames: [] })), clearPlayerSummaryCache: vi.fn()
    };
    await TestBed.configureTestingModule({ imports: [TradeTimelineComponent], providers: [{ provide: NbaDataService, useValue: dataService }] }).compileComponents();
    const fixture = TestBed.createComponent(TradeTimelineComponent);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.trade-card')).toHaveLength(1);
    });
    expect(dataService.getTrades).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('2-team trade');
    fixture.destroy();
  });
});
