import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { tradeGroupFixture } from '../nba-test-data';
import { TradeCardComponent } from './trade-card.component';

describe('TradeCardComponent', () => {
  it('summarizes and expands a complete multi-team trade', async () => {
    await TestBed.configureTestingModule({ imports: [TradeCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TradeCardComponent);
    fixture.componentRef.setInput('trade', tradeGroupFixture);
    fixture.componentRef.setInput('expanded', true);
    fixture.componentRef.setInput('playerState', { loading: false, error: null, data: {
      exampleplayer: { id: '1', name: 'Example Player', season: '2025-26', position: 'G', headshotUrl: 'example.png', points: 21.4, rebounds: 5.2, assists: 7.8 }
    } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2-team trade');
    expect(fixture.nativeElement.textContent).toContain('Received');
    expect(fixture.nativeElement.textContent).toContain('Sent');
    expect(fixture.nativeElement.querySelector('details.source-notes')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('21.4');
    expect(fixture.nativeElement.textContent).toContain('2025-26 regular season');
    expect(fixture.nativeElement.querySelector('.player-photo img')?.getAttribute('src')).toContain('example.png');
    expect(fixture.nativeElement.querySelector('.featured-photo img')?.getAttribute('src')).toContain('example.png');
    fixture.destroy();
  });

  it('uses a neutral silhouette when player enrichment is unavailable', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [TradeCardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TradeCardComponent);
    fixture.componentRef.setInput('trade', tradeGroupFixture);
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.player-photo svg')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.player-photo').textContent.trim()).toBe('');
  });
});
