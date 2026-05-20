import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, enterGuestMode } from "../api";

export default function LoginPage() {
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
      await api.login(username, password);
      navigate("/create");
    } catch {
      setError("用户名或密码错误");
    } finally {
      setLoading(false);
    }
  };

  const enterGuest = () => {
    enterGuestMode();
    navigate("/create");
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="page-title">开始使用</h1>
        <p className="page-subtitle">你可以先游客体验，微博登录入口先做前端占位展示。</p>

        <div className="actions" style={{ marginTop: 0 }}>
          <button type="button" onClick={enterGuest} style={{ width: "100%" }}>
            游客进入
          </button>
          <button
            type="button"
            className="secondary"
            style={{ width: "100%" }}
            onClick={() => setError("微博登录功能正在接入中，当前先使用游客模式")}
          >
            微博账号登录（即将上线）
          </button>
        </div>

        <hr style={{ margin: "1rem 0", borderColor: "var(--border)" }} />
        <p style={{ color: "var(--muted)", marginBottom: "0.5rem", fontSize: "0.9rem" }}>账号登录（可选）</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>用户名</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading} style={{ width: "100%", marginTop: "0.5rem" }}>
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", color: "var(--muted)", fontSize: "0.9rem" }}>
          没有账号？<Link to="/register">注册</Link>
        </p>
      </div>
    </div>
  );
}
