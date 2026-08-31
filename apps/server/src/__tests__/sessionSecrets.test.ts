import { describe, expect, it } from "vitest";
import { toPlayers, toSnapshot } from "../index";
import { makePlayer, makeRoom } from "./helpers";

/**
 * Regression guard for session-hijacking via broadcast snapshots.
 *
 * `RoomSnapshot` is broadcast to every socket in the room ("room:update",
 * "leaderboard:update", "game:finished", "room:joined", "room:rejoined"). Player
 * reconnect tokens used to be the same value as the public player id, which meant
 * every player received every other player's credential and could replay it on
 * "player:reconnect" to take over that session. These tests fail if any secret
 * finds its way back into a broadcast payload.
 */
describe("snapshots never carry session credentials", () => {
  const room = makeRoom({
    hostId: "host-public-id",
    hostToken: "host-secret-token",
    players: [
      makePlayer({ id: "p1", reconnectToken: "p1-secret-token", name: "Alice", score: 300 }),
      makePlayer({ id: "p2", reconnectToken: "p2-secret-token", name: "Bob", score: 100 }),
    ],
  });

  it("omits player reconnect tokens from the room snapshot", () => {
    const serialized = JSON.stringify(toSnapshot(room));

    expect(serialized).not.toContain("p1-secret-token");
    expect(serialized).not.toContain("p2-secret-token");
  });

  it("omits the host token from the room snapshot", () => {
    expect(JSON.stringify(toSnapshot(room))).not.toContain("host-secret-token");
  });

  it("still exposes the public player ids the client renders with", () => {
    const snapshot = toSnapshot(room);

    expect(snapshot.leaderboard.map((entry) => entry.playerId).sort()).toEqual(["p1", "p2"]);
    expect(
      toPlayers(room)
        .map((player) => player.id)
        .sort(),
    ).toEqual(["p1", "p2"]);
  });

  it("keeps the public id and the reconnect token distinct", () => {
    for (const player of room.players.values()) {
      expect(player.reconnectToken).not.toBe(player.id);
    }

    expect(room.hostToken).not.toBe(room.hostId);
  });
});
