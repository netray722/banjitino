import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { boxScoreFixture } from '../nba-test-data';
import { BoxScoreComponent } from './box-score.component';

describe('BoxScoreComponent', () => {
  it('renders both teams and their player statistics', async () => {
    await TestBed.configureTestingModule({ imports: [BoxScoreComponent] }).compileComponents();
    const fixture = TestBed.createComponent(BoxScoreComponent);
    fixture.componentRef.setInput('boxScore', boxScoreFixture);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.team-box')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('E. Player');
    expect(fixture.nativeElement.textContent).toContain('55.6%');
    expect(fixture.nativeElement.textContent).toContain('+8');
  });
});
