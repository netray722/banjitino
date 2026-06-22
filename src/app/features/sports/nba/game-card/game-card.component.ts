import { Component, computed, input, output } from '@angular/core';
import { LucideChevronDown, LucideClock3, LucideRefreshCw } from '@lucide/angular';

import { formatGameTime, periodLabel } from '../nba-data';
import { BoxScoreState, NbaGame, NbaStanding, TeamSummary } from '../nba.types';
import { BoxScoreComponent } from '../box-score/box-score.component';

@Component({
  selector: 'app-game-card',
  imports: [BoxScoreComponent, LucideChevronDown, LucideClock3, LucideRefreshCw],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss'
})
export class GameCardComponent {
  readonly game = input.required<NbaGame>();
  readonly expanded = input(false);
  readonly boxScoreState = input<BoxScoreState | null>(null);
  readonly awayStanding = input<NbaStanding | null>(null);
  readonly homeStanding = input<NbaStanding | null>(null);

  readonly toggle = output<void>();
  readonly retry = output<void>();

  protected readonly statusLabel = computed(() => {
    const game = this.game();
    if (game.status === 'live') {
      const period = periodLabel(game.period);
      return [period, game.clock].filter(Boolean).join(' ');
    }
    if (game.status === 'scheduled') {
      return formatGameTime(game.startTimeUtc);
    }
    return game.statusText || 'Final';
  });

  protected record(team: TeamSummary, standing: NbaStanding | null): string {
    return standing ? `#${standing.seed} ${standing.conference} · ${standing.wins}-${standing.losses}` : `${team.wins}-${team.losses}`;
  }

  protected recordLabel(team: TeamSummary, standing: NbaStanding | null): string {
    return standing
      ? `${team.city} ${team.name}, ${standing.conference}ern Conference seed ${standing.seed}, ${standing.wins} wins and ${standing.losses} losses`
      : `${team.city} ${team.name}, ${team.wins} wins and ${team.losses} losses`;
  }

  protected logoUrl(team: TeamSummary): string {
    return team.logoUrl ?? `/api/nba/logo/${team.id}`;
  }

  protected hideBrokenImage(event: Event): void {
    (event.currentTarget as HTMLImageElement).hidden = true;
  }
}
