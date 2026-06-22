import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
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
  private readonly sportsMenuRoot = viewChild<ElementRef<HTMLElement>>('sportsMenuRoot');
  private readonly sportsMenuButton = viewChild<ElementRef<HTMLButtonElement>>('sportsMenuButton');
  protected readonly isDarkTheme = signal(false);
  protected readonly sportsMenuOpen = signal(false);
  protected readonly nbaMenuOpen = signal(false);

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

  protected toggleSportsMenu(): void {
    this.sportsMenuOpen.update((isOpen) => !isOpen);
  }

  protected openSportsMenu(event: Event): void {
    event.preventDefault();
    this.sportsMenuOpen.set(true);
    setTimeout(() => this.sportsMenuRoot()?.nativeElement.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
  }

  protected toggleNbaMenu(event: Event): void {
    event.stopPropagation();
    this.nbaMenuOpen.update((isOpen) => !isOpen);
  }

  protected closeSportsMenu(): void {
    this.sportsMenuOpen.set(false);
    this.nbaMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  closeSportsMenuOnOutsideClick(event: MouseEvent): void {
    if (this.sportsMenuOpen() && !this.sportsMenuRoot()?.nativeElement.contains(event.target as Node)) {
      this.closeSportsMenu();
    }
  }

  @HostListener('document:keydown.escape')
  closeSportsMenuOnEscape(): void {
    if (!this.sportsMenuOpen()) return;
    this.closeSportsMenu();
    this.sportsMenuButton()?.nativeElement.focus();
  }

  private applyTheme(): void {
    this.document.documentElement.dataset['theme'] = this.isDarkTheme() ? 'dark' : 'light';
  }
}
