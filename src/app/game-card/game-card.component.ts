import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideChevronDown, LucideClock3, LucideRefreshCw } from '@lucide/angular';

import { BoxScoreComponent } from '../box-score/box-score.component';
import { BoxScoreState, NbaGame, TeamSummary } from '../nba.models';
import { formatGameTime, periodLabel } from '../nba.utils';

@Component({
  selector: 'app-game-card',
  imports: [BoxScoreComponent, LucideChevronDown, LucideClock3, LucideRefreshCw],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.css'
})
export class GameCardComponent {
  @Input({ required: true }) game!: NbaGame;
  @Input() expanded = false;
  @Input() boxScoreState: BoxScoreState | null = null;

  @Output() readonly toggle = new EventEmitter<void>();
  @Output() readonly retry = new EventEmitter<void>();

  protected statusLabel(): string {
    if (this.game.status === 'live') {
      const period = periodLabel(this.game.period);
      return [period, this.game.clock].filter(Boolean).join(' ');
    }
    if (this.game.status === 'scheduled') {
      return formatGameTime(this.game.startTimeUtc);
    }
    return this.game.statusText || 'Final';
  }

  protected record(team: TeamSummary): string {
    return `${team.wins}-${team.losses}`;
  }

  protected logoUrl(team: TeamSummary): string {
    return `/api/nba/logo/${team.id}`;
  }

  protected hideBrokenImage(event: Event): void {
    (event.currentTarget as HTMLImageElement).hidden = true;
  }
}
