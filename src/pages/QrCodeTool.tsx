import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  ColorPicker,
  Input,
  InputNumber,
  Segmented,
  Select,
  Spin,
  Switch,
} from "antd";
import {
  ArrowLeft,
  ClipboardPaste,
  Copy,
  Download,
  FileImage,
  ImagePlus,
  QrCode,
  ScanLine,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import HelpTip from "../components/HelpTip";
import jsQR from "jsqr";
import { useToolBack } from "../hooks/useToolBack";
import {
  decodeImage,
  isHeic,
  isSupportedRaster,
  makeCanvas,
} from "../image/io";
import { formatBytes } from "../compress/compress";
import { sanitizeFilename } from "../seal/filename";
import { saveExport } from "../seal/save";
import "../styles/studio.css";
import "../styles/qr.css";

type Mode = "generate" | "scan";
type ContentType = "text" | "wifi";
type WifiSecurity = "WPA" | "WEP" | "nopass";
type ErrorLevel = "L" | "M" | "Q" | "H";

interface ScanSource {
  name: string;
  size: number;
  url: string;
}

const escapeWifi = (value: string) =>
  value.replace(/([\\;,:"])/g, "\\$1");

const errorLevelOptions = [
  { label: "L", value: "L" },
  { label: "M", value: "M" },
  { label: "Q", value: "Q" },
  { label: "H", value: "H" },
];

const timestamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

export default function QrCodeTool() {
  const goBack = useToolBack();
  const { message } = AntdApp.useApp();

  const [mode, setMode] = useState<Mode>("generate");

  // Generation
  const [contentType, setContentType] = useState<ContentType>("text");
  const [text, setText] = useState("");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiSecurity, setWifiSecurity] = useState<WifiSecurity>("WPA");
  const [wifiHidden, setWifiHidden] = useState(false);
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(2);
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>("M");
  const [foreground, setForeground] = useState("#111111");
  const [background, setBackground] = useState("#ffffff");
  const [renderError, setRenderError] = useState("");
  const [exporting, setExporting] = useState<"png" | "svg" | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Scanning
  const [scanSource, setScanSource] = useState<ScanSource | null>(null);
  const [scanState, setScanState] = useState<
    | { status: "idle" }
    | { status: "working" }
    | { status: "done"; text: string }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const scanUrlRef = useRef<string | null>(null);
  const dragDepth = useRef(0);

  const payload = useMemo(() => {
    if (contentType === "text") return text.trim();
    if (!wifiSsid.trim()) return "";
    const security = wifiSecurity;
    const password =
      security === "nopass"
        ? ""
        : `P:${escapeWifi(wifiPassword)};`;
    return `WIFI:T:${security};S:${escapeWifi(wifiSsid)};${password}${wifiHidden ? "H:true;" : ""};`;
  }, [contentType, text, wifiSsid, wifiPassword, wifiSecurity, wifiHidden]);

  const colorConflict =
    foreground.toLowerCase() === background.toLowerCase();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!payload || colorConflict) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
      setRenderError("");
      return;
    }

    let cancelled = false;
    QRCode.toCanvas(canvas, payload, {
      width: size,
      margin,
      errorCorrectionLevel: errorLevel,
      color: { dark: foreground, light: background },
    })
      .then(() => {
        if (cancelled) return;
        // qrcode 会把像素尺寸写成内联样式（如 512px），覆盖 CSS 的百分比尺寸，
        // 画布因此撑出预览框被裁切。清掉内联宽高，让预览按容器缩放。
        canvas.style.width = "";
        canvas.style.height = "";
        setRenderError("");
      })
      .catch(() => {
        if (!cancelled) setRenderError("内容过长，无法生成二维码");
      });
    return () => {
      cancelled = true;
    };
  }, [payload, size, margin, errorLevel, foreground, background, colorConflict]);

  useEffect(
    () => () => {
      if (scanUrlRef.current) URL.revokeObjectURL(scanUrlRef.current);
    },
    [],
  );

  const exportQr = async (format: "png" | "svg") => {
    if (!payload || colorConflict || renderError) return;
    setExporting(format);
    try {
      const nameBase =
        contentType === "wifi" && wifiSsid.trim()
          ? `WiFi_${sanitizeFilename(wifiSsid.trim(), "二维码")}`
          : `二维码_${timestamp()}`;
      if (format === "png") {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!blob) throw new Error("无法导出 PNG");
        const result = await saveExport(
          new Uint8Array(await blob.arrayBuffer()),
          `${nameBase}.png`,
          "png",
        );
        if (result.status === "saved") message.success("已导出 PNG");
      } else {
        const svg = await QRCode.toString(payload, {
          type: "svg",
          margin,
          errorCorrectionLevel: errorLevel,
          color: { dark: foreground, light: background },
        });
        const bytes = new TextEncoder().encode(svg);
        const result = await saveExport(bytes, `${nameBase}.svg`, "svg");
        if (result.status === "saved") message.success("已导出 SVG");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(null);
    }
  };

  const decodeFile = useCallback(
    async (file: File) => {
      if (!isSupportedRaster(file)) {
        message.error(
          isHeic(file)
            ? "HEIC 暂不支持，请先转成 JPG 或 PNG"
            : "请选择 PNG、JPG、WebP、GIF 或 BMP 图片",
        );
        return;
      }

      const url = URL.createObjectURL(file);
      if (scanUrlRef.current) URL.revokeObjectURL(scanUrlRef.current);
      scanUrlRef.current = url;
      setScanSource({ name: file.name, size: file.size, url });
      setScanState({ status: "working" });

      try {
        const bitmap = await decodeImage(file);
        try {
          const maxSide = 2400;
          const scale = Math.min(
            1,
            maxSide / Math.max(bitmap.width, bitmap.height),
          );
          const width = Math.max(1, Math.round(bitmap.width * scale));
          const height = Math.max(1, Math.round(bitmap.height * scale));
          const canvas = makeCanvas(width, height);
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) throw new Error("无法读取图片");
          context.drawImage(bitmap, 0, 0, width, height);
          const imageData = context.getImageData(0, 0, width, height);
          const result = jsQR(imageData.data, width, height, {
            inversionAttempts: "attemptBoth",
          });
          if (!result?.data) {
            setScanState({
              status: "error",
              message: "没有识别到二维码，换一张更清晰的图片试试。",
            });
            return;
          }
          setScanState({ status: "done", text: result.data });
        } finally {
          bitmap.close();
        }
      } catch {
        setScanState({
          status: "error",
          message: "无法读取这张图片。",
        });
      }
    },
    [message],
  );

  const clearScan = () => {
    if (scanUrlRef.current) {
      URL.revokeObjectURL(scanUrlRef.current);
      scanUrlRef.current = null;
    }
    setScanSource(null);
    setScanState({ status: "idle" });
  };

  useEffect(() => {
    if (mode !== "scan") return;
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void decodeFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [mode, decodeFile]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, [contenteditable='true'], .ant-select, .ant-popover, .ant-color-picker",
        )
      ) {
        return;
      }
      if (
        document.querySelector(
          ".ant-popover:not(.ant-popover-hidden), .ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-color-picker",
        )
      ) {
        return;
      }
      goBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack]);

  const openScanPicker = () => scanInputRef.current?.click();

  const carriesFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes("Files");

  const onDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    if (mode !== "scan") return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    if (mode !== "scan") return;
    event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event) || mode !== "scan") return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (mode !== "scan") return;
    const file = event.dataTransfer.files?.[0];
    if (file) void decodeFile(file);
  };

  const copyDecoded = async () => {
    if (scanState.status !== "done") return;
    try {
      await navigator.clipboard.writeText(scanState.text);
      message.success("已复制");
    } catch {
      message.error("复制失败，请手动选择文本");
    }
  };

  const scanKind = (() => {
    if (scanState.status !== "done") return "";
    if (/^WIFI:/i.test(scanState.text)) return "WiFi 配置";
    if (/^https?:\/\//i.test(scanState.text)) return "网址";
    return "文本";
  })();

  return (
    <div
      className="tool-page studio-page qr-page"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <h1 className="visually-hidden">二维码</h1>

      <div className="studio-topbar qr-topbar">
        <Button
          type="text"
          className="back-btn"
          icon={<ArrowLeft size={16} strokeWidth={1.8} />}
          onClick={goBack}
        >
          返回工作台
        </Button>
        <Segmented
          className="tool-segmented"
          value={mode}
          options={[
            { label: "生成", value: "generate" },
            { label: "识别", value: "scan" },
          ]}
          onChange={(value) => setMode(value as Mode)}
        />
      </div>

      {mode === "generate" ? (
        <div className="qr-workspace">
          <section className="studio-card qr-content-card" aria-label="二维码内容">
            <header className="studio-card-head">
              <div className="studio-card-title">
                <strong>二维码内容</strong>
                {payload && <span>{payload.length} 字符</span>}
              </div>
            </header>

            <div className="qr-content-body">
              <div className="studio-field">
                <span className="studio-label">内容类型</span>
                <Segmented
                  block
                  className="studio-segmented"
                  value={contentType}
                  options={[
                    { label: "文本 / 网址", value: "text" },
                    { label: "WiFi", value: "wifi" },
                  ]}
                  onChange={(value) => setContentType(value as ContentType)}
                />
              </div>

              {contentType === "text" ? (
                <div className="studio-field">
                  <span className="studio-label">文本或网址</span>
                  <Input.TextArea
                    value={text}
                    autoSize={{ minRows: 8, maxRows: 16 }}
                    placeholder="输入要放进二维码的内容，例如 https://example.com"
                    onChange={(event) => setText(event.target.value)}
                  />
                </div>
              ) : (
                <>
                  <div className="studio-field">
                    <span className="studio-label">网络名称（SSID）</span>
                    <Input
                      value={wifiSsid}
                      placeholder="WiFi 名称"
                      onChange={(event) => setWifiSsid(event.target.value)}
                    />
                  </div>
                  <div className="studio-field">
                    <span className="studio-label">加密方式</span>
                    <Select
                      value={wifiSecurity}
                      options={[
                        { label: "WPA / WPA2", value: "WPA" },
                        { label: "WEP", value: "WEP" },
                        { label: "无密码", value: "nopass" },
                      ]}
                      onChange={(value) => setWifiSecurity(value as WifiSecurity)}
                    />
                  </div>
                  {wifiSecurity !== "nopass" && (
                    <div className="studio-field">
                      <span className="studio-label">密码</span>
                      <Input.Password
                        value={wifiPassword}
                        placeholder="WiFi 密码"
                        onChange={(event) => setWifiPassword(event.target.value)}
                      />
                    </div>
                  )}
                  <div className="studio-switch-row">
                    <span className="studio-label">隐藏网络</span>
                    <Switch
                      size="small"
                      checked={wifiHidden}
                      onChange={setWifiHidden}
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          <aside className="studio-panel qr-panel" aria-label="二维码外观与导出">
            <div className="studio-panel-head">
              <h2 className="studio-panel-title">预览</h2>
              <span className="studio-panel-meta">
                {size} × {size} px
              </span>
            </div>

            <div className="qr-preview-wrap">
              <div className="qr-canvas-box">
                {payload && !colorConflict ? (
                  <canvas ref={canvasRef} className="qr-canvas" />
                ) : (
                  <div className="qr-canvas-empty">
                    <QrCode size={32} strokeWidth={1.4} />
                    <span>
                      {colorConflict
                        ? "前景色与背景色不能相同"
                        : "输入内容后生成二维码"}
                    </span>
                  </div>
                )}
              </div>
              {renderError && (
                <p className="studio-error qr-render-error">{renderError}</p>
              )}
            </div>

            <section className="studio-section">
              <h3 className="studio-section-title">外观</h3>
              <div className="studio-two-col">
                <div className="studio-field">
                  <span className="studio-label">尺寸</span>
                  <InputNumber
                    value={size}
                    min={128}
                    max={1024}
                    step={64}
                    precision={0}
                    controls={false}
                    suffix="px"
                    onChange={(value) => setSize(value ?? 512)}
                  />
                </div>
                <div className="studio-field">
                  <span className="studio-label">静区</span>
                  <InputNumber
                    value={margin}
                    min={0}
                    max={8}
                    precision={0}
                    controls={false}
                    suffix="模块"
                    onChange={(value) => setMargin(value ?? 2)}
                  />
                </div>
              </div>

              <div className="studio-field">
                <span className="studio-label">
                  纠错等级
                  <HelpTip text="等级越高越抗遮挡，图案越密。" />
                </span>
                <Segmented
                  block
                  className="studio-segmented"
                  value={errorLevel}
                  options={errorLevelOptions}
                  onChange={(value) => setErrorLevel(value as ErrorLevel)}
                />
              </div>

              <div className="studio-two-col">
                <div className="studio-field">
                  <span className="studio-label">前景色</span>
                  <ColorPicker
                    value={foreground}
                    disabledAlpha
                    showText
                    onChange={(color) =>
                      setForeground(color.toHexString().slice(0, 7))
                    }
                  />
                </div>
                <div className="studio-field">
                  <span className="studio-label">背景色</span>
                  <ColorPicker
                    value={background}
                    disabledAlpha
                    showText
                    onChange={(color) =>
                      setBackground(color.toHexString().slice(0, 7))
                    }
                  />
                </div>
              </div>
              {colorConflict && (
                <p className="studio-error">前景色与背景色相同，无法识别。</p>
              )}
            </section>

            <section className="studio-result">
              <div className="studio-result-head">
                <span className="studio-result-title">导出</span>
                {payload && (
                  <span className="studio-status">{payload.length} 字符</span>
                )}
              </div>
              <div className="qr-export-row">
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<Download size={16} strokeWidth={1.8} />}
                  loading={exporting === "png"}
                  disabled={!payload || colorConflict || !!renderError}
                  onClick={() => void exportQr("png")}
                >
                  PNG
                </Button>
                <Button
                  size="large"
                  block
                  icon={<Download size={16} strokeWidth={1.8} />}
                  loading={exporting === "svg"}
                  disabled={!payload || colorConflict || !!renderError}
                  onClick={() => void exportQr("svg")}
                >
                  SVG
                </Button>
              </div>
            </section>
          </aside>
        </div>
      ) : (
        <div className="qr-workspace">
          <section className="studio-card qr-scan-card" aria-label="识别二维码">
            <header className="studio-card-head">
              <div className="studio-card-title">
                <strong>二维码图片</strong>
                {scanSource && <span>{scanSource.name}</span>}
              </div>
              {scanSource && (
                <div className="studio-card-actions">
                  <Button
                    size="small"
                    icon={<ImagePlus size={14} strokeWidth={1.8} />}
                    onClick={openScanPicker}
                  >
                    换一张
                  </Button>
                  <Button
                    size="small"
                    type="text"
                    icon={<X size={14} strokeWidth={1.8} />}
                    onClick={clearScan}
                  >
                    清除
                  </Button>
                </div>
              )}
            </header>

            <input
              ref={scanInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,image/jpeg,image/png,image/webp,image/gif,image/bmp"
              tabIndex={-1}
              className="visually-hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void decodeFile(file);
                event.target.value = "";
              }}
            />

            {scanSource ? (
              <div className="qr-scan-preview">
                <img src={scanSource.url} alt="待识别的二维码图片" />
                <span>{formatBytes(scanSource.size)}</span>
              </div>
            ) : (
              <div className="qr-scan-drop" onClick={openScanPicker}>
                <span className="studio-drop-icon" aria-hidden="true">
                  <ScanLine size={26} strokeWidth={1.6} />
                </span>
                <h2>拖入二维码图片</h2>
                <p>也可以直接按 Ctrl V 粘贴截图，或点击选择图片。</p>
                <div className="qr-scan-actions">
                  <Button
                    type="primary"
                    size="large"
                    icon={<FileImage size={16} strokeWidth={1.8} />}
                    onClick={(event) => {
                      event.stopPropagation();
                      openScanPicker();
                    }}
                  >
                    选择图片
                  </Button>
                  <Button
                    size="large"
                    icon={<ClipboardPaste size={16} strokeWidth={1.8} />}
                    onClick={async (event) => {
                      event.stopPropagation();
                      try {
                        const items = await navigator.clipboard.read();
                        for (const item of items) {
                          const type = item.types.find((value) =>
                            value.startsWith("image/"),
                          );
                          if (type) {
                            const blob = await item.getType(type);
                            void decodeFile(
                              new File([blob], "clipboard.png", {
                                type: blob.type,
                              }),
                            );
                            return;
                          }
                        }
                        message.info("剪贴板里没有图片");
                      } catch {
                        message.info("无法读取剪贴板，请直接按 Ctrl V 粘贴");
                      }
                    }}
                  >
                    粘贴
                  </Button>
                </div>
              </div>
            )}
          </section>

          <aside className="studio-panel qr-panel" aria-label="识别结果">
            <div className="studio-panel-head">
              <h2 className="studio-panel-title">识别结果</h2>
              {scanKind && <span className="studio-panel-meta">{scanKind}</span>}
            </div>

            {scanState.status === "working" ? (
              <div className="qr-result-state">
                <Spin />
                <span>正在识别…</span>
              </div>
            ) : scanState.status === "error" ? (
              <div className="qr-result-state is-error">
                <span>{scanState.message}</span>
                <Button size="small" onClick={openScanPicker}>
                  换一张
                </Button>
              </div>
            ) : scanState.status === "done" ? (
              <div className="qr-decoded">
                <Input.TextArea
                  value={scanState.text}
                  readOnly
                  autoSize={{ minRows: 8, maxRows: 16 }}
                  className="qr-decoded-text"
                />
                <div className="qr-decoded-actions">
                  <Button
                    type="primary"
                    block
                    icon={<Copy size={15} strokeWidth={1.8} />}
                    onClick={() => void copyDecoded()}
                  >
                    复制内容
                  </Button>
                </div>
              </div>
            ) : (
              <div className="qr-result-state">
                <QrCode size={30} strokeWidth={1.4} />
                <span>选择或粘贴图片后，识别到的内容会显示在这里。</span>
              </div>
            )}
          </aside>
        </div>
      )}

      <div
        className={`studio-drop-overlay${dragging ? " is-active" : ""}`}
        aria-hidden="true"
      >
        <ScanLine size={22} strokeWidth={1.7} />
        松开以识别二维码
      </div>
    </div>
  );
}