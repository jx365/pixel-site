import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const enterGuest = async () => {
    setError("");
    setLoading(true);
    try {
      await api.startGuestSession();
      navigate("/create");
    } catch (e) {
      setError(e instanceof Error ? e.message : "游客登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="page-title">开始使用</h1>
        <p className="page-subtitle">当前仅开放游客模式与微博登录占位入口。</p>

        <div className="actions" style={{ marginTop: 0 }}>
          <button type="button" onClick={enterGuest} style={{ width: "100%" }} disabled={loading}>
            {loading ? "进入中…" : "游客进入"}
          </button>
          <button
            type="button"
            className="secondary"
            style={{ width: "100%" }}
            onClick={() => setError("微博登录功能暂为占位，当前请使用游客模式")}
          >
            微博账号登录（即将上线）
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
