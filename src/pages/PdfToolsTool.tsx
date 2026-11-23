import { useEffect, useState } from "react";
import {
  App as AntdApp,
  Button,
  ColorPicker,
  Input,
  InputNumber,
  Popconfirm,
  Segmented,
  Slider,
  Spin,
  Tabs,
  Tooltip,
} from "antd";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  FileStack,
  FileText,
  Image as ImageIcon,
  Info,
  Lock,
  Plus,
  X,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import HelpTip from "../components/HelpTip";
import { useToolBack } from "../hooks/useToolBack";
import { formatBytes } from "../compress/compress";
import { sanitizeFilename } from "../seal/filename";
import { isTauri } from "../seal/save";
import {
  baseName,
  MODE_LABEL,
  pagesToSpec,
  parsePageRange,
  PDF_TOOL_MODES,
  POSITIONS,
  suggestedOutputName,
  type ImageFile,
  type PdfFile,
  type PdfInfo,
  type PdfToolMode,
  type WatermarkPosition,
} from "../pdftools/common";
import "../styles/studio.css";
import "../styles/pdftools.css";

type RangeMode = "all" | "custom";

const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "bmp",
  "gif",
  "tif",
  "tiff",
];

const errorText = (error: unknown) =>
  typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : "操作失败";

const buttonLabels: Record<PdfToolMode, string> = {
  merge: "合并 PDF",
  extract: "提取页面",
  delete: "删除并保存",
  rotate: "旋转并保存",
  images: "生成 PDF",
  watermark: "添加水印",
  stamp: "盖章并保存",
  decrypt: "移除密码",
};

