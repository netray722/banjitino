import { Routes } from '@angular/router';

import { FifaBoardComponent } from './fifa/fifa-board/fifa-board.component';
import { NbaBoardComponent } from './nba/nba-board/nba-board.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'nba' },
  { path: 'nba', component: NbaBoardComponent },
  { path: 'fifa', component: FifaBoardComponent },
  { path: '**', redirectTo: 'nba' }
];
