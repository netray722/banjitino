import { Routes } from '@angular/router';

import { CoverComponent } from './features/cover';
import { NbaBoardComponent } from './features/sports/nba';

export const routes: Routes = [
  { path: '', component: CoverComponent, title: 'sidequests.' },
  { path: 'nba', component: NbaBoardComponent, title: 'NBA Scores · sidequests.' },
  { path: '**', redirectTo: '' }
];
