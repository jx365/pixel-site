import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, clearAuthState, getToken } from "../api";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setOk(false);
      return;
    }
    api
      .me()
      .then(() => setOk(true))
      .catch(() => {
        clearAuthState();
        setOk(false);
      });
  }, []);

  if (ok === null) return <div className="layout">加载中…</div>;
  if (!ok) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
