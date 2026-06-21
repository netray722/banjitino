import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimelinePreviousLoaderComponent } from './timeline-previous-loader.component';

describe('TimelinePreviousLoaderComponent', () => {
  let fixture: ComponentFixture<TimelinePreviousLoaderComponent>;
  let loads: number;

  beforeEach(async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    Object.defineProperty(document.documentElement, 'scrollTop', { configurable: true, value: 0, writable: true });
    await TestBed.configureTestingModule({ imports: [TimelinePreviousLoaderComponent] }).compileComponents();
    fixture = TestBed.createComponent(TimelinePreviousLoaderComponent);
    loads = 0;
    fixture.componentInstance.loadPrevious.subscribe(() => loads += 1);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('does not load merely because the viewport is at the top', () => {
    window.dispatchEvent(new Event('scroll'));
    expect(loads).toBe(0);
  });

  it('loads once after a touch pull passes the threshold and is released', () => {
    dispatchTouch('touchstart', 100); dispatchTouch('touchmove', 150); dispatchTouch('touchend');
    expect(loads).toBe(0);
    dispatchTouch('touchstart', 100); dispatchTouch('touchmove', 180); dispatchTouch('touchend');
    expect(loads).toBe(1);
  });

  it('requires a new desktop wheel gesture after arriving at the top', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 10 });
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -50 }));
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }));
    expect(loads).toBe(0);
    vi.advanceTimersByTime(181);
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -40 }));
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -40 }));
    expect(loads).toBe(1);
  });

  it('ignores pull gestures while unavailable or loading', () => {
    fixture.componentRef.setInput('loading', true); fixture.detectChanges();
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }));
    expect(loads).toBe(0);
    vi.advanceTimersByTime(181);
    fixture.componentRef.setInput('loading', false); fixture.componentRef.setInput('available', false); fixture.detectChanges();
    dispatchTouch('touchstart', 100); dispatchTouch('touchmove', 200); dispatchTouch('touchend');
    expect(loads).toBe(0);
  });

  it('keeps click and keyboard activation as an accessible fallback', () => {
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(loads).toBe(1);
  });
});

function dispatchTouch(type: string, clientY?: number): void {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'touches', { value: clientY === undefined ? [] : [{ clientY }] });
  window.dispatchEvent(event);
}
