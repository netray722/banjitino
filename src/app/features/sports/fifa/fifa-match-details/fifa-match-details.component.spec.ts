import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { fifaDetailsFixture } from '../fifa-test-data';
import { FifaMatchDetailsComponent } from './fifa-match-details.component';

describe('FifaMatchDetailsComponent', () => {
  it('renders match facts, events, and team statistics', async () => {
    await TestBed.configureTestingModule({ imports: [FifaMatchDetailsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(FifaMatchDetailsComponent);
    fixture.componentRef.setInput('details', fifaDetailsFixture);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Mercedes-Benz Stadium');
    expect(fixture.nativeElement.querySelector('.team-stats')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.stat-comparison').length).toBeGreaterThan(0);
  });

  it('renders penalty shootout scores when present', async () => {
    await TestBed.configureTestingModule({ imports: [FifaMatchDetailsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(FifaMatchDetailsComponent);
    fixture.componentRef.setInput('details', {
      ...fifaDetailsFixture,
      homeTeam: { ...fifaDetailsFixture.homeTeam, penaltyScore: 3 },
      awayTeam: { ...fifaDetailsFixture.awayTeam, penaltyScore: 2 }
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Penalties');
    expect(fixture.nativeElement.textContent).toContain('PSO');
  });
});
