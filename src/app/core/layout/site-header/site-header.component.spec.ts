import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { SiteHeaderComponent } from './site-header.component';

describe('SiteHeaderComponent', () => {
  it('renders the personal banner and primary navigation', async () => {
    await TestBed.configureTestingModule({
      imports: [SiteHeaderComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(SiteHeaderComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Banjitino');
    expect(fixture.nativeElement.textContent).toContain('Field notes for curious people');
    const links = fixture.nativeElement.querySelectorAll('.primary-nav a') as NodeListOf<HTMLAnchorElement>;
    expect([...links].map((link) => link.getAttribute('href'))).toEqual(['/nba', '/workout']);
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
