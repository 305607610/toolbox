import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App as AntdApp, Button, Input, Modal, Segmented, Spin } from "antd";
import {
  ArrowLeft,
  Download,
  FileCode2,
  FileText,
  FileWarning,
  FolderOpen,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { formatBytes } from "../compress/compress";
import { sanitizeFilename } from "../seal/filename";
import { saveHtml } from "../pdf/saveHtml";
import { isTauri } from "../seal/save";
import "../styles/pdf.css";

type RangeMode = "all" | "custom";
type PdfDpi = 144 | 192 | 300;

interface PdfConvertResult {
  html: string;
  page_count: number;
  warnings: string[];
}

const DPI_OPTIONS: { label: string; value: PdfDpi }[] = [
  { label: "144 DPI", value: 144 },
  { label: "192 DPI", value: 192 },
  { label: "300 DPI", value: 300 },
];

const parsePageRange = (mode: RangeMode, value: string, total: number) => {
  if (total <= 0) return { indices: [], error: "" };
  if (mode === "all") {
    return { indices: Array.from({ length: total }, (_, index) => index), error: "" };
  }
  const raw = value.trim();
  if (!raw) return { indices: [], error: "请输入页码范围，如 1-3,5" };

  const indices = new Set<number>();
  for (const token of raw.replace(/[，、]/g, ",").split(",")) {
    const part = token.trim();
    if (!part) continue;
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) return { indices: [], error: `无法识别「${part}」` };
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end < 1 || start > total || end > total) {
      return { indices: [], error: `页码需在 1–${total} 之间` };
    }
    if (start > end) return { indices: [], error: `「${part}」的起止顺序不对` };
    for (let page = start; page <= end; page += 1) indices.add(page - 1);
  }

  if (indices.size === 0) return { indices: [], error: "请输入页码范围" };
  return { indices: [...indices].sort((a, b) => a - b), error: "" };
};

const stemOf = (name: string) =>
  sanitizeFilename(name.replace(/\.pdf$/i, "").trim(), "PDF");

const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });

