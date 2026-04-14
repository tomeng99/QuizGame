import Constants from "expo-constants";
import { Platform } from "react-native";

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

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
