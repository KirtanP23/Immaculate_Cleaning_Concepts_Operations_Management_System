import { useState } from "react";

export default function LoginPanel({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(form);
    } catch (loginError) {
      setError(loginError.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel auth-panel">
      <p className="eyebrow">Staff access</p>
      <h3>Welcome back</h3>
      <p className="muted">Use your staff credentials to access role-based pages and daily tools.</p>

      <form className="auth-form" onSubmit={submit}>
        <label className="field-group">
          <span>Username</span>
          <input
            placeholder="Enter your username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </label>
        <label className="field-group">
          <span>Password</span>
          <input
            type="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </form>

      <div className="auth-footnote">
        <span>Secure session-based access</span>
        <span>Role visibility is preserved</span>
      </div>

      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
