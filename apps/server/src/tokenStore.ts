// ── Token value type ───────────────────────────────────────────────────────────

export interface TokenEntry {
  roomCode: string;
  role: "host" | "player";
}

// ── TokenStore interface ───────────────────────────────────────────────────────

/**
 * Abstraction over reconnect-token persistence. The in-memory implementation
 * mirrors the previous bare
 * `Map<string, { roomCode: string; role: "host" | "player" }>`. A Redis-backed
 * implementation can be dropped in later alongside a Redis-backed RoomStore.
 */
export interface TokenStore {
  /** Returns the entry for `token`, or `undefined` if no such token exists. */
  getToken(token: string): TokenEntry | undefined;
  /** Inserts or replaces the entry stored under `token`. */
  setToken(token: string, value: TokenEntry): void;
  /** Removes the entry stored under `token`. No-op if it does not exist. */
  deleteToken(token: string): void;
}

// ── In-memory implementation ──────────────────────────────────────────────────

/**
 * Backed by a plain `Map`. This is functionally identical to the previous
 * module-level `const tokenStore = new Map<string, TokenEntry>()`.
 */
export class InMemoryTokenStore implements TokenStore {
  private readonly tokens = new Map<string, TokenEntry>();

  getToken(token: string): TokenEntry | undefined {
    return this.tokens.get(token);
  }

  setToken(token: string, value: TokenEntry): void {
    this.tokens.set(token, value);
  }

  deleteToken(token: string): void {
    this.tokens.delete(token);
  }
}
