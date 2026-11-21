import type { SignaturePad } from "./useSignaturePad";

export default function SignatureCanvas({
  signature,
}: {
  signature: SignaturePad;
}) {
  return (
    <canvas
      ref={signature.setCanvas}
      className="signature-canvas"
      role="img"
      aria-label="手写签名区域，可用鼠标、触摸或手写笔书写"
      onPointerDown={signature.onPointerDown}
      onPointerMove={signature.onPointerMove}
      onPointerUp={signature.onPointerUp}
      onPointerCancel={signature.onPointerCancel}
    />
  );
}