export default function PdfToolsTool() {
  const goBack = useToolBack();
  const { message } = AntdApp.useApp();
  const desktop = isTauri();

  const [mode, setMode] = useState<PdfToolMode>("merge");
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [running, setRunning] = useState(false);

  const [rangeMode, setRangeMode] = useState<RangeMode>("all");
  const [pageText, setPageText] = useState("");
  const [angle, setAngle] = useState<90 | 180 | 270>(90);

  const [watermarkText, setWatermarkText] = useState("内部资料");
  const [watermarkSize, setWatermarkSize] = useState(48);
  const [watermarkColor, setWatermarkColor] = useState("#b9b9b9");
  const [watermarkPosition, setWatermarkPosition] =
    useState<WatermarkPosition>("center");
  const [watermarkMargin, setWatermarkMargin] = useState(20);

  const [stampPath, setStampPath] = useState("");
  const [stampWidth, setStampWidth] = useState(30);
  const [stampPosition, setStampPosition] =
    useState<WatermarkPosition>("bottom-right");
  const [stampMargin, setStampMargin] = useState(20);

  const [imagePageSize, setImagePageSize] = useState<"a4" | "auto">("a4");
  const [imageOrientation, setImageOrientation] =
    useState<"portrait" | "landscape">("portrait");
  const [imageMargin, setImageMargin] = useState(10);

  const [password, setPassword] = useState("");

  const selectedPdf = pdfFiles[0] ?? null;
  const totalPages = selectedPdf?.pages ?? 0;
  const rangeNeeded = (
    ["extract", "delete", "rotate", "watermark", "stamp"] as PdfToolMode[]
  ).includes(mode);
  const usesAll =
    rangeMode === "all" &&
    (mode === "rotate" || mode === "watermark" || mode === "stamp");
  const range = !rangeNeeded
    ? { pages: [] as number[], error: "" }
    : usesAll
      ? totalPages > 0
        ? {
            pages: Array.from({ length: totalPages }, (_, index) => index + 1),
            error: "",
          }
        : { pages: [] as number[], error: "PDF 没有可用的页面" }
      : parsePageRange(pageText, totalPages);
  const rangeSpec = usesAll
    ? totalPages > 0
      ? `1-${totalPages}`
      : ""
    : pagesToSpec(range.pages);

  const blockedByPassword =
    mode !== "decrypt" && pdfFiles.some((file) => file.encrypted);
  const encryptedCount = pdfFiles.filter((file) => file.encrypted).length;

  const expectedPages = (() => {
    switch (mode) {
      case "merge":
        return pdfFiles.reduce((sum, file) => sum + file.pages, 0);
      case "images":
        return imageFiles.length;
      case "extract":
        return range.pages.length;
      case "delete":
        return totalPages - range.pages.length;
      case "rotate":
      case "watermark":
      case "stamp":
        return range.pages.length;
      case "decrypt":
        return null;
    }
  })();

  const canRun = (() => {
    if (!desktop || running || loadingFiles) return false;
    if (mode === "merge") {
      return pdfFiles.length >= 2 && !blockedByPassword;
    }
    if (mode === "images") return imageFiles.length > 0;
    if (mode === "decrypt") return !!selectedPdf;
    if (!selectedPdf || selectedPdf.encrypted || totalPages === 0) return false;
    if (rangeNeeded && (range.error || range.pages.length === 0)) return false;
    if (mode === "delete" && totalPages - range.pages.length <= 0) return false;
    if (mode === "watermark" && !watermarkText.trim()) return false;
    if (mode === "stamp" && !stampPath) return false;
    return true;
  })();

  const changeMode = (next: PdfToolMode) => {
    if (next === mode || running) return;
    setMode(next);
    setPdfFiles([]);
    setImageFiles([]);
    setStampPath("");
    setPassword("");
    setPageText("");
    setRangeMode("all");
  };

  const pickPdfs = async (multiple: boolean, append = false) => {
    if (!desktop) {
      message.warning("PDF 工具箱需要在桌面应用中使用");
      return;
    }
    try {
      const selected = await open({
        multiple,
        title: multiple ? "选择 PDF 文件" : "选择一个 PDF",
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      setLoadingFiles(true);
      const infos = await invoke<PdfInfo[]>("pdf_info", { paths });
      const mapped: PdfFile[] = infos.map((info) => ({
        ...info,
        name: baseName(info.path),
      }));

      if (multiple && append) {
        setPdfFiles((previous) => {
          const existing = new Set(previous.map((file) => file.path));
          return [
            ...previous,
            ...mapped.filter((file) => !existing.has(file.path)),
          ];
        });
      } else {
        setPdfFiles(multiple ? mapped : mapped.slice(0, 1));
      }
    } catch (error) {
      message.error(errorText(error));
    } finally {
      setLoadingFiles(false);
    }
  };

  const pickImages = async (append = true) => {
    if (!desktop) {
      message.warning("PDF 工具箱需要在桌面应用中使用");
      return;
    }
    try {
      const selected = await open({
        multiple: true,
        title: "选择图片",
        filters: [{ name: "图片", extensions: IMAGE_EXTENSIONS }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      const mapped: ImageFile[] = paths.map((path) => ({
        path,
        name: baseName(path),
      }));
      if (append) {
        setImageFiles((previous) => {
          const existing = new Set(previous.map((file) => file.path));
          return [
            ...previous,
            ...mapped.filter((file) => !existing.has(file.path)),
          ];
        });
      } else {
        setImageFiles(mapped);
      }
    } catch (error) {
      message.error(errorText(error));
    }
  };

  const pickStamp = async () => {
    if (!desktop) return;
    try {
      const selected = await open({
        multiple: false,
        title: "选择印章或签名图片",
        filters: [{ name: "图片", extensions: IMAGE_EXTENSIONS }],
      });
      if (typeof selected === "string") setStampPath(selected);
    } catch (error) {
      message.error(errorText(error));
    }
  };

  const movePdf = (index: number, delta: -1 | 1) => {
    setPdfFiles((previous) => {
      const target = index + delta;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const moveImage = (index: number, delta: -1 | 1) => {
    setImageFiles((previous) => {
      const target = index + delta;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const clearCurrent = () => {
    if (mode === "images") {
      setImageFiles([]);
    } else {
      setPdfFiles([]);
    }
    setStampPath("");
    setPassword("");
    setPageText("");
  };

  const run = async () => {
    if (!canRun) return;
    if (mode !== "images" && mode !== "merge" && !selectedPdf) return;

    let output: string | null;
    try {
      output = await save({
        defaultPath: sanitizeFilename(
          suggestedOutputName(
            mode,
            selectedPdf?.name ?? pdfFiles[0]?.name,
          ),
          "PDF",
        ),
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
    } catch (error) {
      message.error(errorText(error));
      return;
    }
    if (!output) return;
    const finalOutput = /\.pdf$/i.test(output) ? output : `${output}.pdf`;

    setRunning(true);
    try {
      let pageCount: number | null = null;

      switch (mode) {
        case "merge":
          pageCount = await invoke<number>("pdf_merge", {
            paths: pdfFiles.map((file) => file.path),
            output: finalOutput,
          });
          break;
        case "extract":
          pageCount = await invoke<number>("pdf_extract", {
            path: selectedPdf!.path,
            pages: rangeSpec,
            output: finalOutput,
          });
          break;
        case "delete":
          pageCount = await invoke<number>("pdf_delete", {
            path: selectedPdf!.path,
            pages: rangeSpec,
            output: finalOutput,
          });
          break;
        case "rotate":
          pageCount = await invoke<number>("pdf_rotate", {
            path: selectedPdf!.path,
            pages: rangeSpec,
            degrees: angle,
            output: finalOutput,
          });
          break;
        case "images":
          pageCount = await invoke<number>("pdf_images_to_pdf", {
            paths: imageFiles.map((file) => file.path),
            output: finalOutput,
            pageSize: imagePageSize,
            orientation: imageOrientation,
            marginMm: imageMargin,
          });
          break;
        case "watermark":
          pageCount = await invoke<number>("pdf_watermark", {
            path: selectedPdf!.path,
            output: finalOutput,
            text: watermarkText.trim(),
            pages: rangeSpec,
            size: watermarkSize,
            color: watermarkColor,
            position: watermarkPosition,
            marginMm: watermarkMargin,
          });
          break;
        case "stamp":
          pageCount = await invoke<number>("pdf_stamp", {
            path: selectedPdf!.path,
            output: finalOutput,
            imagePath: stampPath,
            pages: rangeSpec,
            widthPercent: stampWidth,
            position: stampPosition,
            marginMm: stampMargin,
          });
          break;
        case "decrypt":
          await invoke("pdf_decrypt", {
            path: selectedPdf!.path,
            password,
            output: finalOutput,
          });
          break;
      }

      message.success(
        pageCount === null
          ? `已保存：${finalOutput}`
          : `已保存 ${pageCount} 页：${finalOutput}`,
      );
    } catch (error) {
      message.error(errorText(error));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || running) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, [contenteditable='true'], .ant-select, .ant-popover, .ant-modal, .ant-color-picker",
        )
      ) {
        return;
      }
      if (
        document.querySelector(
          ".ant-popover:not(.ant-popover-hidden), .ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-modal-wrap, .ant-color-picker",
        )
      ) {
        return;
      }
      goBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, running]);

  const rangeSection = (title: string, withAll: boolean) => (
    <section className="studio-section">
      <h3 className="studio-section-title">{title}</h3>
      {withAll && (
        <Segmented
          block
          className="studio-segmented"
          value={rangeMode}
          options={[
            { label: "全部页面", value: "all" },
            { label: "自定义", value: "custom" },
          ]}
          onChange={(value) => setRangeMode(value as RangeMode)}
          disabled={running}
        />
      )}
      {(withAll ? rangeMode === "custom" : true) && (
        <Input
          value={pageText}
          placeholder="如 1-3,5,8-10"
          status={range.error && pageText.trim() ? "error" : undefined}
          disabled={running}
          onChange={(event) => setPageText(event.target.value)}
        />
      )}
      {range.error && totalPages > 0 && (pageText.trim() || withAll) && (
        <p className="studio-error">{range.error}</p>
      )}
      <div className="pdftool-range-help">
        <span>{usesAll ? "全部页面" : "已选页面"}</span>
        <strong>
          {range.pages.length} / {totalPages} 页
        </strong>
      </div>
      {mode === "delete" && (
        <div className="pdftool-range-help">
          <span>保留页面</span>
          <strong>{Math.max(0, totalPages - range.pages.length)} 页</strong>
        </div>
      )}
    </section>
  );

  const contentLabel =
    mode === "images" ? `${imageFiles.length} 张图片` : `${pdfFiles.length} 个 PDF`;

  const cardTitle =
    mode === "merge"
      ? `${pdfFiles.length} 个 PDF`
      : mode === "images"
        ? `${imageFiles.length} 张图片`
        : "PDF 文件";

  const cardMeta =
    mode === "merge"
      ? `${pdfFiles.reduce((sum, file) => sum + file.pages, 0)} 页 · ${formatBytes(
          pdfFiles.reduce((sum, file) => sum + file.size, 0),
        )}`
      : mode === "images"
        ? ""
        : selectedPdf
          ? `${selectedPdf.pages} 页 · ${formatBytes(selectedPdf.size)}`
          : "";

  const panelMeta =
    mode === "images"
      ? contentLabel
      : mode === "merge"
        ? `${expectedPages ?? 0} 页`
        : selectedPdf
          ? `${selectedPdf.pages} 页`
          : "";

  const emptyPdfHint =
    mode === "merge"
      ? "按列表顺序合并为一个 PDF，可上移或下移调整顺序。"
      : mode === "extract"
        ? "把指定页面复制到一个新的 PDF。"
        : mode === "delete"
          ? "删除指定页面，保留其余页面。"
          : mode === "rotate"
            ? "按页码旋转页面，内容保持矢量。"
            : mode === "watermark"
              ? "给指定页面添加文字水印。"
              : mode === "stamp"
                ? "给指定页面盖上印章或签名图片。"
                : "输入密码后另存为无密码副本。";

  return (
    <div className="tool-page studio-page pdftools-page">
      <h1 className="visually-hidden">PDF 工具箱</h1>

      <div className="studio-topbar">
        <Button
          type="text"
          className="back-btn"
          icon={<ArrowLeft size={16} strokeWidth={1.8} />}
          onClick={goBack}
        >
          返回工作台
        </Button>
      </div>

      {!desktop && (
        <div className="pdftool-warning" style={{ marginBottom: 14 }}>
          <Info size={15} strokeWidth={1.8} />
          <span>PDF 工具箱需要在桌面应用中使用。</span>
        </div>
      )}

      <Tabs
        className="studio-mode-tabs"
        activeKey={mode}
        onChange={(key) => changeMode(key as PdfToolMode)}
        items={PDF_TOOL_MODES.map(({ value, label }) => ({
          key: value,
          label,
        }))}
      />

      <div className="studio-workspace">
        <section
          className="studio-card pdftool-file-card"
          aria-label={mode === "images" ? "待转换图片" : "PDF 文件"}
        >
          <header className="studio-card-head">
            <div className="studio-card-title">
              <strong>{cardTitle}</strong>
              {cardMeta && <span>{cardMeta}</span>}
            </div>
            <div className="studio-card-actions">
              {mode === "merge" && (
                <Button
                  size="small"
                  icon={<Plus size={14} strokeWidth={1.8} />}
                  disabled={running || loadingFiles}
                  onClick={() => void pickPdfs(true, true)}
                >
                  添加 PDF
                </Button>
              )}
              {mode === "images" && (
                <Button
                  size="small"
                  icon={<Plus size={14} strokeWidth={1.8} />}
                  disabled={running}
                  onClick={() => void pickImages(true)}
                >
                  添加图片
                </Button>
              )}
              {mode !== "merge" &&
                mode !== "images" &&
                selectedPdf && (
                  <Button
                    size="small"
                    disabled={running || loadingFiles}
                    onClick={() => void pickPdfs(false)}
                  >
                    更换
                  </Button>
                )}
              {(pdfFiles.length > 0 || imageFiles.length > 0) && (
                <Popconfirm
                  title={
                    mode === "images" ? "清空全部图片？" : "清空全部 PDF？"
                  }
                  okText="清空"
                  cancelText="取消"
                  placement="bottomRight"
                  onConfirm={clearCurrent}
                >
                  <Button size="small" type="text" disabled={running}>
                    清空
                  </Button>
                </Popconfirm>
              )}
            </div>
          </header>

          {loadingFiles ? (
            <div className="pdftool-spin">
              <Spin />
            </div>
          ) : mode === "images" ? (
            imageFiles.length === 0 ? (
              <div className="pdftool-empty">
                <span className="pdftool-file-icon" aria-hidden="true">
                  <ImageIcon size={22} strokeWidth={1.6} />
                </span>
                <h2>选择图片生成 PDF</h2>
                <p>
                  每张图片一页，按列表顺序排列。支持 JPG、PNG、WebP、BMP、GIF、TIFF。
                </p>
                <Button
                  type="primary"
                  size="large"
                  onClick={() => void pickImages(false)}
                >
                  选择图片
                </Button>
              </div>
            ) : (
              <div className="studio-rows">
                {imageFiles.map((file, index) => (
                  <div className="studio-row" key={file.path}>
                    <span className="studio-row-index">{index + 1}</span>
                    <span
                      className="pdftool-file-icon is-muted"
                      aria-hidden="true"
                    >
                      <ImageIcon size={18} strokeWidth={1.6} />
                    </span>
                    <span className="studio-row-text">
                      <span className="studio-name" title={file.name}>
                        {file.name}
                      </span>
                      <span className="studio-meta">图片</span>
                    </span>
                    <div className="pdftool-row-order">
                      <Tooltip title="上移">
                        <Button
                          type="text"
                          size="small"
                          aria-label={`上移 ${file.name}`}
                          icon={<ArrowUp size={14} strokeWidth={1.8} />}
                          disabled={index === 0 || running}
                          onClick={() => moveImage(index, -1)}
                        />
                      </Tooltip>
                      <Tooltip title="下移">
                        <Button
                          type="text"
                          size="small"
                          aria-label={`下移 ${file.name}`}
                          icon={<ArrowDown size={14} strokeWidth={1.8} />}
                          disabled={
                            index === imageFiles.length - 1 || running
                          }
                          onClick={() => moveImage(index, 1)}
                        />
                      </Tooltip>
                    </div>
                    <Tooltip title="移除">
                      <Button
                        type="text"
                        size="small"
                        className="studio-icon-btn"
                        aria-label={`移除 ${file.name}`}
                        icon={<X size={15} strokeWidth={1.8} />}
                        disabled={running}
                        onClick={() =>
                          setImageFiles((previous) =>
                            previous.filter((item) => item.path !== file.path),
                          )
                        }
                      />
                    </Tooltip>
                  </div>
                ))}
              </div>
            )
          ) : pdfFiles.length === 0 ? (
            <div className="pdftool-empty">
              <span className="pdftool-file-icon" aria-hidden="true">
                <FileStack size={22} strokeWidth={1.6} />
              </span>
              <h2>
                {mode === "merge"
                  ? "选择两个以上的 PDF"
                  : mode === "decrypt"
                    ? "选择需要移除密码的 PDF"
                    : "选择一个 PDF"}
              </h2>
              <p>{emptyPdfHint}</p>
              <Button
                type="primary"
                size="large"
                onClick={() => void pickPdfs(mode === "merge", mode === "merge")}
              >
                {mode === "merge" ? "选择 PDF 文件" : "选择 PDF"}
              </Button>
            </div>
          ) : (
            <div className="studio-rows">
              {pdfFiles.map((file, index) => (
                <div className="studio-row" key={file.path}>
                  {mode === "merge" && (
                    <span className="studio-row-index">{index + 1}</span>
                  )}
                  <span
                    className="pdftool-file-icon is-muted"
                    aria-hidden="true"
                  >
                    <FileText size={18} strokeWidth={1.6} />
                  </span>
                  <span className="studio-row-text">
                    <span className="studio-name" title={file.name}>
                      {file.name}
                    </span>
                    <span className="studio-meta">
                      {file.encrypted ? (
                        <>
                          <span className="pdftool-lock">
                            <Lock size={12} strokeWidth={1.8} />
                            已加密或无法读取 · {formatBytes(file.size)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>{file.pages} 页</span>
                          <span className="studio-sep">·</span>
                          <span>{formatBytes(file.size)}</span>
                        </>
                      )}
                    </span>
                  </span>
                  {mode === "merge" && (
                    <div className="pdftool-row-order">
                      <Tooltip title="上移">
                        <Button
                          type="text"
                          size="small"
                          aria-label={`上移 ${file.name}`}
                          icon={<ArrowUp size={14} strokeWidth={1.8} />}
                          disabled={index === 0 || running}
                          onClick={() => movePdf(index, -1)}
                        />
                      </Tooltip>
                      <Tooltip title="下移">
                        <Button
                          type="text"
                          size="small"
                          aria-label={`下移 ${file.name}`}
                          icon={<ArrowDown size={14} strokeWidth={1.8} />}
                          disabled={index === pdfFiles.length - 1 || running}
                          onClick={() => movePdf(index, 1)}
                        />
                      </Tooltip>
                    </div>
                  )}
                  <Tooltip title="移除">
                    <Button
                      type="text"
                      size="small"
                      className="studio-icon-btn"
                      aria-label={`移除 ${file.name}`}
                      icon={<X size={15} strokeWidth={1.8} />}
                      disabled={running}
                      onClick={() =>
                        setPdfFiles((previous) =>
                          previous.filter((item) => item.path !== file.path),
                        )
                      }
                    />
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="studio-panel" aria-label="操作设置">
          <div className="studio-panel-head">
            <h2 className="studio-panel-title">{MODE_LABEL(mode)}</h2>
            {panelMeta && <span className="studio-panel-meta">{panelMeta}</span>}
          </div>

          {blockedByPassword && (
            <section className="studio-section">
              <div className="pdftool-warning">
                <Lock size={15} strokeWidth={1.8} />
                <span>
                  {encryptedCount} 个 PDF 已加密或无法读取。请先在「移除密码」中保存无密码副本，再继续处理。
                </span>
              </div>
            </section>
          )}

          {mode === "merge" && (
            <section className="studio-section">
              <h3 className="studio-section-title">合并顺序</h3>
              <div className="pdftool-summary">
                <div className="pdftool-summary-row">
                  <span>文件</span>
                  <strong>{pdfFiles.length} 个</strong>
                </div>
                <div className="pdftool-summary-row">
                  <span>合并后</span>
                  <strong>{expectedPages ?? 0} 页</strong>
                </div>
              </div>
            </section>
          )}

          {mode === "extract" && rangeSection("提取页面", false)}
          {mode === "delete" && rangeSection("删除页面", false)}

          {mode === "rotate" && (
            <>
              {rangeSection("应用页面", true)}
              <section className="studio-section">
                <h3 className="studio-section-title">旋转方向</h3>
                <Segmented
                  block
                  className="studio-segmented"
                  value={angle}
                  options={[
                    { label: "顺时针 90°", value: 90 },
                    { label: "180°", value: 180 },
                    { label: "顺时针 270°", value: 270 },
                  ]}
                  onChange={(value) =>
                    setAngle(value as 90 | 180 | 270)
                  }
                  disabled={running}
                />
              </section>
            </>
          )}

          {mode === "images" && (
            <>
              <section className="studio-section">
                <h3 className="studio-section-title">
                  页面
                  <HelpTip text="图片会按比例缩放并居中，不会裁掉画面。" />
                </h3>
                <div className="studio-field">
                  <span className="studio-label">纸张大小</span>
                  <Segmented
                    block
                    className="studio-segmented"
                    value={imagePageSize}
                    options={[
                      { label: "A4", value: "a4" },
                      { label: "图片原尺寸", value: "auto" },
                    ]}
                    onChange={(value) =>
                      setImagePageSize(value as "a4" | "auto")
                    }
                    disabled={running}
                  />
                </div>
                {imagePageSize === "a4" && (
                  <div className="studio-field">
                    <span className="studio-label">方向</span>
                    <Segmented
                      block
                      className="studio-segmented"
                      value={imageOrientation}
                      options={[
                        { label: "纵向", value: "portrait" },
                        { label: "横向", value: "landscape" },
                      ]}
                      onChange={(value) =>
                        setImageOrientation(
                          value as "portrait" | "landscape",
                        )
                      }
                      disabled={running}
                    />
                  </div>
                )}
                <div className="studio-field">
                  <span className="studio-label">页边距</span>
                  <div className="studio-row-inline">
                    <InputNumber
                      value={imageMargin}
                      min={0}
                      max={50}
                      precision={0}
                      controls={false}
                      suffix="mm"
                      aria-label="页边距"
                      disabled={running}
                      onChange={(value) => setImageMargin(value ?? 0)}
                    />
                  </div>
                </div>
              </section>
            </>
          )}

          {mode === "watermark" && (
            <>
              <section className="studio-section">
                <h3 className="studio-section-title">水印内容</h3>
                <Input
                  value={watermarkText}
                  maxLength={80}
                  placeholder="输入水印文字"
                  disabled={running}
                  onChange={(event) => setWatermarkText(event.target.value)}
                />
                <div className="studio-two-col">
                  <div className="studio-field">
                    <span className="studio-label">
                      字号
                      <HelpTip text="文字水印会嵌入中文字体，输出文件可能增加几 MB。" />
                    </span>
                    <InputNumber
                      value={watermarkSize}
                      min={8}
                      max={200}
                      precision={0}
                      controls={false}
                      suffix="pt"
                      aria-label="水印字号"
                      disabled={running}
                      onChange={(value) => setWatermarkSize(value ?? 48)}
                    />
                  </div>
                  <div className="studio-field">
                    <span className="studio-label">颜色</span>
                    <ColorPicker
                      value={watermarkColor}
                      disabledAlpha
                      showText
                      disabled={running}
                      onChange={(color) =>
                        setWatermarkColor(color.toHexString().slice(0, 7))
                      }
                    />
                  </div>
                </div>
                <div className="studio-field">
                  <span className="studio-label">位置</span>
                  <div className="position-grid" role="group" aria-label="水印位置">
                    {POSITIONS.map((position) => (
                      <button
                        key={position.value}
                        type="button"
                        title={position.label}
                        aria-label={position.label}
                        aria-pressed={watermarkPosition === position.value}
                        className={
                          watermarkPosition === position.value
                            ? "is-active"
                            : undefined
                        }
                        onClick={() => setWatermarkPosition(position.value)}
                      />
                    ))}
                  </div>
                </div>
                <div className="studio-field">
                  <span className="studio-label">边距</span>
                  <InputNumber
                    value={watermarkMargin}
                    min={0}
                    max={100}
                    precision={0}
                    controls={false}
                    suffix="mm"
                    aria-label="水印边距"
                    disabled={running}
                    onChange={(value) => setWatermarkMargin(value ?? 0)}
                  />
                </div>
              </section>
              {rangeSection("应用页面", true)}
            </>
          )}

          {mode === "stamp" && (
            <>
              <section className="studio-section">
                <h3 className="studio-section-title">
                  印章图片
                  <HelpTip text="建议使用透明底 PNG。" />
                </h3>
                <div className="pdftool-stamp-picker">
                  <span className="pdftool-stamp-name" title={stampPath}>
                    {stampPath ? baseName(stampPath) : ""}
                  </span>
                  <Button
                    size="small"
                    disabled={running}
                    onClick={() => void pickStamp()}
                  >
                    {stampPath ? "更换" : "选择"}
                  </Button>
                </div>
                <div className="studio-field">
                  <div className="studio-label-row">
                    <span className="studio-label">宽度</span>
                    <span className="studio-value">{stampWidth}% 页宽</span>
                  </div>
                  <Slider
                    min={5}
                    max={100}
                    value={stampWidth}
                    disabled={running}
                    onChange={(value) => setStampWidth(value)}
                  />
                </div>
                <div className="studio-field">
                  <span className="studio-label">位置</span>
                  <div className="position-grid" role="group" aria-label="印章位置">
                    {POSITIONS.map((position) => (
                      <button
                        key={position.value}
                        type="button"
                        title={position.label}
                        aria-label={position.label}
                        aria-pressed={stampPosition === position.value}
                        className={
                          stampPosition === position.value
                            ? "is-active"
                            : undefined
                        }
                        onClick={() => setStampPosition(position.value)}
                      />
                    ))}
                  </div>
                </div>
                <div className="studio-field">
                  <span className="studio-label">边距</span>
                  <InputNumber
                    value={stampMargin}
                    min={0}
                    max={100}
                    precision={0}
                    controls={false}
                    suffix="mm"
                    aria-label="印章边距"
                    disabled={running}
                    onChange={(value) => setStampMargin(value ?? 0)}
                  />
                </div>
              </section>
              {rangeSection("应用页面", true)}
            </>
          )}

          {mode === "decrypt" && (
            <section className="studio-section">
              <h3 className="studio-section-title">
                  PDF 密码
                  {selectedPdf && !selectedPdf.encrypted && (
                    <HelpTip text="未检测到密码，仍可另存副本。" />
                  )}
                </h3>
              <div className="pdftool-password-row">
                <Input.Password
                  value={password}
                  autoComplete="off"
                  placeholder="输入 PDF 的打开密码"
                  disabled={running}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </section>
          )}

          <section className="studio-result">
            <div className="studio-result-head">
              <span className="studio-result-title">输出</span>
              <span className="studio-status">
                {expectedPages === null
                  ? "无密码副本"
                  : `预计 ${Math.max(0, expectedPages)} 页`}
              </span>
            </div>

            <div className="pdftool-summary">
              <div className="pdftool-summary-row">
                <span>方式</span>
                <strong>{MODE_LABEL(mode)}</strong>
              </div>
              <div className="pdftool-summary-row">
                <span>{mode === "images" ? "图片" : "文件"}</span>
                <strong>
                  {mode === "images" ? imageFiles.length : pdfFiles.length}
                </strong>
              </div>
              {expectedPages !== null && (
                <div className="pdftool-summary-row">
                  <span>输出页数</span>
                  <strong>{Math.max(0, expectedPages)} 页</strong>
                </div>
              )}
            </div>

            <Button
              type="primary"
              size="large"
              block
              className="studio-export"
              icon={<Download size={16} strokeWidth={1.8} />}
              loading={running}
              disabled={!canRun}
              onClick={() => void run()}
            >
              {running ? "处理中…" : buttonLabels[mode]}
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}