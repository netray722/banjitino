import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideChevronDown, LucideClock3, LucideRefreshCw } from '@lucide/angular';

import { FifaDetailsState, FifaMatch, FifaTeam } from '../fifa.models';
import { formatFifaKickoff } from '../fifa.utils';
import { FifaMatchDetailsComponent } from '../fifa-match-details/fifa-match-details.component';

@Component({
  selector: 'app-fifa-match-card',
  imports: [FifaMatchDetailsComponent, LucideChevronDown, LucideClock3, LucideRefreshCw],
  templateUrl: './fifa-match-card.component.html',
  styleUrl: './fifa-match-card.component.css'
})
export class FifaMatchCardComponent {
  @Input({ required: true }) match!: FifaMatch;
  @Input() expanded = false;
  @Input() detailsState: FifaDetailsState | null = null;

  @Output() readonly toggle = new EventEmitter<void>();
  @Output() readonly retry = new EventEmitter<void>();

  protected statusLabel(): string {
    return this.match.status === 'scheduled'
      ? formatFifaKickoff(this.match.startTimeUtc)
      : this.match.statusText;
  }

  protected flagUrl(team: FifaTeam): string {
    return `/api/fifa/flag/${team.code}`;
  }

  protected hideBrokenImage(event: Event): void {
    (event.currentTarget as HTMLImageElement).hidden = true;
  }
}
