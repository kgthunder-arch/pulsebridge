import { io, type Socket } from "socket.io-client";

const resolveSocketBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window === "undefined") {
    return undefined;
  }

  const { protocol, hostname, port } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    if (!port || port === "4000") {
      return undefined;
    }

    return `${protocol}//${hostname}:4000`;
  }

  if (protocol === "file:") {
    return "http://localhost:4000";
  }

  return undefined;
};

export const createRealtimeSocket = (token: string): Socket =>
  io(resolveSocketBaseUrl(), {
    auth: { token },
    transports: ["websocket"]
  });
