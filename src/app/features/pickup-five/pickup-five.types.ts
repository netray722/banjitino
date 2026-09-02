export type PlayerRole = 'Guard' | 'Wing' | 'Big';

export type SessionStatus = 'DRAFT' | 'CHECK_IN' | 'ACTIVE' | 'ENDED';

export type SessionPlayerState =
  | 'REGISTERED'
  | 'WAITING'
  | 'PLAYING'
  | 'LEAVING_AFTER_GAME'
  | 'CHECKED_OUT'
  | 'NO_SHOW';

export type GameStatus = 'PROPOSED' | 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface PlayerProfile {
  id: string;
  playerNumber: number;
  displayName: string;
  roles: PlayerRole[];
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionPlayer {
  playerId: string;
  state: SessionPlayerState;
  fairnessCredit: number;
  consecutiveGamesSat: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  lastResult: 'WIN' | 'LOSS' | null;
  lastGameId: string | null;
  tieBreakOrder: number;
  checkedInAt: string | null;
}

export interface PickupGame {
  id: string;
  number: number;
  status: GameStatus;
  teamA: string[];
  teamB: string[];
  winner: 'A' | 'B' | null;
  fairnessApplied: boolean;
  rebalanceCount: number;
  creditedTeamA?: string[];
  creditedTeamB?: string[];
  replacements?: GameReplacement[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface GameReplacement {
  outgoingPlayerId: string;
  incomingPlayerId: string;
  team: 'A' | 'B';
  createdAt: string;
}

export interface PickupSession {
  id: string;
  name: string;
  status: SessionStatus;
  players: SessionPlayer[];
  games: PickupGame[];
  tieBreakCursor: number;
  nextTieBreakOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PickupFiveState {
  schemaVersion: 1;
  revision: number;
  activeSessionId: string | null;
  players: PlayerProfile[];
  sessions: PickupSession[];
  organizerPinHash: string;
}

export interface TeamBalanceResult {
  teamA: string[];
  teamB: string[];
  evaluatedSplits: number;
  score: number;
}
