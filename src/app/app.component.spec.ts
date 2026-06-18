import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('renders the personal banner and Sports dropdown', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('sidequests.');
    expect(fixture.nativeElement.querySelector('.brand-mark')).toBeNull();
    const menuButton = fixture.nativeElement.querySelector('.sports-menu-button') as HTMLButtonElement;
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
    menuButton.click();
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll('.sports-menu a') as NodeListOf<HTMLAnchorElement>;
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('/nba');
    expect(links[1].getAttribute('href')).toBe('/fifa');
  });

  it('toggles and saves the site theme', async () => {
    window.localStorage.setItem('theme', 'light');

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector('.theme-toggle') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(toggle.getAttribute('aria-label')).toBe('Switch to light theme');
  });
});
