import { useEffect, useRef, useState } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { CropRect } from "../api";

interface Props {
  src: string;
  aspect?: number;
  onChange: (crop: CropRect) => void;
}

function toRelativeCrop(crop: PixelCrop, imgW: number, imgH: number): CropRect {
  return {
    x: crop.x / imgW,
    y: crop.y / imgH,
    w: crop.width / imgW,
    h: crop.height / imgH,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export default function ImageCropper({ src, aspect, onChange }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [hasEmittedInitial, setHasEmittedInitial] = useState(false);

  useEffect(() => {
    setHasEmittedInitial(false);
  }, [src, aspect]);

  const emitFromCrop = (pixelCrop: PixelCrop, img: HTMLImageElement) => {
    if (!pixelCrop.width || !pixelCrop.height || !img.width || !img.height) return;
    // react-image-crop 的 pixelCrop 以“显示尺寸”作为坐标系，必须用当前渲染尺寸归一化。
    onChange(
      toRelativeCrop(
        {
          unit: "px",
          x: clamp01(pixelCrop.x / img.width) * img.width,
          y: clamp01(pixelCrop.y / img.height) * img.height,
          width: clamp01(pixelCrop.width / img.width) * img.width,
          height: clamp01(pixelCrop.height / img.height) * img.height,
        },
        img.width,
        img.height
      )
    );
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initial = centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, aspect || width / height, width, height),
      width,
      height
    );
    setCrop(initial);
    // 用户不拖拽时也要提交初始裁剪框，避免后端收到 null 走全图。
    if (!hasEmittedInitial) {
      const initialPx: PixelCrop = {
        unit: "px",
        x: (initial.x / 100) * width,
        y: (initial.y / 100) * height,
        width: (initial.width / 100) * width,
        height: (initial.height / 100) * height,
      };
      emitFromCrop(initialPx, e.currentTarget);
      setHasEmittedInitial(true);
    }
  };

  const onComplete = (c: PixelCrop) => {
    const img = imgRef.current;
    if (!img || !c.width) return;
    emitFromCrop(c, img);
  };

  return (
    <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={onComplete} aspect={aspect}>
      <img ref={imgRef} src={src} alt="裁剪" onLoad={onImageLoad} style={{ maxHeight: 400, maxWidth: "100%" }} />
    </ReactCrop>
  );
}
