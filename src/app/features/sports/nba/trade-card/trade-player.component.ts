import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { NbaPlayerSeasonSummary } from '../nba.types';

@Component({
  selector: 'app-trade-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trade-player.component.html',
  styleUrl: './trade-player.component.scss'
})
export class TradePlayerComponent {
  readonly name = input.required<string>();
  readonly position = input('Player');
  readonly season = input.required<string>();
  readonly player = input<NbaPlayerSeasonSummary | null>(null);
  readonly compact = input(false);

  protected hasStatistics(player: NbaPlayerSeasonSummary | null): boolean {
    return Boolean(player && player.points !== null && player.rebounds !== null && player.assists !== null);
  }
  protected hideBrokenImage(event: Event): void { (event.currentTarget as HTMLImageElement).hidden = true; }
}
