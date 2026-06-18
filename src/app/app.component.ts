import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  @ViewChild('sportsMenuRoot') private sportsMenuRoot?: ElementRef<HTMLElement>;
  @ViewChild('sportsMenuButton') private sportsMenuButton?: ElementRef<HTMLButtonElement>;

  isDarkTheme = false;
  sportsMenuOpen = false;

  constructor() {
    if (typeof window === 'undefined') return;
    const savedTheme = window.localStorage.getItem('theme');
    this.isDarkTheme = savedTheme
      ? savedTheme === 'dark'
      : window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    this.applyTheme();
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    window.localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
    this.applyTheme();
  }

  toggleSportsMenu(): void {
    this.sportsMenuOpen = !this.sportsMenuOpen;
  }

  openSportsMenu(event: Event): void {
    event.preventDefault();
    this.sportsMenuOpen = true;
    setTimeout(() => this.sportsMenuRoot?.nativeElement.querySelector<HTMLAnchorElement>('a')?.focus());
  }

  closeSportsMenu(): void {
    this.sportsMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  closeSportsMenuOnOutsideClick(event: MouseEvent): void {
    if (this.sportsMenuOpen && !this.sportsMenuRoot?.nativeElement.contains(event.target as Node)) {
      this.closeSportsMenu();
    }
  }

  @HostListener('document:keydown.escape')
  closeSportsMenuOnEscape(): void {
    if (!this.sportsMenuOpen) return;
    this.closeSportsMenu();
    this.sportsMenuButton?.nativeElement.focus();
  }

  private applyTheme(): void {
    document.documentElement.dataset['theme'] = this.isDarkTheme ? 'dark' : 'light';
  }
}
