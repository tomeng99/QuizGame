import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "../index";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to maxCount requests within the window", () => {
    const socket = "socket-1";
    expect(checkRateLimit(socket, "event-a", 3, 10_000)).toBe(true);
    expect(checkRateLimit(socket, "event-a", 3, 10_000)).toBe(true);
    expect(checkRateLimit(socket, "event-a", 3, 10_000)).toBe(true);
  });

  it("blocks requests after maxCount is reached", () => {
    const socket = "socket-2";
    checkRateLimit(socket, "event-b", 2, 10_000);
    checkRateLimit(socket, "event-b", 2, 10_000);
    expect(checkRateLimit(socket, "event-b", 2, 10_000)).toBe(false);
    expect(checkRateLimit(socket, "event-b", 2, 10_000)).toBe(false);
  });

  it("resets the window after windowMs has elapsed", () => {
    const socket = "socket-3";
    const event = "event-c";
    const windowMs = 10_000;

    // Exhaust the limit.
    expect(checkRateLimit(socket, event, 2, windowMs)).toBe(true);
    expect(checkRateLimit(socket, event, 2, windowMs)).toBe(true);
    expect(checkRateLimit(socket, event, 2, windowMs)).toBe(false);

    // Advance just past the window — limit should reset.
    vi.advanceTimersByTime(windowMs + 1);
    expect(checkRateLimit(socket, event, 2, windowMs)).toBe(true);
    expect(checkRateLimit(socket, event, 2, windowMs)).toBe(true);
    expect(checkRateLimit(socket, event, 2, windowMs)).toBe(false);
  });

  it("still blocks before the window fully elapses", () => {
    const socket = "socket-4";
    const event = "event-d";
    const windowMs = 10_000;

    expect(checkRateLimit(socket, event, 1, windowMs)).toBe(true);
    expect(checkRateLimit(socket, event, 1, windowMs)).toBe(false);

    // Advance less than the window — should still be blocked.
    vi.advanceTimersByTime(windowMs - 1);
    expect(checkRateLimit(socket, event, 1, windowMs)).toBe(false);
  });

  it("tracks different events separately for the same socket", () => {
    const socket = "socket-5";
    // Exhaust event-x.
    expect(checkRateLimit(socket, "event-x", 1, 10_000)).toBe(true);
    expect(checkRateLimit(socket, "event-x", 1, 10_000)).toBe(false);
    // event-y is independent and still allowed.
    expect(checkRateLimit(socket, "event-y", 1, 10_000)).toBe(true);
    expect(checkRateLimit(socket, "event-y", 1, 10_000)).toBe(false);
  });

  it("tracks different sockets separately for the same event", () => {
    // Exhaust the limit for socket-a.
    expect(checkRateLimit("socket-a", "event-z", 1, 10_000)).toBe(true);
    expect(checkRateLimit("socket-a", "event-z", 1, 10_000)).toBe(false);
    // socket-b is independent and still allowed.
    expect(checkRateLimit("socket-b", "event-z", 1, 10_000)).toBe(true);
    expect(checkRateLimit("socket-b", "event-z", 1, 10_000)).toBe(false);
  });

  it("treats maxCount of 1 as allow-once-then-block", () => {
    const socket = "socket-6";
    expect(checkRateLimit(socket, "once", 1, 10_000)).toBe(true);
    expect(checkRateLimit(socket, "once", 1, 10_000)).toBe(false);
  });
});
