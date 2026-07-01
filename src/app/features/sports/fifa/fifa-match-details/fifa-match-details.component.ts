import { Component, input } from '@angular/core';

import { FifaEvent, FifaMatchDetails, FifaTeam, FifaTeamStat } from '../fifa.types';

@Component({
  selector: 'app-fifa-match-details',
  templateUrl: './fifa-match-details.component.html',
  styleUrl: './fifa-match-details.component.scss'
})
export class FifaMatchDetailsComponent {
  readonly details = input.required<FifaMatchDetails>();

  protected hasEvents(events: FifaEvent[]): boolean {
    return events.length > 0;
  }

  protected hasPenalties(details: FifaMatchDetails): boolean {
    return this.hasPenaltyScore(details.homeTeam) || this.hasPenaltyScore(details.awayTeam);
  }

  protected penaltyScore(team: FifaTeam): string {
    return this.hasPenaltyScore(team) ? String(team.penaltyScore) : '-';
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

  private hasPenaltyScore(team: FifaTeam): boolean {
    return team.penaltyScore !== null && team.penaltyScore !== undefined;
  }
}
