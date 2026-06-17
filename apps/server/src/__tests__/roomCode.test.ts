import { describe, expect, it } from "vitest";
import { createRoomCode, randomCode } from "../index";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ALPHABET_SET = new Set(ALPHABET.split(""));

describe("randomCode", () => {
  it("returns a 6-character string", () => {
    expect(randomCode()).toHaveLength(6);
  });

  it("only uses characters from the defined alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = randomCode();
      for (const char of code) {
        expect(ALPHABET_SET.has(char)).toBe(true);
      }
    }
  });

  it("produces varying codes (not a constant)", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      codes.add(randomCode());
    }
    // With a 32^6 space, 100 draws should almost certainly produce >1 distinct code.
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("createRoomCode", () => {
  it("returns a 6-character code from the alphabet", () => {
    const code = createRoomCode();
    expect(code).toHaveLength(6);
    for (const char of code) {
      expect(ALPHABET_SET.has(char)).toBe(true);
    }
  });

  it("returns unique codes across many calls", () => {
    const codes = new Set<string>();
    const count = 500;
    for (let i = 0; i < count; i += 1) {
      codes.add(createRoomCode());
    }
    // 32^6 ≈ 10^9 space; 500 draws colliding is astronomically unlikely.
    expect(codes.size).toBe(count);
  });
});
