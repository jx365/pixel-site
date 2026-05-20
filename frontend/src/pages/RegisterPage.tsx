import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.register({ username, password });
      await api.login(username, password);
      navigate("/palettes/new");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="page-title">注册</h1>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>用户名</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={2} />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading} style={{ width: "100%", marginTop: "0.5rem" }}>
            {loading ? "注册中…" : "注册"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", color: "var(--muted)", fontSize: "0.9rem" }}>
          已有账号？<Link to="/login">登录</Link>
        </p>
      </div>
    </div>
  );
}
