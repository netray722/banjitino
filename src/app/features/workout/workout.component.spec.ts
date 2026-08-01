import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { WorkoutComponent } from './workout.component';
import { Exercise } from './workout.types';

const exercises: Exercise[] = [
  {
    id: '1', name: 'Push-up', bodyPart: 'chest', equipment: 'body weight', target: 'pectorals',
    muscleGroup: 'triceps', secondaryMuscles: ['shoulders'], steps: ['Start in a plank.', 'Lower and press.'],
    image: 'images/push-up.jpg', gif: 'videos/push-up.gif'
  },
  {
    id: '2', name: 'Barbell squat', bodyPart: 'upper legs', equipment: 'barbell', target: 'glutes',
    muscleGroup: 'quadriceps', secondaryMuscles: ['hamstrings'], steps: ['Brace.', 'Squat and stand.'],
    image: 'images/squat.jpg', gif: 'videos/squat.gif'
  }
];

describe('WorkoutComponent', () => {
  it('loads, filters, clears, and opens exercise details', async () => {
    const http = { get: vi.fn(() => of(exercises)) };
    await TestBed.configureTestingModule({
      imports: [WorkoutComponent],
      providers: [{ provide: HttpClient, useValue: http }]
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkoutComponent);
    fixture.detectChanges();

    expect(http.get).toHaveBeenCalledWith('/workout/exercises.json');
    expect(fixture.nativeElement.querySelectorAll('.exercise-card')).toHaveLength(2);

    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'push';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.exercise-card')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Push-up');

    (fixture.nativeElement.querySelector('.clear-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.exercise-card')).toHaveLength(2);

    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn();
    (fixture.nativeElement.querySelector('.exercise-card button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(dialog.textContent).toContain('How to perform it');
    expect(dialog.textContent).toContain('Lower and press.');
  });

  it('offers a retry when the library fails to load', async () => {
    const http = { get: vi.fn(() => throwError(() => new Error('offline'))) };
    await TestBed.configureTestingModule({
      imports: [WorkoutComponent],
      providers: [{ provide: HttpClient, useValue: http }]
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkoutComponent);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.state-panel button') as HTMLButtonElement).click();

    expect(http.get).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('The library did not load.');
  });
});
