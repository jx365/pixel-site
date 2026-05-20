import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, RenderResult } from "../api";

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<RenderResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api
      .getResult(Number(id))
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const downloadExcel = async () => {
    if (!id) return;
    setExporting(true);
    setError("");
    try {
      const res = await api.exportExcel(Number(id));
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "导出失败");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pixel_art_${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <p>加载中…</p>;
  if (!result) return <p className="error">{error || "未找到结果"}</p>;

  return (
    <div>
      <h1 className="page-title">生成结果 #{result.id}</h1>
      <p className="page-subtitle">确认视觉效果后，可一键下载色号格子 + 色卡对照表 Excel。</p>
      {error && <p className="error">{error}</p>}
      <div className="card">
        {result.preview_url && (
          <img
            src={result.preview_url}
            alt="像素画"
            style={{ maxWidth: "100%", imageRendering: "pixelated" }}
          />
        )}
        <p style={{ marginTop: "1rem", color: "var(--muted)" }}>
          尺寸：{result.canvas_w} × {result.canvas_h}
        </p>
        <pre
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            background: "var(--surface2)",
            borderRadius: 8,
            fontSize: "0.8rem",
            overflow: "auto",
          }}
        >
          {JSON.stringify(result.params, null, 2)}
        </pre>
        <div className="actions">
          <button type="button" onClick={downloadExcel} disabled={exporting}>
            {exporting ? "导出中…" : "下载 Excel（色号格子 + 色卡对照表）"}
          </button>
        </div>
      </div>
    </div>
  );
}
