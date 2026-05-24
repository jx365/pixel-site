import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ColorCandidate, ExtractQuality, PaletteColor } from "../api";

type SelectedColor = PaletteColor & { selected: boolean };

const QUALITY_OPTIONS: { value: ExtractQuality; label: string; hint: string }[] = [
  { value: "conservative", label: "保守", hint: "合并相近色，适合色卡较少、想快速整理" },
  { value: "balanced", label: "平衡", hint: "默认推荐，兼顾数量与可用性" },
  { value: "high_fidelity", label: "高保真", hint: "保留更多颜色，适合 50+ 色的复杂色盘图" },
];

function clampColor(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v)));
}

function parseHexToRgb(hexRaw: string): { r: number; g: number; b: number } | null {
  const hex = hexRaw.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => clampColor(v).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export default function PaletteNewPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const lastFilesRef = useRef<File[]>([]);
  const [name, setName] = useState("我的色盘");
  const [quality, setQuality] = useState<ExtractQuality>("high_fidelity");
  const [colors, setColors] = useState<SelectedColor[]>([]);
  const [manualLabel, setManualLabel] = useState("");
  const [manualHex, setManualHex] = useState("#");
  const [manualR, setManualR] = useState(0);
  const [manualG, setManualG] = useState(0);
  const [manualB, setManualB] = useState(0);
  const [bulkText, setBulkText] = useState("");
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

  const addColor = (label: string, r: number, g: number, b: number) => {
    setColors((prev) => [
      ...prev,
      {
        sort: prev.length + 1,
        label: label || String(prev.length + 1),
        r: clampColor(r),
        g: clampColor(g),
        b: clampColor(b),
        selected: true,
      },
    ]);
  };

  const addManualColor = () => {
    const parsed = parseHexToRgb(manualHex);
    if (!parsed) {
      setError("手动颜色 Hex 格式需为 #RRGGBB");
      return;
    }
    addColor(manualLabel.trim(), parsed.r, parsed.g, parsed.b);
    setManualLabel("");
    setError("");
  };

  const importBulkColors = () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      setError("请先粘贴要导入的颜色数据");
      return;
    }

    const parsedRows: Array<{ label: string; r: number; g: number; b: number }> = [];
    for (const line of lines) {
      const csv = line.split(/[,\t，]/).map((x) => x.trim());
      if (csv.length >= 3 && /^\d+$/.test(csv[csv.length - 3]) && /^\d+$/.test(csv[csv.length - 2]) && /^\d+$/.test(csv[csv.length - 1])) {
        const maybeLabel = csv.length > 3 ? csv.slice(0, csv.length - 3).join("_") : "";
        parsedRows.push({
          label: maybeLabel,
          r: Number(csv[csv.length - 3]),
          g: Number(csv[csv.length - 2]),
          b: Number(csv[csv.length - 1]),
        });
        continue;
      }
      const hexOnly = parseHexToRgb(csv[csv.length - 1] || line);
      if (hexOnly) {
        const maybeLabel = csv.length > 1 ? csv[0] : "";
        parsedRows.push({
          label: maybeLabel,
          r: hexOnly.r,
          g: hexOnly.g,
          b: hexOnly.b,
        });
        continue;
      }
      setError(`无法解析该行：${line}`);
      return;
    }

    parsedRows.forEach((row) => addColor(row.label, row.r, row.g, row.b));
    setBulkText("");
    setError("");
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

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>手动添加颜色</h3>
        <div className="grid-2">
          <div className="form-group">
            <label>色号（可选）</label>
            <input value={manualLabel} onChange={(e) => setManualLabel(e.target.value)} placeholder="如 A12 / SKY_BLUE" />
          </div>
          <div className="form-group">
            <label>Hex</label>
            <input
              value={manualHex}
              onChange={(e) => {
                const value = e.target.value.trim();
                setManualHex(value.startsWith("#") ? value : `#${value}`);
                const parsed = parseHexToRgb(value);
                if (parsed) {
                  setManualR(parsed.r);
                  setManualG(parsed.g);
                  setManualB(parsed.b);
                }
              }}
              placeholder="#RRGGBB"
            />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>R</label>
            <input type="number" min={0} max={255} value={manualR} onChange={(e) => setManualR(clampColor(Number(e.target.value)))} />
          </div>
          <div className="form-group">
            <label>G</label>
            <input type="number" min={0} max={255} value={manualG} onChange={(e) => setManualG(clampColor(Number(e.target.value)))} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>B</label>
            <input type="number" min={0} max={255} value={manualB} onChange={(e) => setManualB(clampColor(Number(e.target.value)))} />
          </div>
          <div className="form-group">
            <label>RGB 转 Hex 预览</label>
            <input value={toHex(manualR, manualG, manualB)} readOnly />
          </div>
        </div>
        <div className="actions">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const hex = toHex(manualR, manualG, manualB);
              setManualHex(hex);
              addColor(manualLabel.trim(), manualR, manualG, manualB);
              setManualLabel("");
            }}
          >
            按 RGB 添加
          </button>
          <button type="button" onClick={addManualColor}>
            按 Hex 添加
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>批量导入（文本/Excel 粘贴）</h3>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          支持格式：`label,r,g,b` 或 `label,#RRGGBB` 或仅 `#RRGGBB`；支持逗号/制表符分隔。
        </p>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={8}
          style={{ width: "100%", resize: "vertical" }}
          placeholder={"A1,255,0,0\nA2,#00FF00\n#112233"}
        />
        <div className="actions">
          <button type="button" className="secondary" onClick={importBulkColors}>
            导入并追加颜色
          </button>
        </div>
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
                {c.r},{c.g},{c.b} / {toHex(c.r, c.g, c.b)}
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
