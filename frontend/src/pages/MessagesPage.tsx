import { useEffect, useState } from "react";
import { api, Notice } from "../api";

export default function MessagesPage() {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api.listNotices();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载消息失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const readAll = async () => {
    try {
      await api.readAllNotices();
      setItems([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "标记已读失败");
    }
  };

  return (
    <div>
      <h1 className="page-title">消息中心</h1>
      <p className="page-subtitle">点赞、评论和违规处理都会显示在这里，阅读后可一键清空。</p>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="secondary" onClick={readAll} disabled={items.length === 0}>
          全部标记已读并清空
        </button>
      </div>
      <div className="card">
        {loading ? (
          <p>加载中…</p>
        ) : items.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>暂无未读消息</p>
        ) : (
          items.map((n) => (
            <div key={n.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{n.title}</p>
              <p style={{ margin: "0.3rem 0", color: "var(--muted)" }}>{n.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
