import { useRef, useState } from "react";
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

export default function ImageCropper({ src, aspect, onChange }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initial = centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, aspect || width / height, width, height),
      width,
      height
    );
    setCrop(initial);
  };

  const onComplete = (c: PixelCrop) => {
    const img = imgRef.current;
    if (!img || !c.width) return;
    onChange(toRelativeCrop(c, img.naturalWidth, img.naturalHeight));
  };

  return (
    <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={onComplete} aspect={aspect}>
      <img ref={imgRef} src={src} alt="裁剪" onLoad={onImageLoad} style={{ maxHeight: 400, maxWidth: "100%" }} />
    </ReactCrop>
  );
}
