import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { TimelineDateToolbarComponent } from './timeline-date-toolbar.component';

describe('TimelineDateToolbarComponent', () => {
  it('emits date, today, and refresh actions', async () => {
    await TestBed.configureTestingModule({ imports: [TimelineDateToolbarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TimelineDateToolbarComponent);
    fixture.componentRef.setInput('eyebrow', 'NBA timeline');
    fixture.componentRef.setInput('date', '2026-06-22');
    fixture.componentRef.setInput('dateLabel', 'Today');
    fixture.componentRef.setInput('dateAriaLabel', 'Jump to a date');
    fixture.componentRef.setInput('updatedLabel', 'Updated now');
    fixture.componentRef.setInput('showToday', true);
    const dateChange = vi.fn();
    const today = vi.fn();
    const refresh = vi.fn();
    fixture.componentInstance.dateChange.subscribe(dateChange);
    fixture.componentInstance.today.subscribe(today);
    fixture.componentInstance.refresh.subscribe(refresh);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '2026-06-20';
    input.dispatchEvent(new Event('change'));
    expect(dateChange).toHaveBeenCalledWith('2026-06-20');
    expect(fixture.nativeElement.textContent).toContain('Today');
    (fixture.nativeElement.querySelector('.today-button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('.refresh-button') as HTMLButtonElement).click();
    expect(today).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    expect(getComputedStyle(fixture.nativeElement).display).toBe('contents');
  });
});
