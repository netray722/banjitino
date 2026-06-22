import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { fifaDetailsFixture, fifaStandingsFixture, finalFifaMatch, scheduledFifaMatch } from '../fifa-test-data';
import { FifaMatchCardComponent } from './fifa-match-card.component';

describe('FifaMatchCardComponent', () => {
  it('shows current rank, W-D-L, points, and goal difference for group matches', async () => {
    await TestBed.configureTestingModule({ imports: [FifaMatchCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(FifaMatchCardComponent);
    fixture.componentRef.setInput('match', scheduledFifaMatch);
    fixture.componentRef.setInput('homeStanding', fifaStandingsFixture[0]);
    fixture.componentRef.setInput('awayStanding', fifaStandingsFixture[1]);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.standing-row') as NodeListOf<HTMLElement>;
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('#1 · 2-0-0 · 6 pts · GD +3');
    expect(rows[0].getAttribute('aria-label')).toContain('Canada current Group A standing');
  });

  it('hides group standings for knockout matches', async () => {
    await TestBed.configureTestingModule({ imports: [FifaMatchCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(FifaMatchCardComponent);
    fixture.componentRef.setInput('match', { ...scheduledFifaMatch, group: '', stage: 'Round of 32' });
    fixture.componentRef.setInput('homeStanding', fifaStandingsFixture[0]);
    fixture.componentRef.setInput('awayStanding', fifaStandingsFixture[1]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.standing-row')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('CAN');
  });

  it('shows kickoff details for a scheduled match', async () => {
    await TestBed.configureTestingModule({
      imports: [FifaMatchCardComponent]
    }).compileComponents();

    const fixture = TestBed.createComponent(FifaMatchCardComponent);
    fixture.componentRef.setInput('match', scheduledFifaMatch);
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Kickoff');
    expect(fixture.nativeElement.textContent).toContain('BMO Field');
    expect(fixture.nativeElement.textContent).toContain('CAN');
  });

  it('renders expanded FIFA match details when present', async () => {
    await TestBed.configureTestingModule({
      imports: [FifaMatchCardComponent]
    }).compileComponents();

    const fixture = TestBed.createComponent(FifaMatchCardComponent);
    fixture.componentRef.setInput('match', finalFifaMatch);
    fixture.componentRef.setInput('expanded', true);
    fixture.componentRef.setInput('detailsState', {
      data: fifaDetailsFixture,
      loading: false,
      error: null
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Mercedes-Benz Stadium');
    expect(fixture.nativeElement.textContent).toContain('Team stats');
    expect(fixture.nativeElement.textContent).toContain('Shots on target');
  });

  it('hides the team stats section when FIFA does not provide stats', async () => {
    await TestBed.configureTestingModule({
      imports: [FifaMatchCardComponent]
    }).compileComponents();

    const fixture = TestBed.createComponent(FifaMatchCardComponent);
    fixture.componentRef.setInput('match', finalFifaMatch);
    fixture.componentRef.setInput('expanded', true);
    fixture.componentRef.setInput('detailsState', {
      data: { ...fifaDetailsFixture, stats: [] },
      loading: false,
      error: null
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Match facts');
    expect(fixture.nativeElement.textContent).not.toContain('Team stats');
    expect(fixture.nativeElement.textContent).not.toContain('Team stats unavailable');
  });

  it('emits card actions and hides a broken flag image', async () => {
    await TestBed.configureTestingModule({
      imports: [FifaMatchCardComponent]
    }).compileComponents();

    const fixture = TestBed.createComponent(FifaMatchCardComponent);
    const toggle = vi.fn();
    const retry = vi.fn();
    fixture.componentRef.setInput('match', finalFifaMatch);
    fixture.componentRef.setInput('expanded', true);
    fixture.componentRef.setInput('detailsState', {
      data: null,
      loading: false,
      error: 'No details'
    });
    fixture.componentInstance.toggle.subscribe(toggle);
    fixture.componentInstance.retry.subscribe(retry);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.match-summary') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('.details-error button') as HTMLButtonElement).click();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    (fixture.componentInstance as unknown as { hideBrokenImage(event: Event): void }).hideBrokenImage({
      currentTarget: img
    } as unknown as Event);

    expect(toggle).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledOnce();
    expect(img.hidden).toBe(true);
  });
});
