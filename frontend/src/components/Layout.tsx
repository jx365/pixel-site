import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { api, clearAuthState, User } from "../api";

export default function Layout() {
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .me()
      .then((u) => {
        setUser(u);
        setNickname(u.display_name || "");
      })
      .catch(() => navigate("/login", { replace: true }));
  }, []);

  const logout = () => {
    clearAuthState();
    navigate("/login");
  };

  const saveNickname = async () => {
    if (!nickname.trim()) return;
    setSaving(true);
    setError("");
    try {
      const u = await api.updateProfile(nickname.trim());
      setUser(u);
      setNickname(u.display_name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "昵称保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <nav className="nav">
        <Link to="/create" className="nav-brand">
          Huashi Pixel Studio
        </Link>
        <div className="nav-links">
          <Link to="/create">生成</Link>
          <Link to="/palettes">色盘</Link>
          <Link to="/community">社区</Link>
          <Link to="/messages">消息</Link>
          {user?.role === "admin" && <Link to="/admin">管理</Link>}
        </div>
        <span className="nav-user">{user ? `Hi, ${user.display_name}${user.role === "admin" ? "（管理员）" : ""}` : ""}</span>
        <button type="button" className="secondary" onClick={logout}>
          退出
        </button>
      </nav>
      {user && (
        <div className="layout" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="card" style={{ marginTop: "0.75rem", marginBottom: "0.75rem" }}>
            <div className="grid-2" style={{ alignItems: "end" }}>
              <div className="form-group">
                <label>临时昵称</label>
                <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={64} />
              </div>
              <div className="actions" style={{ marginTop: 0 }}>
                <button type="button" className="secondary" onClick={saveNickname} disabled={saving}>
                  {saving ? "保存中…" : "保存昵称"}
                </button>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}
      <main className="layout">
        <Outlet />
      </main>
    </>
  );
}
