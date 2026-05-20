import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Palette } from "../api";

export default function PalettesPage() {
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.listPalettes().then(setPalettes).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: number) => {
    if (!confirm("确定删除此色盘？")) return;
    await api.deletePalette(id);
    load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          我的色盘
        </h1>
        <Link to="/palettes/new">
          <button type="button">新建色盘</button>
        </Link>
      </div>
      <p className="page-subtitle">导入参考色图，整理你的专属色号体系，供像素画生成与 Excel 导出复用。</p>
      {loading && <p>加载中…</p>}
      {!loading && palettes.length === 0 && (
        <div className="card">
          <p style={{ color: "var(--muted)" }}>暂无色盘，请先创建。</p>
          <Link to="/palettes/new">
            <button type="button" style={{ marginTop: "1rem" }}>
              去创建
            </button>
          </Link>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {palettes.map((p) => (
          <div key={p.id} className="card">
            <h3>{p.name}</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0.5rem 0" }}>
              {p.colors.length} 色 · {new Date(p.created_at).toLocaleString()}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "0.75rem" }}>
              {p.colors.map((c) => (
                <div
                  key={c.sort}
                  title={`${c.label}: ${c.r},${c.g},${c.b}`}
                  className="color-swatch"
                  style={{ background: `rgb(${c.r},${c.g},${c.b})` }}
                />
              ))}
            </div>
            <button type="button" className="danger" onClick={() => remove(p.id)}>
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
