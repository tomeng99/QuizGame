// ── Constants ──────────────────────────────────────────────────────────────────

export const MAX_PLAYERS_PER_ROOM = 100;
export const MAX_QUESTIONS = 50;
export const MAX_PROMPT_LENGTH = 500;
export const MAX_OPTION_TEXT_LENGTH = 200;
export const MAX_NAME_LENGTH = 50;
export const HOST_RECONNECT_GRACE_MS = 60_000; // 60 s before closing a host-less room
export const ROOM_CLEANUP_DELAY_MS = 30 * 60_000; // 30 min after game finishes
