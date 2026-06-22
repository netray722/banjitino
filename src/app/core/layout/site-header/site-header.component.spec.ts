import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { SiteHeaderComponent } from './site-header.component';

describe('SiteHeaderComponent', () => {
  it('renders the personal banner and Sports dropdown', async () => {
    await TestBed.configureTestingModule({
      imports: [SiteHeaderComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(SiteHeaderComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('sidequests.');
    expect(fixture.nativeElement.querySelector('.brand-mark')).toBeNull();
    const menuButton = fixture.nativeElement.querySelector('.sports-menu-button') as HTMLButtonElement;
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
    menuButton.click();
    fixture.detectChanges();
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    const nbaButton = fixture.nativeElement.querySelector('.section-menu-button') as HTMLButtonElement;
    expect(nbaButton.getAttribute('aria-expanded')).toBe('false');
    nbaButton.click();
    fixture.detectChanges();
    const nbaLinks = fixture.nativeElement.querySelectorAll('.section-submenu a') as NodeListOf<HTMLAnchorElement>;
    expect(nbaButton.getAttribute('aria-expanded')).toBe('true');
    expect([...nbaLinks].map((link) => link.getAttribute('href'))).toEqual(['/nba', '/nba/trades']);
    expect(fixture.nativeElement.querySelector('.sports-menu > a').getAttribute('href')).toBe('/fifa');
  });

  it('toggles and saves the site theme', async () => {
    window.localStorage.setItem('theme', 'light');

    await TestBed.configureTestingModule({
      imports: [SiteHeaderComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(SiteHeaderComponent);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector('.theme-toggle') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(toggle.getAttribute('aria-label')).toBe('Switch to light theme');
  });
});
