import { Component, Input } from '@angular/core';

import { FifaEvent, FifaMatchDetails, FifaTeamStat } from '../fifa.models';

@Component({
  selector: 'app-fifa-match-details',
  templateUrl: './fifa-match-details.component.html',
  styleUrl: './fifa-match-details.component.css'
})
export class FifaMatchDetailsComponent {
  @Input({ required: true }) details!: FifaMatchDetails;

  protected hasEvents(events: FifaEvent[]): boolean {
    return events.length > 0;
  }

  protected barWidth(stat: FifaTeamStat, side: 'home' | 'away'): number {
    const home = this.statNumber(stat.homeValue);
    const away = this.statNumber(stat.awayValue);
    const maximum = Math.max(home, away, 1);
    return Math.max((side === 'home' ? home : away) / maximum * 100, home || away ? 7 : 0);
  }

  private statNumber(value: string): number {
    return Number.parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
  }
}
