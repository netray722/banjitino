import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { TradePlayerComponent } from './trade-player.component';

describe('TradePlayerComponent', () => {
  it('renders trade-season stats and a headshot with a silhouette fallback', async () => {
    await TestBed.configureTestingModule({ imports: [TradePlayerComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TradePlayerComponent);
    fixture.componentRef.setInput('name', 'Example Player');
    fixture.componentRef.setInput('season', '2025-26');
    fixture.componentRef.setInput('player', { id: '1', name: 'Example Player', season: '2025-26', position: 'G', headshotUrl: 'player.png', points: 20, rebounds: 5, assists: 7 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2025-26 regular season');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toContain('player.png');
    expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();
  });
});
