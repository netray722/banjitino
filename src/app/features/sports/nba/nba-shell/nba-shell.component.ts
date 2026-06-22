import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-nba-shell',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nba-shell.component.html',
  styleUrl: './nba-shell.component.scss'
})
export class NbaShellComponent {}
