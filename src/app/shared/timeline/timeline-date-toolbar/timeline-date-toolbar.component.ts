import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideCalendarDays, LucideRefreshCw } from '@lucide/angular';

@Component({
  selector: 'app-timeline-date-toolbar',
  imports: [LucideCalendarDays, LucideRefreshCw],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-date-toolbar.component.html',
  styleUrl: './timeline-date-toolbar.component.scss'
})
export class TimelineDateToolbarComponent {
  readonly eyebrow = input.required<string>();
  readonly date = input.required<string>();
  readonly dateLabel = input.required<string>();
  readonly dateAriaLabel = input.required<string>();
  readonly inputId = input('timeline-date');
  readonly updatedLabel = input.required<string>();
  readonly loading = input(false);
  readonly refreshing = input(false);
  readonly showToday = input(false);
  readonly minDate = input<string | null>(null);
  readonly maxDate = input<string | null>(null);
  readonly dateChange = output<string>();
  readonly today = output<void>();
  readonly refresh = output<void>();

  protected openDatePicker(input: HTMLInputElement): void {
    input.focus();
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  }

  protected changeDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.dateChange.emit(value);
  }
}
