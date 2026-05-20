import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  api,
  CropRect,
  Palette,
  PreprocessParams,
  Project,
  RenderParams,
  RenderResult,
} from "../api";
import ImageCropper from "../components/ImageCropper";
import ParamPanel from "../components/ParamPanel";

const defaultPreprocess: PreprocessParams = {
  enabled: true,
  posterize_levels: 6,
  blur_radius: 2,
  edge_strength: 0.3,
};

const defaultParams: RenderParams = {
  color_space: "lab",
  render_mode: "nearest",
  dither: "none",
  saturation: 1,
  gamma: 1,
  contrast: 1,
  smart_cutout: false,
};

type Step = "upload" | "crop" | "params" | "preview";

export default function CreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("upload");
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [paletteId, setPaletteId] = useState<number | null>(null);
  const [canvasW, setCanvasW] = useState(32);
  const [canvasH, setCanvasH] = useState(32);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [preprocess, setPreprocess] = useState<PreprocessParams>(defaultPreprocess);
  const [preprocessUrl, setPreprocessUrl] = useState<string | null>(null);
  const [params, setParams] = useState<RenderParams>(defaultParams);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listPalettes().then((list) => {
      setPalettes(list);
      if (list.length) setPaletteId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const createProject = async () => {
    if (!file || !paletteId) {
      setError("请选择照片和色盘");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("palette_id", String(paletteId));
      fd.append("canvas_w", String(canvasW));
      fd.append("canvas_h", String(canvasH));
      if (crop) fd.append("crop_json", JSON.stringify(crop));
      fd.append("preprocess_json", JSON.stringify(preprocess));
      const p = await api.createProject(fd);
      setProject(p);
      setStep("params");
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setLoading(false);
    }
  };

  const refreshPreprocess = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const { preview_url } = await api.preprocessPreview(project.id, preprocess);
      setPreprocessUrl(preview_url);
      await api.updateProject(project.id, { preprocess });
    } catch (e) {
      setError(e instanceof Error ? e.message : "预处理失败");
    } finally {
      setLoading(false);
    }
  };

  const render = async () => {
    if (!project) return;
    setLoading(true);
    setError("");
    try {
      const r = await api.render(project.id, { ...params, preprocess });
      setResult(r);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "渲染失败");
    } finally {
      setLoading(false);
    }
  };

  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "1. 上传" },
    { key: "crop", label: "2. 裁剪" },
    { key: "params", label: "3. 参数" },
    { key: "preview", label: "4. 预览" },
  ];

  return (
    <div>
      <h1 className="page-title">生成像素画</h1>
      <p className="page-subtitle">上传照片，裁剪范围，调参并实时预览，最后导出标准色号 Excel。</p>
      <div className="steps">
        {steps.map((s) => (
          <span key={s.key} className={`step ${step === s.key ? "active" : ""}`}>
            {s.label}
          </span>
        ))}
      </div>
      {error && <p className="error">{error}</p>}

      {step === "upload" && (
        <div className="card">
          <p style={{ color: "var(--muted)", marginBottom: "0.85rem" }}>
            建议上传主体清晰、色块明确的图片，生成效果会更稳定。
          </p>
          <div className="form-group">
            <label>选择照片</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="form-group">
            <label>色盘</label>
            <select value={paletteId ?? ""} onChange={(e) => setPaletteId(Number(e.target.value))}>
              {palettes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.colors.length}色）
                </option>
              ))}
            </select>
            {palettes.length === 0 && (
              <p style={{ marginTop: "0.5rem" }}>
                <Link to="/palettes/new">先去创建色盘</Link>
              </p>
            )}
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>画布宽</label>
              <input type="number" min={1} max={200} value={canvasW} onChange={(e) => setCanvasW(+e.target.value)} />
            </div>
            <div className="form-group">
              <label>画布高</label>
              <input type="number" min={1} max={200} value={canvasH} onChange={(e) => setCanvasH(+e.target.value)} />
            </div>
          </div>
          {previewUrl && (
            <img src={previewUrl} alt="预览" style={{ maxWidth: "100%", marginTop: "1rem", borderRadius: 8 }} />
          )}
          <div className="actions">
            <button type="button" disabled={!file || !paletteId} onClick={() => setStep("crop")}>
              下一步：裁剪
            </button>
          </div>
        </div>
      )}

      {step === "crop" && previewUrl && (
        <div className="card">
          <p style={{ color: "var(--muted)", marginBottom: "0.85rem" }}>
            拖拽裁剪框选择想要像素化的区域，比例会跟画布宽高保持一致。
          </p>
          <ImageCropper src={previewUrl} aspect={canvasW / canvasH} onChange={(c) => setCrop(c)} />
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setStep("upload")}>
              上一步
            </button>
            <button type="button" onClick={createProject} disabled={loading}>
              {loading ? "创建中…" : "下一步：调参"}
            </button>
          </div>
        </div>
      )}

      {step === "params" && project && (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div>
            <ParamPanel
              params={params}
              preprocess={preprocess}
              onChange={setParams}
              onPreprocessChange={setPreprocess}
            />
            <div className="actions">
              <button type="button" className="secondary" onClick={refreshPreprocess} disabled={loading}>
                刷新预处理预览
              </button>
              <button type="button" onClick={render} disabled={loading}>
                {loading ? "生成中…" : "生成像素画"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => navigate(`/create/${project.id}/batch`)}
              >
                批量参数预览
              </button>
            </div>
          </div>
          <div className="card compare-slider">
            <div>
              <p style={{ marginBottom: "0.5rem", color: "var(--muted)" }}>原图</p>
              <img src={project.source_image_url} alt="原图" style={{ maxWidth: "100%" }} />
            </div>
            <div>
              <p style={{ marginBottom: "0.5rem", color: "var(--muted)" }}>预处理后</p>
              {preprocessUrl ? (
                <img src={preprocessUrl} alt="预处理" style={{ maxWidth: "100%" }} />
              ) : (
                <p style={{ color: "var(--muted)" }}>点击「刷新预处理预览」</p>
              )}
            </div>
          </div>
        </div>
      )}

      {step === "preview" && result && (
        <div className="card">
          <p style={{ color: "var(--muted)", marginBottom: "0.85rem" }}>生成完成，可继续调参或直接导出。</p>
          <img
            src={result.preview_url!}
            alt="像素画"
            style={{ maxWidth: "100%", imageRendering: "pixelated" }}
          />
          <p style={{ marginTop: "0.75rem", color: "var(--muted)" }}>
            {result.canvas_w}×{result.canvas_h} 格
          </p>
          <div className="actions">
            <button type="button" onClick={() => navigate(`/results/${result.id}`)}>
              查看详情 / 下载 Excel
            </button>
            <button type="button" className="secondary" onClick={() => setStep("params")}>
              调整参数
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
