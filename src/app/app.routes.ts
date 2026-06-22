import { Routes } from '@angular/router';

import { FifaBoardComponent } from './features/sports/fifa';
import { NbaBoardComponent, NbaShellComponent, TradeTimelineComponent } from './features/sports/nba';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'nba' },
  {
    path: 'nba',
    component: NbaShellComponent,
    children: [
      { path: '', component: NbaBoardComponent, title: 'NBA Scores · sidequests.' },
      { path: 'trades', component: TradeTimelineComponent, title: 'NBA Trades · sidequests.' }
    ]
  },
  { path: 'fifa', component: FifaBoardComponent, title: 'FIFA World Cup 2026 · sidequests.' },
  { path: '**', redirectTo: 'nba' }
];
