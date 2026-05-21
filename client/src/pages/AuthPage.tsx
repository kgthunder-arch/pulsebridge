import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

import { useAuth } from "../context/AuthContext";

export const AuthPage = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register({
          email,
          username,
          password,
          preferredLanguage
        });
      }
    } catch (submissionError) {
      const raw = submissionError instanceof Error ? submissionError.message : "Unable to continue.";
      // Map common server messages to friendlier ones
      const friendly = raw.toLowerCase().includes("invalid") || raw.toLowerCase().includes("incorrect") || raw.toLowerCase().includes("unauthorized") || raw.toLowerCase().includes("401")
        ? "Incorrect email/username or password. Please try again."
        : raw;
      setError(friendly);
      // Clear password on failed login attempt and shake
      if (mode === "login") {
        setPassword("");
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-poster">
        <motion.div
          className="auth-poster-copy"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <span className="eyebrow">PulseBridge</span>
          <h1>Encrypted conversations that feel alive across the planet.</h1>
          <p>
            Real-time messaging, instant voice and video calls, live translation, smart replies,
            and mood-reactive themes in one global communication layer.
          </p>
          <div className="feature-line">
            <span>WebSocket messaging</span>
            <span>WebRTC calls</span>
            <span>RSA + AES-GCM E2EE</span>
          </div>
        </motion.div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-tabs">
            <button
              className={mode === "register" ? "active" : ""}
              type="button"
              onClick={() => setMode("register")}
            >
              Create account
            </button>
            <button
              className={mode === "login" ? "active" : ""}
              type="button"
              onClick={() => setMode("login")}
            >
              Sign in
            </button>
          </div>

          <form className={`auth-form ${shake ? "shake" : ""}`} onSubmit={handleSubmit}>
            <label>
              <span>{mode === "login" ? "Email or username" : "Email"}</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={mode === "login" ? "you@example.com or username" : "you@example.com"}
                required
              />
            </label>

            {mode === "register" ? (
              <label>
                <span>Username</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="nova"
                  required
                />
              </label>
            ) : null}

            <label>
              <span>Password</span>
              <div className={`unlock-input-wrap ${error && mode === "login" ? "has-error" : ""}`}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); if (error) setError(""); }}
                  placeholder="••••••••"
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  className="unlock-eye-btn"
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            {mode === "register" ? (
              <label>
                <span>Preferred language</span>
                <select
                  value={preferredLanguage}
                  onChange={(event) => setPreferredLanguage(event.target.value)}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                </select>
              </label>
            ) : null}

            {error ? (
              <div className="unlock-error-row">
                <span className="unlock-error-icon">✕</span>
                <span className="unlock-error-msg">{error}</span>
              </div>
            ) : null}

            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting
                ? (mode === "login" ? "Signing in…" : "Creating account…")
                : (mode === "login" ? "Unlock workspace" : "Create encrypted profile")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};
