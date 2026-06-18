import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SiteHeaderComponent } from './core/layout/site-header/site-header.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {}
