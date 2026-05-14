import { useState } from "react";

import { useAuth } from "../context/AuthContext";

export const UnlockPage = () => {
  const { user, unlock, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleUnlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await unlock(password);
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Unable to unlock private key.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="unlock-shell">
      <form className="unlock-card" onSubmit={handleUnlock}>
        <span className="eyebrow">Session locked</span>
        <h2>Welcome back, {user?.username}</h2>
        <p>Your private key stays encrypted until you unlock it on this device.</p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter password to decrypt your key"
          required
        />
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Unlocking..." : "Unlock"}
        </button>
        <button className="ghost-button" type="button" onClick={logout}>
          Sign out
        </button>
      </form>
    </main>
  );
};

