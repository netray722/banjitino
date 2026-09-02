import { describe, expect, it } from 'vitest';

import {
  WINNER_BONUS,
  buildTeams,
  checkInPlayer,
  checkOutPlayer,
  getStayTeam,
  rankWaitingPlayers,
  recordGameResult,
  selectNextPlayers,
  selectPlayersForGame,
  substitutePlayer,
  updateTeammateHistory
} from './pickup-five-scheduling';
import { PickupGame, PickupSession, PlayerProfile, SessionPlayer, StayTeam } from './pickup-five.types';

describe('Pickup Five scheduling', () => {
  it('applies the 13-player fairness example exactly', () => {
    const profiles = createProfiles(13);
    const started = startNextGame(createSession(13), profiles, 0);
    const game = started.games[0];
    const result = recordGameResult(started, game.id, 'A', '2026-01-01T00:01:00.000Z').session;
    const fullGamePlayers = new Set([...(game.creditedTeamA ?? []), ...(game.creditedTeamB ?? [])]);

    for (const player of result.players) {
      expect(player.fairnessCredit).toBeCloseTo(fullGamePlayers.has(player.playerId) ? 10 / 13 - 1 : 10 / 13);
    }
    expect(result.players.filter((player) => !fullGamePlayers.has(player.playerId))
      .every((player) => player.consecutiveGamesSat === 1)).toBe(true);
  });

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

  it('keeps the exact five-player winner together after its first win', () => {
    const profiles = createProfiles(13);
    const started = startNextGame(createSession(13), profiles, 0);
    const winners = [...started.games[0].teamA];
    const completed = recordGameResult(started, started.games[0].id, 'A', '2026-01-01T00:01:00.000Z').session;
    const next = selectPlayersForGame(completed);
    const expectedChallengers = rankWaitingPlayers(completed, winners).slice(0, 5).map((player) => player.playerId);

    expect(next.stayTeam?.playerIds).toEqual(winners);
    expect(next.stayTeam?.consecutiveWins).toBe(1);
    expect(next.selectedPlayerIds).toEqual([...winners, ...expectedChallengers]);
  });

  it('forces a full fairness reset after the same five win twice', () => {
    const profiles = createProfiles(13);
    let session = startNextGame(createSession(13), profiles, 0);
    session = recordGameResult(session, session.games[0].id, 'A', '2026-01-01T00:01:00.000Z').session;
    session = startNextGame(session, profiles, 1, true);
    const secondGame = session.games[1];
    session = recordGameResult(session, secondGame.id, secondGame.stayTeam!, '2026-01-01T00:02:00.000Z').session;
    const next = selectPlayersForGame(session);

    expect(session.games[1].winnerStreak).toBe(2);
    expect(getStayTeam(session.games)).toBeNull();
    expect(next.stayTeam).toBeNull();
    expect(next.selectedPlayerIds).toEqual(selectNextPlayers(session));
  });

  it('moves the stay privilege to challengers who beat the staying team', () => {
    const profiles = createProfiles(13);
    let session = startNextGame(createSession(13), profiles, 0);
    session = recordGameResult(session, session.games[0].id, 'A', '2026-01-01T00:01:00.000Z').session;
    session = startNextGame(session, profiles, 1, true);
    const secondGame = session.games[1];
    const challengerSide = secondGame.stayTeam === 'A' ? 'B' : 'A';
    const challengers = challengerSide === 'A' ? secondGame.teamA : secondGame.teamB;
    session = recordGameResult(session, secondGame.id, challengerSide, '2026-01-01T00:02:00.000Z').session;

    expect(getStayTeam(session.games)).toEqual({
      playerIds: challengers,
      side: challengerSide,
      consecutiveWins: 1
    });
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

  it('keeps the winner bonus subordinate to meaningful wait time', () => {
    const session = createSession(11);
    session.players[0].lastResult = 'WIN';
    session.players[0].fairnessCredit = WINNER_BONUS;
    session.players[10].consecutiveGamesSat = 1;

    expect(selectNextPlayers(session)[0]).toBe('p10');
  });

  it('builds exactly two distinct teams of five and evaluates all 126 unique splits', () => {
    const profiles = createProfiles(10);
    const session = createSession(10);
    const teams = buildTeams(profiles.map((player) => player.id), profiles, session);

    expect(teams.teamA).toHaveLength(5);
    expect(teams.teamB).toHaveLength(5);
    expect(new Set([...teams.teamA, ...teams.teamB]).size).toBe(10);
    expect(teams.evaluatedSplits).toBe(126);
  });

  it('never changes fair player selection to improve team balance', () => {
    const profiles = createProfiles(15);
    const session = createSession(15);
    const selected = selectNextPlayers(session);
    const teams = buildTeams(selected, profiles, session);

    expect(new Set([...teams.teamA, ...teams.teamB])).toEqual(new Set(selected));
  });

  it('breaks a five-player lineup apart after its second consecutive win', () => {
    const profiles = createProfiles(10);
    let session = startNextGame(createSession(10), profiles, 0);
    const dominantTeam = [...session.games[0].teamA];
    session = recordGameResult(session, session.games[0].id, 'A', '2026-01-01T00:01:00.000Z').session;
    session = startNextGame(session, profiles, 1, true);
    session = recordGameResult(session, session.games[1].id, session.games[1].stayTeam!, '2026-01-01T00:02:00.000Z').session;
    const teams = buildTeams(selectNextPlayers(session), profiles, session);
    const overlap = Math.max(
      dominantTeam.filter((playerId) => teams.teamA.includes(playerId)).length,
      dominantTeam.filter((playerId) => teams.teamB.includes(playerId)).length
    );

    expect(overlap).toBeLessThanOrEqual(3);
  });

  it('distributes the four strongest career players evenly', () => {
    const profiles = createProfiles(10);
    const current = createSession(10);
    const career = {
      ...createSession(10),
      id: 'career',
      status: 'ENDED' as const,
      players: createSession(10).players.map((player, index) => ({
        ...player,
        gamesPlayed: 20,
        wins: index < 4 ? 18 : 8,
        losses: index < 4 ? 2 : 12
      }))
    };
    const teams = buildTeams(selectNextPlayers(current), profiles, current, [career, current]);
    const strongest = new Set(['p0', 'p1', 'p2', 'p3']);

    expect(teams.teamA.filter((playerId) => strongest.has(playerId))).toHaveLength(2);
    expect(teams.teamB.filter((playerId) => strongest.has(playerId))).toHaveLength(2);
  });

  it('expands teammate variety over many simulated games', () => {
    const profiles = createProfiles(10);
    let session = createSession(10);

    for (let round = 0; round < 12; round += 1) {
      const teams = buildTeams(selectNextPlayers(session), profiles, session);
      session = updateTeammateHistory(session, teams.teamA, teams.teamB);
      session = {
        ...session,
        games: [...session.games, createCompletedGame(`variety-${round}`, round + 1, teams.teamA, teams.teamB, round % 2 ? 'B' : 'A')]
      };
    }

    const teammateCounts = session.players.map((player) => Object.keys(session.teammateHistory ?? {})
      .filter((key) => key.split('|').includes(player.playerId)).length);
    expect(Math.min(...teammateCounts)).toBeGreaterThanOrEqual(8);
  });

  it('records teammate pairs only when explicitly updating a started game', () => {
    const session = createSession(10);
    const updated = updateTeammateHistory(session, ['p0', 'p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', 'p8', 'p9']);

    expect(Object.keys(updated.teammateHistory ?? {})).toHaveLength(20);
    expect(updated.teammateHistory?.['p0|p1']).toBe(1);
    expect(session.teammateHistory).toEqual({});
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
    expect(second.session.games[0].winnerStreak).toBe(1);
    expect(second.session.players.reduce((sum, player) => sum + player.gamesPlayed, 0)).toBe(10);
  });

  it('checks a waiting player out immediately and removes them from selection', () => {
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
    teammateHistory: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function startNextGame(
  session: PickupSession,
  profiles: PlayerProfile[],
  round: number,
  useStayRule = false
): PickupSession {
  const selection = useStayRule
    ? selectPlayersForGame(session)
    : { selectedPlayerIds: selectNextPlayers(session), stayTeam: null as StayTeam | null };
  const stayIds = new Set(selection.stayTeam?.playerIds ?? []);
  const challengers = selection.selectedPlayerIds.filter((playerId) => !stayIds.has(playerId));
  const teams = selection.stayTeam
    ? {
      teamA: selection.stayTeam.side === 'A' ? selection.stayTeam.playerIds : challengers,
      teamB: selection.stayTeam.side === 'B' ? selection.stayTeam.playerIds : challengers
    }
    : buildTeams(selection.selectedPlayerIds, profiles, session);
  const game: PickupGame = {
    id: `game-${round}`,
    number: round + 1,
    status: 'IN_PROGRESS',
    teamA: teams.teamA,
    teamB: teams.teamB,
    winner: null,
    fairnessApplied: false,
    rebalanceCount: 0,
    creditedTeamA: [...teams.teamA],
    creditedTeamB: [...teams.teamB],
    replacements: [],
    stayTeam: selection.stayTeam?.side ?? null,
    createdAt: '2026-01-01T00:00:00.000Z',
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: null
  };
  const participants = new Set(selection.selectedPlayerIds);
  const started = {
    ...session,
    games: [...session.games, game],
    players: session.players.map((player) => participants.has(player.playerId)
      ? { ...player, state: 'PLAYING' as const }
      : player)
  };
  return updateTeammateHistory(started, game.teamA, game.teamB);
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

function createCompletedGame(
  id: string,
  number: number,
  teamA: string[],
  teamB: string[],
  winner: 'A' | 'B'
): PickupGame {
  return {
    id,
    number,
    status: 'COMPLETED',
    teamA,
    teamB,
    winner,
    fairnessApplied: true,
    rebalanceCount: 0,
    creditedTeamA: [...teamA],
    creditedTeamB: [...teamB],
    replacements: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:01:00.000Z'
  };
}
