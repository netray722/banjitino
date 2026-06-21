import { Component, computed, input, output } from '@angular/core';
import { LucideChevronDown, LucideClock3, LucideRefreshCw } from '@lucide/angular';

import { formatFifaKickoff } from '../fifa-data';
import { FifaDetailsState, FifaMatch, FifaTeam } from '../fifa.types';
import { FifaMatchDetailsComponent } from '../fifa-match-details/fifa-match-details.component';

@Component({
  selector: 'app-fifa-match-card',
  imports: [FifaMatchDetailsComponent, LucideChevronDown, LucideClock3, LucideRefreshCw],
  templateUrl: './fifa-match-card.component.html',
  styleUrl: './fifa-match-card.component.scss'
})
export class FifaMatchCardComponent {
  readonly match = input.required<FifaMatch>();
  readonly expanded = input(false);
  readonly detailsState = input<FifaDetailsState | null>(null);

  readonly toggle = output<void>();
  readonly retry = output<void>();

  protected readonly statusLabel = computed(() => {
    const match = this.match();
    return match.status === 'scheduled' ? formatFifaKickoff(match.startTimeUtc) : match.statusText;
  });

  protected flagUrl(team: FifaTeam): string {
    return `/api/fifa/flag/${team.code}`;
  }

  protected hideBrokenImage(event: Event): void {
    (event.currentTarget as HTMLImageElement).hidden = true;
  }
}
