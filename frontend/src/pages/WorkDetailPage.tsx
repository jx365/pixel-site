import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, Work, WorkComment } from "../api";

export default function WorkDetailPage() {
  const { workId } = useParams<{ workId: string }>();
  const [work, setWork] = useState<Work | null>(null);
  const [comments, setComments] = useState<WorkComment[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const id = Number(workId);

  const refresh = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [w, cs] = await Promise.all([api.getWork(id), api.listWorkComments(id)]);
      setWork(w);
      setComments(cs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [id]);

  const toggleLike = async () => {
    if (!work) return;
    try {
      const data = work.is_liked ? await api.unlikeWork(work.id) : await api.likeWork(work.id);
      setWork({ ...work, is_liked: data.liked, like_count: data.like_count });
    } catch (e) {
      setError(e instanceof Error ? e.message : "点赞失败");
    }
  };

  const submitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !work) return;
    setSubmitting(true);
    setError("");
    try {
      await api.addWorkComment(work.id, content.trim());
      setContent("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "评论失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p>加载中…</p>;
  if (!work) return <p className="error">{error || "作品不存在"}</p>;

  return (
    <div>
      <h1 className="page-title">{work.title}</h1>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <p style={{ color: "var(--muted)" }}>作者：{work.author_name}</p>
        {work.image_url && (
          <img src={work.image_url} alt={work.title} style={{ maxWidth: "100%", imageRendering: "pixelated" }} />
        )}
        {work.description && <p style={{ marginTop: "0.75rem" }}>{work.description}</p>}
        <div className="actions">
          <button type="button" className="secondary" onClick={toggleLike}>
            {work.is_liked ? "取消点赞" : "点赞"}（{work.like_count}）
          </button>
        </div>
      </div>
      <div className="card" style={{ marginTop: "0.75rem" }}>
        <h3 style={{ marginTop: 0 }}>评论（{comments.length}）</h3>
        <form onSubmit={submitComment}>
          <div className="form-group">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              style={{ width: "100%", resize: "vertical" }}
              placeholder="说点什么..."
            />
          </div>
          <div className="actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "提交中…" : "发布评论"}
            </button>
          </div>
        </form>
        {comments.map((c) => (
          <div key={c.id} style={{ borderTop: "1px solid var(--border)", paddingTop: "0.6rem", marginTop: "0.6rem" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{c.author_name}</p>
            <p style={{ margin: "0.3rem 0 0 0" }}>{c.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
