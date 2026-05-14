const resolveApiBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const { protocol, hostname, port } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    if (!port || port === "4000") {
      return "";
    }

    return `${protocol}//${hostname}:4000`;
  }

  if (protocol === "file:") {
    return "http://localhost:4000";
  }

  return "";
};

type RequestOptions = RequestInit & {
  token?: string | null;
};

export const apiBaseUrl = resolveApiBaseUrl();

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const baseUrl = resolveApiBaseUrl();

  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    throw new Error(
      "PulseBridge cannot reach the server. Start the app with launch.cmd and open http://localhost:4000."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
};
