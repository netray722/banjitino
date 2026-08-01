import { Routes } from '@angular/router';

import { CoverComponent } from './features/cover';
import { NbaBoardComponent } from './features/sports/nba';

export const routes: Routes = [
  { path: '', component: CoverComponent, title: 'sidequests.' },
  { path: 'nba', component: NbaBoardComponent, title: 'NBA Scores · sidequests.' },
  {
    path: 'workout',
    loadComponent: () => import('./features/workout/workout.component').then(({ WorkoutComponent }) => WorkoutComponent),
    title: 'Workout Library · sidequests.'
  },
  { path: '**', redirectTo: '' }
];
