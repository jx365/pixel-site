import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ColorCandidate, ExtractQuality, PaletteColor } from "../api";

type SelectedColor = PaletteColor & { selected: boolean };

const QUALITY_OPTIONS: { value: ExtractQuality; label: string; hint: string }[] = [
  { value: "conservative", label: "保守", hint: "合并相近色，适合色卡较少、想快速整理" },
  { value: "balanced", label: "平衡", hint: "默认推荐，兼顾数量与可用性" },
  { value: "high_fidelity", label: "高保真", hint: "保留更多颜色，适合 50+ 色的复杂色盘图" },
];

export default function PaletteNewPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const lastFilesRef = useRef<File[]>([]);
  const [name, setName] = useState("我的色盘");
  const [quality, setQuality] = useState<ExtractQuality>("high_fidelity");
  const [colors, setColors] = useState<SelectedColor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const applyCandidates = (candidates: ColorCandidate[]) => {
    const defaultSelect = quality === "high_fidelity" ? 40 : quality === "balanced" ? 24 : 16;
    setColors(
      candidates.map((c, i) => ({
        sort: i + 1,
        label: String(i + 1),
        r: c.r,
        g: c.g,
        b: c.b,
        selected: i < defaultSelect,
      }))
    );
  };

  const extract = async (files: FileList | File[] | null, q: ExtractQuality = quality) => {
    const list = files instanceof FileList ? Array.from(files) : files;
    if (!list?.length) return;
    lastFilesRef.current = list;
    setLoading(true);
    setError("");
    try {
      const { candidates } = await api.extractColors(list, q);
      applyCandidates(candidates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提取失败");
    } finally {
      setLoading(false);
    }
  };

  const reExtract = () => {
    if (!lastFilesRef.current.length) {
      setError("请先上传色盘图片");
      return;
    }
    extract(lastFilesRef.current, quality);
  };

  const toggle = (idx: number) => {
    setColors((prev) => prev.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c)));
  };

  const updateLabel = (idx: number, label: string) => {
    setColors((prev) => prev.map((c, i) => (i === idx ? { ...c, label } : c)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= colors.length) return;
    setColors((prev) => {
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy.map((c, i) => ({ ...c, sort: i + 1 }));
    });
  };

  const save = async () => {
    const selected = colors.filter((c) => c.selected);
    if (!selected.length) {
      setError("请至少选择一种颜色");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.createPalette({
        name,
        colors: selected.map(({ sort, label, r, g, b }) => ({ sort, label, r, g, b })),
      });
      navigate("/palettes");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = colors.filter((c) => c.selected).length;

  return (
    <div>
      <h1 className="page-title">制作色盘</h1>
      <p className="page-subtitle">
        支持一次导入多张图片；提取强度可选，高保真更适合 50+ 色的复杂色卡图。
      </p>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="form-group">
          <label>色盘名称</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="form-group">
          <label>提取强度</label>
          <div className="quality-options">
            {QUALITY_OPTIONS.map((opt) => (
              <label key={opt.value} className={`quality-option ${quality === opt.value ? "active" : ""}`}>
                <input
                  type="radio"
                  name="quality"
                  value={opt.value}
                  checked={quality === opt.value}
                  onChange={() => setQuality(opt.value)}
                />
                <span className="quality-label">{opt.label}</span>
                <span className="quality-hint">{opt.hint}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>导入色盘图片（可多选）</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => extract(e.target.files)}
          />
        </div>

        <div className="actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="secondary"
            onClick={reExtract}
            disabled={loading || !lastFilesRef.current.length}
          >
            按当前强度重新提取
          </button>
        </div>

        {loading && <p>处理中…</p>}
        {error && <p className="error">{error}</p>}
      </div>

      {colors.length > 0 && (
        <>
          <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
            共提取 {colors.length} 色，已勾选 {selectedCount} 色。可自定义色号并调整顺序。
          </p>
          {colors.map((c, i) => (
            <div key={i} className="palette-row">
              <input type="checkbox" checked={c.selected} onChange={() => toggle(i)} />
              <div className="color-swatch" style={{ background: `rgb(${c.r},${c.g},${c.b})` }} />
              <input
                style={{ width: 60 }}
                value={c.label}
                onChange={(e) => updateLabel(i, e.target.value)}
                title="色号"
              />
              <span style={{ fontFamily: "var(--mono)", fontSize: "0.85rem", color: "var(--muted)" }}>
                {c.r},{c.g},{c.b}
              </span>
              <button type="button" className="secondary" onClick={() => move(i, -1)} disabled={i === 0}>
                ↑
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => move(i, 1)}
                disabled={i === colors.length - 1}
              >
                ↓
              </button>
            </div>
          ))}
          <div className="actions">
            <button type="button" onClick={save} disabled={loading}>
              保存色盘
            </button>
          </div>
        </>
      )}
    </div>
  );
}
