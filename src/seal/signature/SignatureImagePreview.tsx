import { useRef } from "react";
import { Button } from "antd";
import { ImagePlus } from "lucide-react";
import type { SignaturePad } from "./useSignaturePad";

export default function SignatureImagePreview({
  signature,
}: {
  signature: SignaturePad;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="signature-image-wrap">
      <canvas
        ref={signature.setPreviewCanvas}
        className="signature-image-canvas"
        role="img"
        aria-label="签名图片预览"
      />

      {!signature.imageInfo && !signature.imageLoading && (
        <div className="signature-image-empty">
          <ImagePlus size={26} strokeWidth={1.6} aria-hidden="true" />
          {signature.imageError && <p>{signature.imageError}</p>}
          <Button
            type="primary"
            icon={<ImagePlus size={15} strokeWidth={1.8} />}
            onClick={() => inputRef.current?.click()}
          >
            {signature.imageError ? "重新选择" : "选择签名图片"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            tabIndex={-1}
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void signature.loadImage(file);
              event.target.value = "";
            }}
          />
        </div>
      )}

      {signature.imageLoading && (
        <div className="signature-image-overlay">正在读取图片…</div>
      )}

      {signature.imageInfo &&
        !signature.imageLoading &&
        !signature.hasInk && (
          <div className="signature-image-overlay signature-image-overlay--error">
            未检测到笔迹
          </div>
        )}
    </div>
  );
}