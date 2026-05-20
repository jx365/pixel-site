import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { api, clearAuthState, isGuestMode, User } from "../api";

export default function Layout() {
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState<boolean>(isGuestMode());
  const navigate = useNavigate();

  useEffect(() => {
    if (isGuestMode()) {
      setGuest(true);
      setUser(null);
      return;
    }
    api
      .me()
      .then((u) => {
        setGuest(false);
        setUser(u);
      })
      .catch(() => {});
  }, []);

  const logout = () => {
    clearAuthState();
    navigate("/login");
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
        </div>
        <span className="nav-user">{guest ? "游客模式" : user?.username ? `Hi, ${user.username}` : ""}</span>
        <button type="button" className="secondary" onClick={logout}>
          {guest ? "退出游客" : "退出"}
        </button>
      </nav>
      <main className="layout">
        <Outlet />
      </main>
    </>
  );
}
