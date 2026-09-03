import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { PICKUP_FIVE_STORAGE_KEY } from './pickup-five.constants';
import { PickupFiveState, PickupFiveStorage } from './pickup-five.types';

@Injectable({ providedIn: 'root' })
export class BrowserPickupFiveStorage implements PickupFiveStorage {
  private readonly view = inject(DOCUMENT).defaultView;

  load(): PickupFiveState | null {
    const raw = this.view?.localStorage.getItem(PICKUP_FIVE_STORAGE_KEY);
    if (!raw) return null;

    try {
      const state = JSON.parse(raw) as PickupFiveState;
      return state.schemaVersion === 1 ? state : null;
    } catch {
      return null;
    }
  }

  save(state: PickupFiveState, expectedRevision: number): void {
    if (!this.view) return;
    const current = this.load();
    if (current && current.revision !== expectedRevision) {
      throw new Error('This session changed in another tab. The latest data has been reloaded.');
    }
    this.view.localStorage.setItem(PICKUP_FIVE_STORAGE_KEY, JSON.stringify(state));
  }
}

