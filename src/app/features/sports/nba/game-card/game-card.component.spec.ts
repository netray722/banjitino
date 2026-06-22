import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { boxScoreFixture, finalGame, scheduledGame, standingsFixture } from '../nba-test-data';
import { GameCardComponent } from './game-card.component';

describe('GameCardComponent', () => {
  it('shows a scheduled tipoff and expands without requesting a box score', async () => {
    await TestBed.configureTestingModule({ imports: [GameCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(GameCardComponent);
    fixture.componentRef.setInput('game', scheduledGame);
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tipoff');
    expect(fixture.nativeElement.textContent).toContain('Player box scores will appear');
    expect(fixture.nativeElement.querySelector('app-box-score')).toBeNull();

    const logo = fixture.nativeElement.querySelector('.team-logo img') as HTMLImageElement;
    logo.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(logo.hidden).toBe(true);
    fixture.destroy();
  });

  it('shows current conference seed and record with scoreboard fallback', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [GameCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(GameCardComponent);
    fixture.componentRef.setInput('game', scheduledGame);
    fixture.componentRef.setInput('awayStanding', standingsFixture[0]);
    fixture.detectChanges();

    const records = fixture.nativeElement.querySelectorAll('.record') as NodeListOf<HTMLElement>;
    expect(records[0].textContent).toContain('#3 East · 42-28');
    expect(records[0].getAttribute('aria-label')).toContain('Eastern Conference seed 3');
    expect(records[1].textContent).toContain('48-34');
    fixture.destroy();
  });

  it('renders the player box score for a completed game', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [GameCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(GameCardComponent);
    fixture.componentRef.setInput('game', finalGame);
    fixture.componentRef.setInput('expanded', true);
    fixture.componentRef.setInput('boxScoreState', {
      data: boxScoreFixture,
      loading: false,
      error: null
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('E. Player');
    expect(fixture.nativeElement.textContent).toContain('Team totals');
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
    fixture.destroy();
  });
});
