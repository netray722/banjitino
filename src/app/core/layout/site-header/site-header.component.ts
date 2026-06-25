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
  private readonly categoryMenuRoot = viewChild<ElementRef<HTMLElement>>('categoryMenuRoot');
  private readonly categoryMenuButton = viewChild<ElementRef<HTMLButtonElement>>('categoryMenuButton');
  protected readonly isDarkTheme = signal(false);
  protected readonly categoryMenuOpen = signal(false);

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

  protected toggleCategoryMenu(): void {
    this.categoryMenuOpen.update((isOpen) => !isOpen);
  }

  protected openCategoryMenu(event: Event): void {
    event.preventDefault();
    this.categoryMenuOpen.set(true);
    setTimeout(() => this.categoryMenuRoot()?.nativeElement.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
  }

  protected closeCategoryMenu(): void {
    this.categoryMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  closeCategoryMenuOnOutsideClick(event: MouseEvent): void {
    if (this.categoryMenuOpen() && !this.categoryMenuRoot()?.nativeElement.contains(event.target as Node)) {
      this.closeCategoryMenu();
    }
  }

  @HostListener('document:keydown.escape')
  closeCategoryMenuOnEscape(): void {
    if (!this.categoryMenuOpen()) return;
    this.closeCategoryMenu();
    this.categoryMenuButton()?.nativeElement.focus();
  }

  private applyTheme(): void {
    this.document.documentElement.dataset['theme'] = this.isDarkTheme() ? 'dark' : 'light';
  }
}
