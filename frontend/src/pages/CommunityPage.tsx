import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Announcement, api, LeaderboardItem, Work } from "../api";

export default function CommunityPage() {
  const [works, setWorks] = useState<Work[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [workList, ranking, notices] = await Promise.all([
        api.listWorks(),
        api.getLikeLeaderboard(),
        api.listAnnouncements(),
      ]);
      setWorks(workList);
      setLeaderboard(ranking);
      setAnnouncements(notices);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载社区失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div>
      <h1 className="page-title">社区广场</h1>
      <p className="page-subtitle">浏览其他用户发布的像素画，支持点赞和评论互动。</p>
      {error && <p className="error">{error}</p>}
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          {loading ? (
            <p>加载中…</p>
          ) : works.length === 0 ? (
            <div className="card">暂无作品，去结果页发布第一幅作品吧。</div>
          ) : (
            works.map((w) => (
              <div key={w.id} className="card" style={{ marginBottom: "0.75rem" }}>
                <h3 style={{ marginTop: 0 }}>{w.title}</h3>
                <p style={{ color: "var(--muted)" }}>作者：{w.author_name}</p>
                {w.image_url && (
                  <img
                    src={w.image_url}
                    alt={w.title}
                    style={{ maxWidth: "100%", imageRendering: "pixelated", borderRadius: 8 }}
                  />
                )}
                {w.description && <p style={{ marginTop: "0.75rem" }}>{w.description}</p>}
                <div className="actions">
                  <span style={{ color: "var(--muted)" }}>👍 {w.like_count} · 💬 {w.comment_count}</span>
                  <Link to={`/community/${w.id}`}>查看详情</Link>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>社区公告</h3>
          {announcements.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>暂无公告</p>
          ) : (
            announcements.slice(0, 3).map((a) => (
              <div key={a.id} style={{ marginBottom: "0.6rem" }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{a.title}</p>
                <p style={{ margin: "0.2rem 0", color: "var(--muted)" }}>{a.content}</p>
              </div>
            ))
          )}
          <hr style={{ borderColor: "var(--border)", margin: "0.8rem 0" }} />
          <h3 style={{ marginTop: 0 }}>点赞排行榜</h3>
          {leaderboard.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>暂无数据</p>
          ) : (
            leaderboard.map((item, idx) => (
              <p key={`${item.user_id}-${idx}`} style={{ marginBottom: "0.5rem" }}>
                {idx + 1}. {item.display_name}（{item.likes} 赞）
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
