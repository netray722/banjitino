import { Component, computed, input } from '@angular/core';

import { BoxScore, BoxScoreTeam } from '../nba.types';

@Component({
  selector: 'app-box-score',
  templateUrl: './box-score.component.html',
  styleUrl: './box-score.component.scss'
})
export class BoxScoreComponent {
  readonly boxScore = input.required<BoxScore>();
  protected readonly teams = computed<BoxScoreTeam[]>(() => [this.boxScore().awayTeam, this.boxScore().homeTeam]);

  protected plusMinus(value: number): string {
    return value > 0 ? `+${value}` : String(value);
  }
}
