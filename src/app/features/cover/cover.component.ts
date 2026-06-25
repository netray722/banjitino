import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface WeatherResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
}

const QUOTES = [
  { text: 'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.', author: 'Ralph Waldo Emerson' },
  { text: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
  { text: 'Act as if what you do makes a difference. It does.', author: 'William James' },
  { text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
  { text: 'Stay hungry. Stay foolish.', author: 'Steve Jobs' }
];

@Component({
  selector: 'app-cover',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cover.component.html',
  styleUrl: './cover.component.scss'
})
export class CoverComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly http = inject(HttpClient);
  private readonly view = this.document.defaultView;
  private timerId: number | undefined;

  protected readonly now = signal(new Date());
  protected readonly weather = signal('Weather unavailable');
  protected readonly place = signal('Local weather');
  protected readonly coverImage = computed(() => {
    const day = this.now().toISOString().slice(0, 10);
    return `https://picsum.photos/seed/sidequests-${day}/2400/1400.webp`;
  });
  protected readonly quote = computed(() => QUOTES[this.dayOfYear(this.now()) % QUOTES.length]);
  protected readonly time = computed(() => this.now().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));

  ngOnInit(): void {
    this.timerId = this.view?.setInterval(() => this.now.set(new Date()), 1000);
    this.loadWeather();
  }

  ngOnDestroy(): void {
    if (this.timerId === undefined) return;
    this.view?.clearInterval(this.timerId);
  }

  private loadWeather(): void {
    const geolocation = this.view?.navigator.geolocation;
    if (!geolocation) return;

    geolocation.getCurrentPosition(({ coords }) => {
      const url = 'https://api.open-meteo.com/v1/forecast'
        + `?latitude=${coords.latitude}&longitude=${coords.longitude}`
        + '&current=temperature_2m,weather_code&temperature_unit=fahrenheit';

      this.http.get<WeatherResponse>(url).subscribe(({ current }) => {
        if (current?.temperature_2m === undefined) return;
        this.weather.set(`${Math.round(current.temperature_2m)}°`);
        this.place.set(this.weatherLabel(current.weather_code));
      });
    }, () => {
      this.weather.set('Allow location');
      this.place.set('Local weather');
    });
  }

  private weatherLabel(code: number | undefined): string {
    if (code === undefined) return 'Local weather';
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Cloudy';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Showers';
    return 'Storms';
  }

  private dayOfYear(date: Date): number {
    return Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  }
}
