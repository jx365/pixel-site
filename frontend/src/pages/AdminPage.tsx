import { FormEvent, useEffect, useState } from "react";
import { api, ModerationLogItem } from "../api";

export default function AdminPage() {
  const [inviteCode, setInviteCode] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [workId, setWorkId] = useState("");
  const [commentId, setCommentId] = useState("");
  const [reason, setReason] = useState("");
  const [logs, setLogs] = useState<ModerationLogItem[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const clearResult = () => {
    setMsg("");
    setError("");
  };

  const refreshLogs = async () => {
    try {
      const data = await api.listModerationLogs();
      setLogs(data);
    } catch {
      // ignore log fetch failures for non-admin user
    }
  };

  useEffect(() => {
    refreshLogs();
  }, []);

  const submitUpgrade = async (e: FormEvent) => {
    e.preventDefault();
    clearResult();
    try {
      await api.upgradeAdmin(inviteCode.trim());
      setMsg("升级管理员成功，请刷新页面。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "升级失败");
    }
  };

  const createInvite = async () => {
    clearResult();
    try {
      const data = await api.createAdminInviteCode();
      setMsg(`新邀请码：${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建邀请码失败");
    }
  };

  const publishAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    clearResult();
    try {
      await api.createAnnouncement(title.trim(), content.trim());
      setMsg("公告发布成功。");
      setTitle("");
      setContent("");
      refreshLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "公告发布失败");
    }
  };

  const removeWork = async () => {
    clearResult();
    if (!workId || !reason.trim()) return;
    try {
      await api.removeWork(Number(workId), reason.trim());
      setMsg("作品已下架。");
      refreshLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "下架作品失败");
    }
  };

  const removeComment = async () => {
    clearResult();
    if (!commentId || !reason.trim()) return;
    try {
      await api.removeComment(Number(commentId), reason.trim());
      setMsg("评论已下架。");
      refreshLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "下架评论失败");
    }
  };

  return (
    <div>
      <h1 className="page-title">管理员中心</h1>
      <p className="page-subtitle">邀请码升级、社区公告和违规内容治理入口。</p>
      {msg && <p style={{ color: "#22c55e" }}>{msg}</p>}
      {error && <p className="error">{error}</p>}

      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <h3 style={{ marginTop: 0 }}>管理员升级（普通账号/游客输入邀请码）</h3>
        <form onSubmit={submitUpgrade}>
          <div className="form-group">
            <label>邀请码</label>
            <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
          </div>
          <div className="actions">
            <button type="submit">提交升级</button>
            <button type="button" className="secondary" onClick={createInvite}>
              生成新邀请码
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <h3 style={{ marginTop: 0 }}>发布社区公告</h3>
        <form onSubmit={publishAnnouncement}>
          <div className="form-group">
            <label>标题</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>内容</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} required />
          </div>
          <div className="actions">
            <button type="submit">发布公告</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>下架处理（需填写违规理由）</h3>
        <div className="form-group">
          <label>违规理由</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>作品ID</label>
            <input value={workId} onChange={(e) => setWorkId(e.target.value)} />
            <div className="actions">
              <button type="button" className="secondary" onClick={removeWork}>
                下架作品
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>评论ID</label>
            <input value={commentId} onChange={(e) => setCommentId(e.target.value)} />
            <div className="actions">
              <button type="button" className="secondary" onClick={removeComment}>
                下架评论
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: "0.75rem" }}>
        <h3 style={{ marginTop: 0 }}>处理存档</h3>
        <div className="actions">
          <button type="button" className="secondary" onClick={refreshLogs}>
            刷新日志
          </button>
        </div>
        {logs.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>暂无处理记录</p>
        ) : (
          logs.map((l) => (
            <div key={l.id} style={{ borderTop: "1px solid var(--border)", paddingTop: "0.6rem", marginTop: "0.6rem" }}>
              <p style={{ margin: 0 }}>
                {l.target_type}#{l.target_id} / user#{l.target_user_id}
              </p>
              <p style={{ margin: "0.25rem 0", color: "var(--muted)" }}>{l.reason}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
