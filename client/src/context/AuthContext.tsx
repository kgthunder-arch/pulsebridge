import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import { apiRequest } from "../lib/api";
import { generateEncryptedIdentity, unlockPrivateKey } from "../lib/crypto";
import {
  clearSession,
  readSession,
  saveSession,
  saveRefreshToken,
  readRefreshToken
} from "../lib/storage";
import type { AuthUser } from "../lib/types";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  privateKey: CryptoKey | null;
  loading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    username: string;
    password: string;
    preferredLanguage: string;
  }) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  updateCurrentUser: (nextUser: AuthUser) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthResponse = {
  token: string;
  refreshToken?: string;
  user: AuthUser;
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const session = readSession();
  const [token, setToken] = useState<string | null>(session.token);
  const [user, setUser] = useState<AuthUser | null>(session.user);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      if (!session.token) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest<{ user: AuthUser }>("/api/auth/me", {
          method: "GET",
          token: session.token
        });

        setUser(data.user);
        saveSession(session.token, data.user);
      } catch (error) {
        // Try to silently refresh using the stored refresh token
        const storedRefreshToken = readRefreshToken();
        if (storedRefreshToken) {
          try {
            const refreshed = await apiRequest<AuthResponse>("/api/auth/refresh", {
              method: "POST",
              body: JSON.stringify({ refreshToken: storedRefreshToken })
            });
            saveSession(refreshed.token, refreshed.user);
            if (refreshed.refreshToken) {
              saveRefreshToken(refreshed.refreshToken);
            }
            setToken(refreshed.token);
            setUser(refreshed.user);
          } catch {
            clearSession();
            setToken(null);
            setUser(null);
          }
        } else {
          clearSession();
          setToken(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [session.token]);

  const login = async (emailOrUsername: string, password: string) => {
    const data = await apiRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ emailOrUsername, password })
    });

    const key = await unlockPrivateKey(
      data.user.encryptedPrivateKey,
      data.user.privateKeySalt,
      data.user.privateKeyIv,
      password
    );

    saveSession(data.token, data.user);
    if (data.refreshToken) {
      saveRefreshToken(data.refreshToken);
    }
    setToken(data.token);
    setUser(data.user);
    setPrivateKey(key);
  };

  const register = async (input: {
    email: string;
    username: string;
    password: string;
    preferredLanguage: string;
  }) => {
    const identity = await generateEncryptedIdentity(input.password);

    const data = await apiRequest<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        username: input.username,
        password: input.password,
        preferredLanguage: input.preferredLanguage,
        publicKey: identity.publicKey,
        encryptedPrivateKey: identity.encryptedPrivateKey,
        privateKeySalt: identity.privateKeySalt,
        privateKeyIv: identity.privateKeyIv
      })
    });

    saveSession(data.token, data.user);
    if (data.refreshToken) {
      saveRefreshToken(data.refreshToken);
    }
    setToken(data.token);
    setUser(data.user);
    setPrivateKey(identity.privateKey);
  };

  const unlock = async (password: string) => {
    if (!user) {
      return;
    }

    const key = await unlockPrivateKey(
      user.encryptedPrivateKey,
      user.privateKeySalt,
      user.privateKeyIv,
      password
    );
    setPrivateKey(key);
  };

  const logout = async () => {
    try {
      if (token) {
        await apiRequest("/api/auth/logout", { method: "POST", token });
      }
    } catch {
      // Best-effort: always clear locally
    }
    clearSession();
    setToken(null);
    setUser(null);
    setPrivateKey(null);
  };

  const updateCurrentUser = (nextUser: AuthUser) => {
    if (!token) {
      return;
    }

    saveSession(token, nextUser);
    setUser(nextUser);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      privateKey,
      loading,
      login,
      register,
      unlock,
      updateCurrentUser,
      logout
    }),
    [loading, privateKey, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
