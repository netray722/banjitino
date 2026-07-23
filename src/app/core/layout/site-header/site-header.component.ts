import { DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss'
})
export class SiteHeaderComponent {
  private readonly document = inject(DOCUMENT);
  private readonly view = this.document.defaultView;
  protected readonly isDarkTheme = signal(false);

  constructor() {
    if (!this.view) return;
    const savedTheme = this.view.localStorage.getItem('theme');
    this.isDarkTheme.set(savedTheme
      ? savedTheme === 'dark'
      : this.view.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
    this.applyTheme();
  }

  protected toggleTheme(): void {
    this.isDarkTheme.update((isDark) => !isDark);
    this.view?.localStorage.setItem('theme', this.isDarkTheme() ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme(): void {
    this.document.documentElement.dataset['theme'] = this.isDarkTheme() ? 'dark' : 'light';
  }
}
