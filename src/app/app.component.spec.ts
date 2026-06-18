import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('renders banner navigation for NBA and FIFA boards', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    const links = fixture.nativeElement.querySelectorAll('.board-nav a') as NodeListOf<HTMLAnchorElement>;

    expect(text).toContain('banjitino.com');
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
