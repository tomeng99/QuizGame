// Re-export domain types from the room store module so that the rest of the
// server code can keep importing them from "./types" without coupling to the
// store implementation.
export type { StoredPlayer, StoredRoom } from "./roomStore";
