import { useRef } from "react";

export type SessionRole = "host" | "player";

export interface StoredSession {
  token: string;
  role: SessionRole;
}

export interface UseSessionStorage {
  /**
   * Stable reconnect token (player/host UUID). Survives socket drops but not
   * page refreshes — `loadSession` repopulates this from sessionStorage on
   * reconnect after a refresh.
   */
  tokenRef: React.RefObject<string | null>;
  saveSession: (token: string, roomCode: string, role: SessionRole) => void;
  clearSession: () => void;
  loadSession: () => StoredSession | null;
}

/**
 * Encapsulates the web-only, best-effort sessionStorage helpers that let the
 * client survive a page refresh while a game is active.
 *
 * Also owns `tokenRef` — the in-memory reconnect token — so callers (notably
 * the socket connect handler) can read/write it without re-implementing the
 * storage plumbing.
 */
export function useSessionStorage(): UseSessionStorage {
  const tokenRef = useRef<string | null>(null);

  const saveSession = (token: string, roomCode: string, role: SessionRole) => {
    tokenRef.current = token;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("quizgame:token", token);
        sessionStorage.setItem("quizgame:roomCode", roomCode);
        sessionStorage.setItem("quizgame:role", role);
      }
    } catch {}
  };

  const clearSession = () => {
    tokenRef.current = null;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("quizgame:token");
        sessionStorage.removeItem("quizgame:roomCode");
        sessionStorage.removeItem("quizgame:role");
      }
    } catch {}
  };

  const loadSession = (): StoredSession | null => {
    try {
      if (typeof sessionStorage !== "undefined") {
        const token = sessionStorage.getItem("quizgame:token");
        const role = sessionStorage.getItem("quizgame:role");
        if (token && (role === "host" || role === "player")) {
          return { token, role };
        }
      }
    } catch {}
    return null;
  };

  return { tokenRef, saveSession, clearSession, loadSession };
}
