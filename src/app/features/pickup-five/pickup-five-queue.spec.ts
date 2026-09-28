import { describe, expect, it } from 'vitest';

import { checkInPlayer, checkOutPlayer, rankWaitingPlayers } from './pickup-five-queue';
import { createSessionPlayer } from './pickup-five-state.factory';
import { PickupSession } from './pickup-five.types';

describe('Pickup Five newcomer priority', () => {
  it.each([0, 3, 7])('places a late arrival behind %i existing newcomers and ahead of returning players', (newcomerCount) => {
    const session = createSession();
    session.players = session.players.map((player, index) => ({
      ...player,
      state: index < 10 ? 'PLAYING' : 'WAITING',
      gamesPlayed: index >= 10 && index < 10 + newcomerCount ? 0 : 2,
      consecutiveGamesSat: index < 10 ? 0 : 2,
      fairnessCredit: 3
    }));

    const checkedIn = checkInPlayer(session, 'late-arrival', '2026-01-01T00:10:00.000Z');
    const waiting = rankWaitingPlayers(checkedIn).map((player) => player.playerId);

    expect(waiting).toHaveLength(8);
    expect(waiting.indexOf('late-arrival')).toBe(newcomerCount);
    expect(waiting.slice(0, newcomerCount)).toEqual(
      session.players.slice(10, 10 + newcomerCount).map((player) => player.playerId)
    );
    expect(checkedIn.players.at(-1)?.fairnessCredit).toBe(0);
  });

  it('orders newcomers by check-in time rather than registration, credits, or the rotation cursor', () => {
    const session = createSession();
    session.tieBreakCursor = 2;
    session.players = [
      { ...createSessionPlayer('later', 0), state: 'WAITING', checkedInAt: '2026-01-01T00:02:00.000Z', fairnessCredit: 5, consecutiveGamesSat: 2 },
      { ...createSessionPlayer('earlier', 1), state: 'WAITING', checkedInAt: '2026-01-01T00:01:00.000Z' },
      { ...createSessionPlayer('latest', 2), state: 'WAITING', checkedInAt: '2026-01-01T00:03:00.000Z' }
    ];

    expect(rankWaitingPlayers(session).map((player) => player.playerId)).toEqual(['earlier', 'later', 'latest']);
  });

  it('breaks identical check-in timestamps deterministically without rotating newcomers', () => {
    const session = createSession();
    session.tieBreakCursor = 12;
    session.players.reverse();

    expect(rankWaitingPlayers(session).map((player) => player.tieBreakOrder)).toEqual(
      Array.from({ length: 17 }, (_, index) => index)
    );
  });

  it('does not restore newcomer priority when an experienced player checks back in', () => {
    const session = createSession();
    session.players[0].gamesPlayed = 1;
    session.players[0].fairnessCredit = 4;
    session.players[0].consecutiveGamesSat = 2;
    const checkedOut = checkOutPlayer(session, 'p0', '2026-01-01T00:01:00.000Z');
    const rejoined = checkInPlayer(checkedOut, 'p0', '2026-01-01T00:02:00.000Z');

    expect(rankWaitingPlayers(rejoined).at(-1)?.playerId).toBe('p0');
    expect(rejoined.players[0]).toMatchObject({ gamesPlayed: 1, fairnessCredit: 4, consecutiveGamesSat: 2 });
  });

  it('puts a returning newcomer behind newcomers who remained checked in', () => {
    const checkedOut = checkOutPlayer(createSession(), 'p0', '2026-01-01T00:01:00.000Z');
    const rejoined = checkInPlayer(checkedOut, 'p0', '2026-01-01T00:02:00.000Z');

    expect(rankWaitingPlayers(rejoined).at(-1)?.playerId).toBe('p0');
  });

  it('keeps unavailable and explicitly excluded newcomers out of the queue', () => {
    const session = createSession();
    session.players[0].state = 'PLAYING';
    session.players[1].state = 'CHECKED_OUT';
    session.players[2].state = 'REGISTERED';

    expect(rankWaitingPlayers(session, ['p3']).map((player) => player.playerId)).toEqual(
      session.players.slice(4).map((player) => player.playerId)
    );
  });
});

function createSession(): PickupSession {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'session',
    name: 'Newcomer priority',
    status: 'ACTIVE',
    players: Array.from({ length: 17 }, (_, index) => ({
      ...createSessionPlayer(`p${index}`, index),
      state: 'WAITING',
      checkedInAt: now
    })),
    games: [],
    tieBreakCursor: 0,
    nextTieBreakOrder: 17,
    createdAt: now,
    updatedAt: now
  };
}
