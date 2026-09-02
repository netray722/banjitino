import { describe, expect, it } from 'vitest';

import {
  WINNER_BONUS,
  balanceTeams,
  checkInPlayer,
  checkOutPlayer,
  recordGameResult,
  selectNextPlayers,
  substitutePlayer
} from './pickup-five-scheduling';
import { PickupGame, PickupSession, PlayerProfile, SessionPlayer } from './pickup-five.types';

describe('Pickup Five scheduling', () => {
  it.each([11, 15, 20, 32])('rotates a %i-player pool without allowing repeat sitters', (count) => {
    const profiles = createProfiles(count);
    let session = createSession(count);
    const rounds = Math.ceil(count / 10) * 4;

    for (let round = 0; round < rounds; round += 1) {
      session = completeNextGame(session, profiles, 'A', round);
    }

    const gamesPlayed = session.players.map((player) => player.gamesPlayed);
    expect(Math.max(...gamesPlayed) - Math.min(...gamesPlayed)).toBeLessThanOrEqual(1);
  });

  it('does not give a late arrival credit for games completed before check-in', () => {
    const profiles = createProfiles(11);
    let session = createSession(10);
    session = completeNextGame(session, profiles, 'A', 0);
    session = checkInPlayer(session, 'p10', '2026-01-01T00:01:00.000Z');

    const lateArrival = session.players.find((player) => player.playerId === 'p10')!;
    expect(lateArrival.fairnessCredit).toBe(0);
    expect(lateArrival.gamesPlayed).toBe(0);
  });

  it('preserves fairness credit across checkout and rejoin without earning credit while absent', () => {
    let session = createSession(11);
    const before = session.players.find((player) => player.playerId === 'p10')!;
    session = checkOutPlayer(session, 'p10', '2026-01-01T00:00:00.000Z');
    session = completeNextGame(session, createProfiles(11), 'A', 0);
    session = checkInPlayer(session, 'p10', '2026-01-01T00:02:00.000Z');
    const after = session.players.find((player) => player.playerId === 'p10')!;

    expect(after.fairnessCredit).toBe(before.fairnessCredit);
    expect(after.state).toBe('WAITING');
  });

  it('rotates deterministic ties instead of permanently favoring a player number', () => {
    let session = createSession(11);
    const profiles = createProfiles(11);
    const sitters = new Set<string>();

    for (let round = 0; round < 11; round += 1) {
      const selected = new Set(selectNextPlayers(session));
      const sitter = session.players.find((player) => !selected.has(player.playerId))!;
      sitters.add(sitter.playerId);
      session = completeNextGame(session, profiles, 'A', round);
    }

    expect(sitters.size).toBe(11);
  });

  it('keeps the winner bonus modest and subordinate to meaningful wait time', () => {
    const session = createSession(11);
    session.players[0].lastResult = 'WIN';
    session.players[0].fairnessCredit = WINNER_BONUS;
    session.players[10].consecutiveGamesSat = 1;

    const selected = selectNextPlayers(session);
    expect(selected[0]).toBe('p10');
  });

  it('builds exactly two distinct teams of five and evaluates all 126 unique splits', () => {
    const profiles = createProfiles(10);
    const balance = balanceTeams(profiles.map((player) => player.id), profiles);

    expect(balance.teamA).toHaveLength(5);
    expect(balance.teamB).toHaveLength(5);
    expect(new Set([...balance.teamA, ...balance.teamB]).size).toBe(10);
    expect(balance.evaluatedSplits).toBe(126);
  });

  it('spreads guards and bigs across teams when roles are available', () => {
    const profiles: PlayerProfile[] = createProfiles(10).map((player, index) => ({
      ...player,
      roles: index < 4 ? ['Guard' as const] : index < 8 ? ['Big' as const] : ['Wing' as const]
    }));
    const balance = balanceTeams(profiles.map((player) => player.id), profiles);
    const roleDifference = (role: 'Guard' | 'Big') => Math.abs(
      balance.teamA.filter((id) => profiles.find((player) => player.id === id)!.roles.includes(role)).length
      - balance.teamB.filter((id) => profiles.find((player) => player.id === id)!.roles.includes(role)).length
    );

    expect(roleDifference('Guard')).toBe(0);
    expect(roleDifference('Big')).toBe(0);
  });

  it('rejects duplicate selected players before balancing', () => {
    const profiles = createProfiles(10);
    expect(() => balanceTeams(['p0', 'p0', ...profiles.slice(2).map((player) => player.id)], profiles))
      .toThrow('Exactly ten distinct players are required.');
  });

  it('only balances the selected ten and never substitutes another profile', () => {
    const profiles = createProfiles(15);
    const selected = profiles.slice(3, 13).map((player) => player.id);
    const balance = balanceTeams(selected, profiles);

    expect(new Set([...balance.teamA, ...balance.teamB])).toEqual(new Set(selected));
  });

  it('records a result and its fairness update exactly once', () => {
    const profiles = createProfiles(11);
    const started = startNextGame(createSession(11), profiles, 0);
    const gameId = started.games[0].id;
    const first = recordGameResult(started, gameId, 'A', '2026-01-01T00:01:00.000Z');
    const second = recordGameResult(first.session, gameId, 'B', '2026-01-01T00:02:00.000Z');

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.session).toBe(first.session);
    expect(second.session.games[0].winner).toBe('A');
    expect(second.session.players.reduce((sum, player) => sum + player.gamesPlayed, 0)).toBe(10);
  });

  it('checks a waiting player out immediately', () => {
    const session = checkOutPlayer(createSession(11), 'p10', '2026-01-01T00:01:00.000Z');
    expect(session.players[10].state).toBe('CHECKED_OUT');
    expect(selectNextPlayers(session)).not.toContain('p10');
  });

  it('substitutes the first waiting player and keeps the outgoing player in the queue', () => {
    const profiles = createProfiles(11);
    const started = startNextGame(createSession(11), profiles, 0);
    const outgoingPlayerId = started.games[0].teamA[0];
    const substituted = substitutePlayer(
      started,
      started.games[0].id,
      outgoingPlayerId,
      'p10',
      'WAITING',
      '2026-01-01T00:01:00.000Z'
    );

    expect(substituted.games[0].teamA).toContain('p10');
    expect(substituted.games[0].teamA).not.toContain(outgoingPlayerId);
    expect(substituted.players.find((player) => player.playerId === outgoingPlayerId)?.state).toBe('WAITING');
    expect(substituted.players.find((player) => player.playerId === 'p10')?.state).toBe('PLAYING');
  });

  it('does not charge a partial-game substitute with a full game', () => {
    const profiles = createProfiles(11);
    const started = startNextGame(createSession(11), profiles, 0);
    const outgoingPlayerId = started.games[0].teamA[0];
    const substituted = substitutePlayer(
      started,
      started.games[0].id,
      outgoingPlayerId,
      'p10',
      'WAITING',
      '2026-01-01T00:01:00.000Z'
    );
    const result = recordGameResult(
      substituted,
      substituted.games[0].id,
      'A',
      '2026-01-01T00:02:00.000Z'
    ).session;
    const substitute = result.players.find((player) => player.playerId === 'p10')!;
    const outgoing = result.players.find((player) => player.playerId === outgoingPlayerId)!;

    expect(substitute.gamesPlayed).toBe(0);
    expect(substitute.fairnessCredit).toBeGreaterThan(0);
    expect(substitute.lastResult).toBe('WIN');
    expect(outgoing.gamesPlayed).toBe(1);
  });
});

