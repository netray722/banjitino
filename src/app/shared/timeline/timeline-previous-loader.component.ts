import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, input, output, signal } from '@angular/core';

import { PULL_THRESHOLD_PX, WHEEL_GESTURE_IDLE_MS } from './timeline-previous-loader.constants';

@Component({
  selector: 'app-timeline-previous-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-previous-loader.component.html',
  styleUrl: './timeline-previous-loader.component.scss'
})
export class TimelinePreviousLoaderComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly view = inject(DOCUMENT).defaultView;
  private touchStartY: number | null = null;
  private wheelDistance = 0;
  private wheelGestureActive = false;
  private wheelGestureBlocked = false;
  private wheelResetTimer?: ReturnType<typeof setTimeout>;

  readonly available = input(true);
  readonly loading = input(false);
  readonly itemLabel = input('days');
  readonly boundaryText = input('No earlier dates found');
  readonly loadPrevious = output<void>();
  protected readonly pullProgress = signal(0);
  protected readonly pullTransform = computed(() => this.pullProgress() > 0 ? `translateY(${this.pullProgress() * 6}px)` : null);
  protected readonly pullState = computed<'idle' | 'pulling' | 'ready'>(() => {
    const progress = this.pullProgress();
    return progress >= 1 ? 'ready' : progress > 0 ? 'pulling' : 'idle';
  });

  constructor() {
    this.view?.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.view?.addEventListener('wheel', this.onWheel, { passive: false });
    this.destroyRef.onDestroy(() => {
      if (this.wheelResetTimer) clearTimeout(this.wheelResetTimer);
      this.view?.removeEventListener('touchmove', this.onTouchMove);
      this.view?.removeEventListener('wheel', this.onWheel);
    });
  }

  @HostListener('window:touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.resetPull();
    if (!this.canStart() || !this.isAtTop() || event.touches.length !== 1) return;
    this.touchStartY = event.touches[0].clientY;
  }

  private readonly onTouchMove = (event: TouchEvent): void => {
    if (this.touchStartY === null || event.touches.length !== 1) return;
    if (!this.canStart() || !this.isAtTop()) {
      this.resetPull();
      return;
    }
    const distance = Math.max(0, event.touches[0].clientY - this.touchStartY);
    this.pullProgress.set(Math.min(distance / PULL_THRESHOLD_PX, 1));
    if (distance > 0 && event.cancelable) event.preventDefault();
  };

  @HostListener('window:touchend')
  onTouchEnd(): void {
    const shouldLoad = this.pullProgress() >= 1;
    this.resetPull();
    if (shouldLoad) this.requestLoad();
  }

  @HostListener('window:touchcancel')
  onTouchCancel(): void { this.resetPull(); }

  private readonly onWheel = (event: WheelEvent): void => {
    this.scheduleWheelReset();
    if (!this.wheelGestureActive) {
      this.wheelGestureActive = true;
      this.wheelGestureBlocked = !this.canStart() || !this.isAtTop();
    }
    if (this.wheelGestureBlocked || event.deltaY >= 0) return;
    if (!this.canStart() || !this.isAtTop()) {
      this.wheelGestureBlocked = true;
      this.pullProgress.set(0);
      return;
    }
    this.wheelDistance += this.normalizedWheelDistance(event);
    this.pullProgress.set(Math.min(this.wheelDistance / PULL_THRESHOLD_PX, 1));
    if (event.cancelable) event.preventDefault();
    if (this.wheelDistance >= PULL_THRESHOLD_PX) {
      this.wheelGestureBlocked = true;
      this.requestLoad();
    }
  };

  protected requestLoad(): void {
    if (!this.canStart()) return;
    this.resetPull();
    this.loadPrevious.emit();
  }

  private canStart(): boolean { return this.available() && !this.loading(); }
  private isAtTop(): boolean { return window.scrollY <= 0 && document.documentElement.scrollTop <= 0; }
  private normalizedWheelDistance(event: WheelEvent): number {
    const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
    return Math.max(0, -event.deltaY * multiplier);
  }
  private scheduleWheelReset(): void {
    if (this.wheelResetTimer) clearTimeout(this.wheelResetTimer);
    this.wheelResetTimer = setTimeout(() => {
      this.wheelGestureActive = false;
      this.wheelGestureBlocked = false;
      this.wheelDistance = 0;
      this.pullProgress.set(0);
    }, WHEEL_GESTURE_IDLE_MS);
  }
  private resetPull(): void {
    this.touchStartY = null;
    this.wheelDistance = 0;
    this.pullProgress.set(0);
  }
}
