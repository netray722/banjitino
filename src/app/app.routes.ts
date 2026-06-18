import { Routes } from '@angular/router';

import { FifaBoardComponent } from './fifa/fifa-board/fifa-board.component';
import { NbaBoardComponent } from './nba/nba-board/nba-board.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'nba' },
  { path: 'nba', component: NbaBoardComponent, title: 'NBA Scores · sidequests.' },
  { path: 'fifa', component: FifaBoardComponent, title: 'FIFA World Cup 2026 · sidequests.' },
  { path: '**', redirectTo: 'nba' }
];