function createProfiles(count: number): PlayerProfile[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    playerNumber: 100 - index,
    displayName: `Player ${index}`,
    roles: index % 3 === 0 ? ['Guard'] : index % 3 === 1 ? ['Wing'] : ['Big'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }));
}

function createSession(count: number): PickupSession {
  return {
    id: 'session',
    name: 'Test run',
    status: 'ACTIVE',
    players: Array.from({ length: count }, (_, index): SessionPlayer => ({
      playerId: `p${index}`,
      state: 'WAITING',
      fairnessCredit: 0,
      consecutiveGamesSat: 0,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      lastResult: null,
      lastGameId: null,
      tieBreakOrder: index,
      checkedInAt: '2026-01-01T00:00:00.000Z'
    })),
    games: [],
    tieBreakCursor: 0,
    nextTieBreakOrder: count,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function startNextGame(session: PickupSession, profiles: PlayerProfile[], round: number): PickupSession {
  const selected = selectNextPlayers(session);
  const balance = balanceTeams(selected, profiles, session.games);
  const game: PickupGame = {
    id: `game-${round}`,
    number: round + 1,
    status: 'IN_PROGRESS',
    teamA: balance.teamA,
    teamB: balance.teamB,
    winner: null,
    fairnessApplied: false,
    rebalanceCount: 0,
    creditedTeamA: [...balance.teamA],
    creditedTeamB: [...balance.teamB],
    replacements: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: null
  };
  const participants = new Set(selected);
  return {
    ...session,
    games: [...session.games, game],
    players: session.players.map((player) => participants.has(player.playerId)
      ? { ...player, state: 'PLAYING' as const }
      : player)
  };
}

function completeNextGame(
  session: PickupSession,
  profiles: PlayerProfile[],
  winner: 'A' | 'B',
  round: number
): PickupSession {
  const started = startNextGame(session, profiles, round);
  return recordGameResult(started, `game-${round}`, winner, `2026-01-01T00:${round + 1}:00.000Z`).session;
}
