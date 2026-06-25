import { Routes } from '@angular/router';

import { CoverComponent } from './features/cover';
import { FifaBoardComponent } from './features/sports/fifa';
import { NbaBoardComponent, NbaShellComponent } from './features/sports/nba';

export const routes: Routes = [
  { path: '', component: CoverComponent, title: 'sidequests.' },
  {
    path: 'nba',
    component: NbaShellComponent,
    children: [
      { path: '', component: NbaBoardComponent, title: 'NBA Scores · sidequests.' }
    ]
  },
  { path: 'fifa', component: FifaBoardComponent, title: 'FIFA World Cup 2026 · sidequests.' },
  { path: '**', redirectTo: '' }
];
