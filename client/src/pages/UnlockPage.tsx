import { useRef, useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

import { useAuth } from "../context/AuthContext";

export const UnlockPage = () => {
  const { user, unlock, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleUnlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await unlock(password);
    } catch (unlockError) {
      const message =
        unlockError instanceof Error
          ? unlockError.message
          : "Unable to unlock. Please try again.";
      setError(message);
      setAttempts((prev) => prev + 1);
      setPassword("");
      triggerShake();
      // Re-focus the input after clearing
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setSubmitting(false);
    }
  };

  const isWrongPassword = error.toLowerCase().includes("incorrect");

  return (
    <main className="unlock-shell">
      <form
        className={`unlock-card ${shake ? "shake" : ""}`}
        onSubmit={handleUnlock}
      >
        {/* Lock icon */}
        <div className={`unlock-icon-wrap ${isWrongPassword ? "error" : ""}`}>
          <Lock size={28} />
        </div>

        <div className="unlock-header">
          <span className="eyebrow">Session locked</span>
          <h2>Welcome back, {user?.username}</h2>
          <p>Enter your password to decrypt your private key and resume your session.</p>
        </div>

        {/* Password input */}
        <div className={`unlock-input-wrap ${error ? "has-error" : ""}`}>
          <input
            ref={inputRef}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError("");
            }}
            placeholder="Enter your password"
            required
            autoFocus
            autoComplete="current-password"
          />
          <button
            type="button"
            className="unlock-eye-btn"
            onClick={() => setShowPassword((p) => !p)}
            tabIndex={-1}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Error message */}
        {error ? (
          <div className="unlock-error-row">
            <span className="unlock-error-icon">✕</span>
            <span className="unlock-error-msg">{error}</span>
            {attempts >= 3 ? (
              <span className="unlock-hint">
                Forgotten your password? You'll need to sign out and register again.
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Attempt counter */}
        {attempts > 0 && !error ? null : attempts >= 2 ? (
          <p className="unlock-attempts">{attempts} failed attempt{attempts !== 1 ? "s" : ""}</p>
        ) : null}

        <button
          className="primary-button"
          type="submit"
          disabled={submitting || !password}
        >
          {submitting ? (
            <>
              <span className="btn-spinner" />
              Unlocking…
            </>
          ) : (
            "Unlock workspace"
          )}
        </button>

        <button className="ghost-button" type="button" onClick={logout}>
          Sign out instead
        </button>
      </form>
    </main>
  );
};
