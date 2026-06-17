import type { StoredRoom } from "./types";

// ── Shared mutable state ───────────────────────────────────────────────────────

/** Active rooms keyed by room code. */
export const rooms = new Map<string, StoredRoom>();

/** Maps a stable token (player/host UUID) to its room and role, enabling reconnects. */
export const tokenStore = new Map<string, { roomCode: string; role: "host" | "player" }>();
