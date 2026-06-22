import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { NbaShellComponent } from './nba-shell.component';

describe('NbaShellComponent', () => {
  it('hosts NBA child routes without adding another page header', async () => {
    await TestBed.configureTestingModule({ imports: [NbaShellComponent], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(NbaShellComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
    fixture.destroy();
  });
});
