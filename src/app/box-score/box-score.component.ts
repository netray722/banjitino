import { Component, Input } from '@angular/core';

import { BoxScore, BoxScoreTeam } from '../nba.models';

@Component({
  selector: 'app-box-score',
  templateUrl: './box-score.component.html',
  styleUrl: './box-score.component.css'
})
export class BoxScoreComponent {
  @Input({ required: true }) boxScore!: BoxScore;

  protected teams(): BoxScoreTeam[] {
    return [this.boxScore.awayTeam, this.boxScore.homeTeam];
  }

  protected plusMinus(value: number): string {
    return value > 0 ? `+${value}` : String(value);
  }
}