export default function PdfTool() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntdApp.useApp();
  const from = (location.state as { from?: string } | null)?.from;
  const goBack = () => navigate(from && from.startsWith("/") ? from : "/");

  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const base64Ref = useRef<string | null>(null);
  const passwordRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [previewHtml, setPreviewHtml] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [passwordPrompt, setPasswordPrompt] = useState<{
    wrong: boolean;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [dpi, setDpi] = useState<PdfDpi>(192);
  const [rangeMode, setRangeMode] = useState<RangeMode>("all");
  const [rangeText, setRangeText] = useState("");

  const range = useMemo(
    () => parsePageRange(rangeMode, rangeText, pageCount),
    [rangeMode, rangeText, pageCount],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPreview = useCallback(
    async (next: File, nextPassword?: string) => {
      if (!isTauri()) {
        setLoadError("PDF 转换需要在桌面应用中使用。");
        return;
      }
      setLoading(true);
      setLoadError("");
      setPreviewHtml("");
      setWarnings([]);
      setPasswordPrompt(null);

      try {
        let encoded = base64Ref.current;
        if (!encoded) {
          encoded = await readBase64(next);
          base64Ref.current = encoded;
        }
        const result = await invoke<PdfConvertResult>("pdf_convert", {
          base64: encoded,
          password: nextPassword ?? null,
          dpi: 144,
          pages: [],
          preview: true,
          title: stemOf(next.name),
        });
        if (!mountedRef.current) return;
        passwordRef.current = nextPassword ?? null;
        setPreviewHtml(result.html);
        setPageCount(result.page_count);
        setWarnings(result.warnings);
      } catch (error) {
        if (!mountedRef.current) return;
        const text =
          typeof error === "string" ? error : String((error as Error)?.message ?? error);
        if (text.includes("password-required")) {
          setPasswordPrompt({ wrong: false });
          return;
        }
        if (text.includes("invalid-password")) {
          setPasswordPrompt({ wrong: true });
          return;
        }
        setLoadError(
          text.includes("pdfium")
            ? "缺少 PDF 渲染组件，请重新安装应用。"
            : "无法读取这个 PDF，请确认文件完整。",
        );
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [],
  );

  const openFile = (next: File) => {
    if (exporting) return;
    if (!/\.pdf$/i.test(next.name) && next.type !== "application/pdf") {
      message.error("请选择 PDF 文件");
      return;
    }
    base64Ref.current = null;
    passwordRef.current = null;
    setFile(next);
    setPageCount(0);
    setRangeMode("all");
    setRangeText("");
    setPassword("");
    setPasswordPrompt(null);
    setLoading(false);
    setLoadError("");
    setWarnings([]);
    setPreviewHtml("");
    void loadPreview(next);
  };

  const openPicker = () => inputRef.current?.click();

  const handlePasswordOk = () => {
    if (!file) return;
    const value = password;
    setPassword("");
    void loadPreview(file, value);
  };

  const handlePasswordCancel = () => {
    setPasswordPrompt(null);
    setPassword("");
    setLoadError("已取消输入密码。");
    setLoading(false);
  };

  const exportHtml = async () => {
    if (!file || !previewHtml || range.error || range.indices.length === 0) return;
    setExporting(true);
    try {
      const encoded = base64Ref.current ?? (await readBase64(file));
      const result = await invoke<PdfConvertResult>("pdf_convert", {
        base64: encoded,
        password: passwordRef.current ?? null,
        dpi,
        pages: range.indices,
        preview: false,
        title: stemOf(file.name),
      });
      const saved = await saveHtml(result.html, `${stemOf(file.name)}.html`);
      if (saved.status === "saved" && mountedRef.current) {
        message.success("已保存");
      }
    } catch (error) {
      const text =
        typeof error === "string" ? error : String((error as Error)?.message ?? error);
      message.error(text.includes("pdfium") ? "缺少 PDF 渲染组件" : "转换失败，请重试");
    } finally {
      if (mountedRef.current) setExporting(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !passwordPrompt && !exporting) goBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goBack, passwordPrompt, exporting]);

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const next = event.dataTransfer.files?.[0];
    if (next) openFile(next);
  };

  const fileMeta = file ? `${pageCount || "—"} 页 · ${formatBytes(file.size)}` : "";
  const canExport =
    !!file && !!previewHtml && !exporting && !range.error && range.indices.length > 0;

  return (
    <div
      className="tool-page pdf-tool-page"
      onDragEnter={(event) => {
        event.preventDefault();
        if (!exporting) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <h1 className="visually-hidden">PDF 转 HTML</h1>

      <div className="pdf-topbar">
        <Button
          type="text"
          className="back-btn"
          icon={<ArrowLeft size={16} strokeWidth={1.8} />}
          onClick={goBack}
        >
          返回工作台
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        tabIndex={-1}
        className="visually-hidden"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) openFile(next);
          event.target.value = "";
        }}
      />

      {!previewHtml ? (
        <div className="pdf-empty-wrap">
          <div
            className="pdf-drop"
            onClick={() => {
              if (!loading) openPicker();
            }}
          >
            <span className="pdf-drop-icon" aria-hidden="true">
              {loadError ? (
                <FileWarning size={26} strokeWidth={1.6} />
              ) : (
                <FileCode2 size={26} strokeWidth={1.6} />
              )}
            </span>
            {loading ? (
              <>
                <h2>正在生成预览…</h2>
                <Spin />
              </>
            ) : loadError ? (
              <>
                <h2>没有打开这个文件</h2>
                <p>{loadError}</p>
                <Button
                  type="primary"
                  size="large"
                  icon={<FolderOpen size={16} strokeWidth={1.8} />}
                  onClick={(event) => {
                    event.stopPropagation();
                    openPicker();
                  }}
                >
                  重新选择
                </Button>
              </>
            ) : (
              <>
                <h2>拖入 PDF 开始转换</h2>
                <Button
                  type="primary"
                  size="large"
                  icon={<FolderOpen size={16} strokeWidth={1.8} />}
                  onClick={(event) => {
                    event.stopPropagation();
                    openPicker();
                  }}
                >
                  选择 PDF
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="pdf-workspace">
          <section className="pdf-stage" aria-label="转换预览">
            <header className="pdf-stage-head">
              <div className="pdf-stage-file">
                <FileText size={15} strokeWidth={1.7} aria-hidden="true" />
                <span title={file?.name}>{file?.name}</span>
              </div>
              <span className="pdf-stage-meta">{fileMeta}</span>
            </header>
            <div className="pdf-stage-body">
              <iframe
                className="pdf-preview-frame"
                title="PDF 转换预览"
                srcDoc={previewHtml}
              />
            </div>
          </section>

          <aside className="pdf-panel" aria-label="转换设置">
            <section className="pdf-export">
              <div className="pdf-export-head">
                <span className="pdf-export-title">导出</span>
                <span className="pdf-export-meta">
                  {range.indices.length} 页 · {dpi} DPI
                </span>
              </div>
              <Button
                type="primary"
                size="large"
                block
                className="pdf-export-btn"
                icon={<Download size={16} strokeWidth={1.8} />}
                loading={exporting}
                disabled={!canExport}
                onClick={() => void exportHtml()}
              >
                导出 HTML
              </Button>
            </section>

            <section className="pdf-section">
              <h2 className="pdf-section-title">文件</h2>
              <div className="pdf-file-row">
                <div className="pdf-file-text">
                  <span className="pdf-file-name" title={file?.name}>
                    {file?.name}
                  </span>
                  <span className="pdf-file-meta">{fileMeta}</span>
                </div>
                <Button
                  type="text"
                  size="small"
                  disabled={exporting}
                  onClick={openPicker}
                >
                  更换文件
                </Button>
              </div>
            </section>

            <section className="pdf-section">
              <h2 className="pdf-section-title">转换设置</h2>

              <div className="pdf-field">
                <span className="pdf-label">清晰度</span>
                <Segmented
                  block
                  size="small"
                  value={dpi}
                  options={DPI_OPTIONS}
                  onChange={(value) => setDpi(value as PdfDpi)}
                  disabled={exporting}
                />
              </div>

              <div className="pdf-field">
                <span className="pdf-label">页面范围</span>
                <Segmented
                  block
                  size="small"
                  value={rangeMode}
                  options={[
                    { label: "全部", value: "all" },
                    { label: "自定义", value: "custom" },
                  ]}
                  onChange={(value) => setRangeMode(value as RangeMode)}
                  disabled={exporting}
                />
                {rangeMode === "custom" && (
                  <Input
                    className="pdf-range-input"
                    value={rangeText}
                    placeholder="如 1-3,5,8-10"
                    status={range.error ? "error" : undefined}
                    disabled={exporting}
                    onChange={(event) => setRangeText(event.target.value)}
                  />
                )}
                {range.error && <p className="pdf-error">{range.error}</p>}
              </div>
            </section>

            {warnings.length > 0 && (
              <div className="pdf-warnings">
                {warnings.map((warning, index) => (
                  <p key={`${index}-${warning}`}>{warning}</p>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}

      <div
        className={`pdf-drop-overlay${dragging ? " is-active" : ""}`}
        aria-hidden="true"
      >
        <FileCode2 size={22} strokeWidth={1.7} />
        松开以打开 PDF
      </div>

      <Modal
        open={passwordPrompt !== null}
        title="此 PDF 需要密码"
        okText="打开"
        cancelText="取消"
        destroyOnHidden
        onOk={handlePasswordOk}
        onCancel={handlePasswordCancel}
      >
        <Input.Password
          autoFocus
          value={password}
          placeholder="请输入 PDF 密码"
          onChange={(event) => setPassword(event.target.value)}
          onPressEnter={handlePasswordOk}
        />
        {passwordPrompt?.wrong && (
          <p className="pdf-error">密码不正确，请重试。</p>
        )}
      </Modal>
    </div>
  );
}