import { TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { Exercise } from './workout.types';

const PAGE_SIZE = 24;

@Component({
  selector: 'app-workout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TitleCasePipe],
  templateUrl: './workout.component.html',
  styleUrl: './workout.component.scss'
})
export class WorkoutComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly exercises = signal<Exercise[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly query = signal('');
  protected readonly bodyPart = signal('');
  protected readonly equipment = signal('');
  protected readonly visibleCount = signal(PAGE_SIZE);
  protected readonly selectedExercise = signal<Exercise | null>(null);
  protected readonly bodyParts = computed(() => this.options('bodyPart'));
  protected readonly equipmentOptions = computed(() => this.options('equipment'));
  protected readonly filteredExercises = computed(() => {
    const query = this.query().trim().toLowerCase();
    const bodyPart = this.bodyPart();
    const equipment = this.equipment();

    return this.exercises().filter((exercise) =>
      (!bodyPart || exercise.bodyPart === bodyPart)
      && (!equipment || exercise.equipment === equipment)
      && (!query || [exercise.name, exercise.target, exercise.muscleGroup, exercise.equipment]
        .some((value) => value.toLowerCase().includes(query)))
    );
  });
  protected readonly visibleExercises = computed(() =>
    this.filteredExercises().slice(0, this.visibleCount())
  );

  ngOnInit(): void {
    this.loadExercises();
  }

  protected loadExercises(): void {
    this.loading.set(true);
    this.error.set(false);
    this.http.get<Exercise[]>('/workout/exercises.json').subscribe({
      next: (exercises) => {
        this.exercises.set(exercises);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  protected updateQuery(value: string): void {
    this.query.set(value);
    this.visibleCount.set(PAGE_SIZE);
  }

  protected updateBodyPart(value: string): void {
    this.bodyPart.set(value);
    this.visibleCount.set(PAGE_SIZE);
  }

  protected updateEquipment(value: string): void {
    this.equipment.set(value);
    this.visibleCount.set(PAGE_SIZE);
  }

  protected clearFilters(): void {
    this.query.set('');
    this.bodyPart.set('');
    this.equipment.set('');
    this.visibleCount.set(PAGE_SIZE);
  }

  protected showMore(): void {
    this.visibleCount.update((count) => count + PAGE_SIZE);
  }

  protected openExercise(exercise: Exercise, dialog: HTMLDialogElement): void {
    this.selectedExercise.set(exercise);
    dialog.showModal();
  }

  protected closeExercise(): void {
    this.selectedExercise.set(null);
  }

  protected mediaUrl(path: string): string {
    return `/workout/${path}`;
  }

  private options(key: 'bodyPart' | 'equipment'): string[] {
    return [...new Set(this.exercises().map((exercise) => exercise[key]))].sort();
  }
}
