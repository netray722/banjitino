import { Component, computed, input, output } from '@angular/core';
import { LucideChevronDown, LucideClock3, LucideRefreshCw } from '@lucide/angular';

import { formatFifaKickoff } from '../fifa-data';
import { FifaDetailsState, FifaMatch, FifaStanding, FifaTeam } from '../fifa.types';
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
  readonly homeStanding = input<FifaStanding | null>(null);
  readonly awayStanding = input<FifaStanding | null>(null);

  readonly toggle = output<void>();
  readonly retry = output<void>();

  protected readonly statusLabel = computed(() => {
    const match = this.match();
    return match.status === 'scheduled' ? formatFifaKickoff(match.startTimeUtc) : match.statusText;
  });
  protected readonly displayedHomeStanding = computed(() => this.match().group ? this.homeStanding() : null);
  protected readonly displayedAwayStanding = computed(() => this.match().group ? this.awayStanding() : null);

  protected standingText(standing: FifaStanding): string {
    return `#${standing.rank} · ${standing.wins}-${standing.draws}-${standing.losses} · ${standing.points} pts · GD ${this.signedValue(standing.goalDifference)}`;
  }

  protected standingLabel(team: FifaTeam, standing: FifaStanding): string {
    return `${team.name} current ${standing.group} standing: rank ${standing.rank}, ${standing.wins} wins, ${standing.draws} draws, ${standing.losses} losses, ${standing.points} points, goal difference ${this.signedValue(standing.goalDifference)}`;
  }

  protected flagUrl(team: FifaTeam): string {
    return `/api/fifa/flag/${team.code}`;
  }

  protected scoreLabel(team: FifaTeam): string {
    const score = team.score ?? 0;
    return team.penaltyScore === null || team.penaltyScore === undefined ? String(score) : `${score} (${team.penaltyScore})`;
  }

  protected hideBrokenImage(event: Event): void {
    (event.currentTarget as HTMLImageElement).hidden = true;
  }

  private signedValue(value: number): string {
    return value > 0 ? `+${value}` : String(value);
  }
}
