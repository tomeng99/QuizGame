import { randomInt } from "crypto";
import { roomStore } from "./store";

// ── Room code generation ───────────────────────────────────────────────────────

export const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[randomInt(alphabet.length)];
  }
  return code;
};

export const createRoomCode = () => {
  let code = randomCode();
  while (roomStore.hasRoom(code)) {
    code = randomCode();
  }
  return code;
};
