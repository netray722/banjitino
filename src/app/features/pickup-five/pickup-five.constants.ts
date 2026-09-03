import type { SessionPlayerState } from './pickup-five.types';

export const DEFAULT_ORGANIZER_PIN = '2468';
export const PICKUP_FIVE_STORAGE_KEY = 'banjitino.pickup-five.v1';
export const WINNER_BONUS = 0.15;
export const PRESENT_PLAYER_STATES: ReadonlySet<SessionPlayerState> = new Set([
  'WAITING',
  'PLAYING',
  'LEAVING_AFTER_GAME'
]);
export const SESSION_STRENGTH_MAX_WEIGHT = 0.45;
export const SESSION_STRENGTH_FULL_WEIGHT_GAMES = 8;

export const TEAM_BUILDING_WEIGHTS = {
  strengthImbalance: 1000,
  dominantFive: 5000,
  dominantFour: 1200,
  highWinRateStack: 150,
  teammateRepeat: 6,
  recentTeammate: [18, 8, 3]
} as const;

export const PLAYER_STATUS_LABELS: Readonly<Record<SessionPlayerState, string>> = {
  REGISTERED: 'Registered',
  WAITING: 'Waiting',
  PLAYING: 'Playing',
  LEAVING_AFTER_GAME: 'Leaving after game',
  CHECKED_OUT: 'Checked out',
  NO_SHOW: 'No-show'
};
