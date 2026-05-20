import type { PreprocessParams, RenderParams } from "../api";

interface Props {
  params: RenderParams;
  preprocess: PreprocessParams;
  onChange: (p: RenderParams) => void;
  onPreprocessChange: (p: PreprocessParams) => void;
}

export default function ParamPanel({ params, preprocess, onChange, onPreprocessChange }: Props) {
  const set = <K extends keyof RenderParams>(key: K, value: RenderParams[K]) =>
    onChange({ ...params, [key]: value });

  return (
    <div className="card">
      <h3 style={{ marginBottom: "1rem" }}>渲染参数</h3>
      <div className="grid-2">
        <div className="form-group">
          <label>配色空间</label>
          <select value={params.color_space} onChange={(e) => set("color_space", e.target.value)}>
            <option value="lab">Lab（推荐）</option>
            <option value="rgb">RGB</option>
          </select>
        </div>
        <div className="form-group">
          <label>成画方式</label>
          <select value={params.render_mode} onChange={(e) => set("render_mode", e.target.value)}>
            <option value="nearest">最近邻</option>
            <option value="dominant">块众数</option>
          </select>
        </div>
        <div className="form-group">
          <label>抖动</label>
          <select value={params.dither} onChange={(e) => set("dither", e.target.value)}>
            <option value="none">无</option>
            <option value="floyd-steinberg">Floyd-Steinberg</option>
            <option value="ordered-bayer">有序 Bayer</option>
          </select>
        </div>
        <div className="form-group">
          <label>饱和度 {params.saturation.toFixed(2)}</label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={params.saturation}
            onChange={(e) => set("saturation", parseFloat(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>光影 (Gamma) {params.gamma.toFixed(2)}</label>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={params.gamma}
            onChange={(e) => set("gamma", parseFloat(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label>对比度 {params.contrast.toFixed(2)}</label>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={params.contrast}
            onChange={(e) => set("contrast", parseFloat(e.target.value))}
          />
        </div>
      </div>

      <h3 style={{ margin: "1.25rem 0 1rem" }}>预处理（大色块 + 轮廓）</h3>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          type="checkbox"
          checked={preprocess.enabled}
          onChange={(e) => onPreprocessChange({ ...preprocess, enabled: e.target.checked })}
        />
        启用预处理
      </label>
      {preprocess.enabled && (
        <>
          <div className="form-group">
            <label>色阶 Posterize {preprocess.posterize_levels}</label>
            <input
              type="range"
              min={2}
              max={16}
              value={preprocess.posterize_levels}
              onChange={(e) =>
                onPreprocessChange({ ...preprocess, posterize_levels: parseInt(e.target.value) })
              }
            />
          </div>
          <div className="form-group">
            <label>模糊半径 {preprocess.blur_radius}</label>
            <input
              type="range"
              min={0}
              max={10}
              value={preprocess.blur_radius}
              onChange={(e) => onPreprocessChange({ ...preprocess, blur_radius: parseInt(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>轮廓强度 {preprocess.edge_strength.toFixed(2)}</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={preprocess.edge_strength}
              onChange={(e) =>
                onPreprocessChange({ ...preprocess, edge_strength: parseFloat(e.target.value) })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
