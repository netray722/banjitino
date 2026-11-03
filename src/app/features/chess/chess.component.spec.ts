import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChessComponent } from './chess.component';

describe('ChessComponent', () => {
  const workers: { onmessage: ((event: { data: string }) => void) | null; onerror: (() => void) | null; postMessage: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> }[] = [];

  beforeEach(() => {
    workers.length = 0;
    vi.stubGlobal('Worker', class {
      onmessage = null;
      onerror = null;
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor() { workers.push(this); }
    });
    TestBed.configureTestingModule({ imports: [ChessComponent] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  async function setup() {
    const fixture = TestBed.createComponent(ChessComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const click = async (selector: string) => {
      element.querySelector<HTMLButtonElement>(selector)!.click();
      await fixture.whenStable();
    };
    const play = async () => {
      await click('[data-square="e2"]');
      await click('[data-square="e4"]');
    };
    return { fixture, element, click, play };
  }

  it('renders a keyboard-accessible board and plays the computer reply', async () => {
    const { fixture, element, play } = await setup();
    expect(element.querySelectorAll('.square')).toHaveLength(64);
    expect(element.querySelectorAll('.square[tabindex="0"]')).toHaveLength(1);
    expect(element.querySelector('select')?.value).toBe('medium');
    await play();
    expect(element.textContent).toContain('Computer is thinking');
    expect(workers[0].postMessage).toHaveBeenCalledWith({ moves: ['e4'], difficulty: 'medium' });
    workers[0].onmessage?.({ data: 'e5' });
    await fixture.whenStable();
    expect(element.querySelector('[data-square="e5"]')?.getAttribute('aria-label')).toContain('Black pawn');
    expect(element.textContent).toContain('Your move.');
  });

  it('changes the opponent strength and ignores a cancelled worker reply', async () => {
    const { fixture, element, play } = await setup();
    await play();
    const first = workers[0];
    const select = element.querySelector('select')!;
    select.value = 'hard';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(first.terminate).toHaveBeenCalled();
    expect(workers[1].postMessage).toHaveBeenCalledWith({ moves: ['e4'], difficulty: 'hard' });
    first.onmessage?.({ data: 'e5' });
    await fixture.whenStable();
    expect(element.querySelector('[data-square="e5"]')?.getAttribute('aria-label')).toContain('empty');
  });

  it('takes back a pending move and ignores its late reply', async () => {
    const { fixture, element, click, play } = await setup();
    await play();
    await click('.actions button:last-child');
    expect(workers[0].terminate).toHaveBeenCalled();
    workers[0].onmessage?.({ data: 'e5' });
    await fixture.whenStable();
    expect(element.querySelector('[data-square="e2"]')?.getAttribute('aria-label')).toContain('White pawn');
    expect(element.textContent).toContain('0 half-moves');
  });

  it('confirms restart and terminates the pending calculation', async () => {
    const { element, click, play } = await setup();
    await play();
    await click('.primary-button');
    expect(element.textContent).toContain('Start over?');
    await click('.restart-prompt button');
    expect(workers[0].terminate).toHaveBeenCalled();
    expect(element.textContent).toContain('0 half-moves');
  });

  it('offers retry on worker failure and cleans up on navigation', async () => {
    const { fixture, element, click, play } = await setup();
    await play();
    workers[0].onerror?.();
    await fixture.whenStable();
    expect(element.textContent).toContain('Computer paused.');
    await click('.status-panel button');
    expect(workers).toHaveLength(2);
    fixture.destroy();
    expect(workers[1].terminate).toHaveBeenCalled();
  });

  it('moves board focus with the arrow keys', async () => {
    const { fixture, element } = await setup();
    const square = element.querySelector<HTMLButtonElement>('[data-square="e2"]')!;
    square.focus();
    square.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await fixture.whenStable();
    expect(element.querySelector('[tabindex="0"]')?.getAttribute('data-square')).toBe('e3');
    expect(document.activeElement?.getAttribute('data-square')).toBe('e3');
  });
});
