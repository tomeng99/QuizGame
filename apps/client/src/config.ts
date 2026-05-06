import Constants from "expo-constants";
import { Platform } from "react-native";

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");
const normalizeRoomCode = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_QUERY_PARAM = "roomCode";

export const getApiBase = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    const configured = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);

    if (configured) {
      return configured;
    }
  }

  const hostUri = Constants.expoConfig?.hostUri;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:3001`;
  }

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    const protocol = window.location.protocol === "https:" ? "https" : "http";
    const isExpoDevServer = window.location.port === "8081" || window.location.port === "19006";

    if (isExpoDevServer) {
      return `${protocol}://${window.location.hostname}:3001`;
    }

    return normalizeBaseUrl(window.location.origin);
  }

  return "http://localhost:3001";
};

export const API_BASE = getApiBase();

/**
 * True in local dev (Metro / Expo dev server) and on any deployed
 * environment whose hostname starts with "dev-" (e.g. dev-quiz.eng.software).
 * Used to gate dev-only UI like the sample-quiz helper buttons.
 */
export const IS_DEV_ENVIRONMENT: boolean = (() => {
  if (Constants.expoConfig?.hostUri) return true;

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    const { hostname, port } = window.location;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const isExpoDevServer = port === "8081" || port === "19006";
    const isDevHost = hostname.startsWith("dev-");
    return isLocalhost || isExpoDevServer || isDevHost;
  }

  return false;
})();

const getAppBase = (): string | null => {
  if (process.env.EXPO_PUBLIC_APP_URL) {
    const configured = normalizeBaseUrl(process.env.EXPO_PUBLIC_APP_URL);

    if (configured) {
      return configured;
    }
  }

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    return normalizeBaseUrl(`${window.location.origin}${window.location.pathname}`);
  }

  return null;
};

export const getJoinUrl = (roomCode: string): string | null => {
  const appBase = getAppBase();
  const normalizedRoomCode = normalizeRoomCode(roomCode).slice(0, ROOM_CODE_LENGTH);

  if (!appBase || normalizedRoomCode.length !== ROOM_CODE_LENGTH) {
    return null;
  }

  const joinUrl = new URL(appBase);
  joinUrl.searchParams.set(ROOM_CODE_QUERY_PARAM, normalizedRoomCode);

  return joinUrl.toString();
};

export const getRoomCodeFromUrl = (): string | null => {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return null;
  }

  const roomCode = new URLSearchParams(window.location.search).get(ROOM_CODE_QUERY_PARAM);

  if (!roomCode) {
    return null;
  }

  const normalizedRoomCode = normalizeRoomCode(roomCode).slice(0, ROOM_CODE_LENGTH);

  return normalizedRoomCode.length === ROOM_CODE_LENGTH ? normalizedRoomCode : null;
};

export const clearRoomCodeFromUrl = (): void => {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return;
  }

  const currentUrl = new URL(window.location.href);

  if (!currentUrl.searchParams.has(ROOM_CODE_QUERY_PARAM)) {
    return;
  }

  currentUrl.searchParams.delete(ROOM_CODE_QUERY_PARAM);
  const nextUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  window.history.replaceState({}, "", nextUrl);
};
