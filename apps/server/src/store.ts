import type { RoomStore } from "./roomStore";
import { InMemoryRoomStore } from "./roomStore";
import type { TokenStore } from "./tokenStore";
import { InMemoryTokenStore } from "./tokenStore";

// ── Shared mutable state ───────────────────────────────────────────────────────

/**
 * Active rooms, abstracted behind the RoomStore interface for future Redis
 * support.
 */
export const roomStore: RoomStore = new InMemoryRoomStore();

/**
 * Reconnect tokens, abstracted behind the TokenStore interface for future Redis
 * support.
 */
export const tokenStore: TokenStore = new InMemoryTokenStore();
