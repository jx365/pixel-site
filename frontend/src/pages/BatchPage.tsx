import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, RenderParams, RenderResult } from "../api";
import ParamPanel from "../components/ParamPanel";

const defaultPreprocess = {
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

function formatParams(p: RenderParams): string {
  return `d=${p.dither} g=${p.gamma} s=${p.saturation} c=${p.contrast}`;
}

export default function BatchPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useState<RenderParams>(defaultParams);
  const [preprocess, setPreprocess] = useState(defaultPreprocess);
  const [ditherOpts, setDitherOpts] = useState("none,floyd-steinberg");
  const [gammaOpts, setGammaOpts] = useState("0.8,1,1.2");
  const [satOpts, setSatOpts] = useState("0.9,1,1.1");
  const [results, setResults] = useState<RenderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const parseList = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const runBatch = async () => {
    if (!projectId) return;
    setLoading(true);
    setError("");
    try {
      const dithers = parseList(ditherOpts);
      const gammas = parseList(gammaOpts).map(Number);
      const sats = parseList(satOpts).map(Number);
      const count = dithers.length * gammas.length * sats.length;
      if (count > 50) {
        setError(`组合数 ${count} 超过上限 50，请减少参数`);
        setLoading(false);
        return;
      }
      const { results: list } = await api.batch(Number(projectId), {
        base_params: { ...params, preprocess },
        param_grid: {
          dither: { values: dithers },
          gamma: { values: gammas },
          saturation: { values: sats },
        },
      });
      setResults(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "批量渲染失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">批量参数预览</h1>
      <p className="page-subtitle">
        设定参数范围后生成小图预览（最多 50 组），点击可查看大图并导出 Excel
      </p>
      {error && <p className="error">{error}</p>}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <ParamPanel
            params={params}
            preprocess={preprocess}
            onChange={setParams}
            onPreprocessChange={setPreprocess}
          />
          <div className="card" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginBottom: "0.75rem" }}>遍历范围（逗号分隔）</h3>
            <div className="form-group">
              <label>抖动</label>
              <input value={ditherOpts} onChange={(e) => setDitherOpts(e.target.value)} placeholder="none,floyd-steinberg" />
            </div>
            <div className="form-group">
              <label>Gamma</label>
              <input value={gammaOpts} onChange={(e) => setGammaOpts(e.target.value)} placeholder="0.8,1,1.2" />
            </div>
            <div className="form-group">
              <label>饱和度</label>
              <input value={satOpts} onChange={(e) => setSatOpts(e.target.value)} placeholder="0.9,1,1.1" />
            </div>
            <button type="button" onClick={runBatch} disabled={loading}>
              {loading ? "生成中…" : "开始批量预览"}
            </button>
          </div>
        </div>

        <div>
          {results.length > 0 && (
            <div className="thumb-grid">
              {results.map((r) => (
                <div
                  key={r.id}
                  className={`thumb-card ${selected === r.id ? "selected" : ""}`}
                  onClick={() => setSelected(r.id)}
                  onDoubleClick={() => navigate(`/results/${r.id}`)}
                >
                  {r.thumb_url && <img src={r.thumb_url} alt="预览" />}
                  <div className="thumb-params">{formatParams(r.params)}</div>
                </div>
              ))}
            </div>
          )}
          {selected && (
            <div className="actions" style={{ marginTop: "1rem" }}>
              <button type="button" onClick={() => navigate(`/results/${selected}`)}>
                查看选中 / 下载 Excel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
