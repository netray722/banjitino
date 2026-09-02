import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { PickupFiveState } from './pickup-five.types';

const STORAGE_KEY = 'banjitino.pickup-five.v1';

export interface PickupFiveStorage {
  load(): PickupFiveState | null;
  save(state: PickupFiveState, expectedRevision: number): void;
}

@Injectable({ providedIn: 'root' })
export class BrowserPickupFiveStorage implements PickupFiveStorage {
  private readonly view = inject(DOCUMENT).defaultView;

  load(): PickupFiveState | null {
    const raw = this.view?.localStorage.getItem(STORAGE_KEY);
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
    this.view.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

