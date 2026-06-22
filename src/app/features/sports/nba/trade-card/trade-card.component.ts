import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { nbaPlayerKey } from '../nba-data';
import { NbaPlayerEnrichmentState, NbaPlayerSeasonSummary, NbaTradeAsset, NbaTradeGroup, NbaTradeTeam } from '../nba.types';
import { TradePlayerComponent } from './trade-player.component';

@Component({
  selector: 'app-trade-card',
  imports: [TradePlayerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trade-card.component.html',
  styleUrl: './trade-card.component.scss'
})
export class TradeCardComponent {
  readonly trade = input.required<NbaTradeGroup>();
  readonly expanded = input(false);
  readonly playerState = input<NbaPlayerEnrichmentState | null>(null);
  readonly toggle = output<void>();
  readonly retry = output<void>();

  protected teamLabel(trade: NbaTradeGroup): string {
    return trade.combined ? `${trade.teams.length}-team trade` : 'Team transaction';
  }

  protected summary(trade: NbaTradeGroup): string {
    const names = trade.playerNames.slice(0, 3);
    const assetCount = new Set(trade.teams.flatMap((team) => [...team.received, ...team.sent]).map((asset) => asset.id)).size;
    const extra = Math.max(0, assetCount - names.length);
    return names.length ? `${names.join(', ')}${extra ? ` + ${extra} more asset${extra === 1 ? '' : 's'}` : ''}` : `${assetCount} trade asset${assetCount === 1 ? '' : 's'}`;
  }

  protected statsFor(asset: NbaTradeAsset): NbaPlayerSeasonSummary | null {
    return asset.playerName ? this.playerState()?.data[nbaPlayerKey(asset.playerName)] ?? null : null;
  }

  protected featuredPlayers(trade: NbaTradeGroup): string[] { return trade.playerNames.slice(0, 3); }
  protected statsForName(name: string): NbaPlayerSeasonSummary | null { return this.playerState()?.data[nbaPlayerKey(name)] ?? null; }

  protected assetLabel(asset: NbaTradeAsset): string { return asset.label.replace(/^./, (value) => value.toUpperCase()); }
  protected hasAssets(team: NbaTradeTeam): boolean { return Boolean(team.received.length || team.sent.length); }
  protected hideBrokenImage(event: Event): void { (event.currentTarget as HTMLImageElement).hidden = true; }
}
