import { useCallback, useEffect, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  ColorPicker,
  Modal,
  Popconfirm,
  Segmented,
  Slider,
  Spin,
  Tooltip,
} from "antd";
import {
  ArrowLeft,
  Download,
  FileImage,
  ImageOff,
  ImagePlus,
  Plus,
  X,
} from "lucide-react";
import HelpTip from "../components/HelpTip";
import { useToolBack } from "../hooks/useToolBack";
import {
  canvasToBlob,
  clampQuality,
  decodeImage,
  FORMAT_EXT,
  formatLabel,
  isHeic,
  isSupportedRaster,
  makeCanvas,
  outputFilename,
  sourceFormatLabel,
  sourceFormatOf,
  type RasterFormat,
  type SourceFormat,
} from "../image/io";
import { dedupeFilename, formatBytes } from "../compress/compress";
import { exportBatch } from "../compress/export";
import { saveExport } from "../seal/save";
import "../styles/studio.css";

interface SourceItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

interface ConvertResult {
  blob: Blob;
  width: number;
  height: number;
  sourceFormat: SourceFormat;
  format: RasterFormat;
}

type Job =
  | { status: "working" }
  | { status: "done"; result: ConvertResult; settingsKey: string }
  | { status: "error"; message: string; settingsKey: string };

interface ConvertSettings {
  format: RasterFormat;
  quality: number;
  background: string;
}

const DEFAULT_SETTINGS: ConvertSettings = {
  format: "jpeg",
  quality: 92,
  background: "#ffffff",
};

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const fileKey = (file: File) =>
  `${file.name}:${file.size}:${file.lastModified}`;

const settingsKeyOf = (settings: ConvertSettings) =>
  `${settings.format}:${settings.quality}:${settings.background}`;

async function convertFile(
  file: File,
  settings: ConvertSettings,
  isCurrent: () => boolean,
): Promise<ConvertResult> {
  const sourceFormat = sourceFormatOf(file);
  const bitmap = await decodeImage(file);
  if (!isCurrent()) throw new Error("已取消");
  try {
    const width = bitmap.width;
    const height = bitmap.height;
    if (!width || !height) throw new Error("无法读取这张图片");

    const canvas = makeCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建画布");
    if (settings.format === "jpeg") {
      context.fillStyle = settings.background;
      context.fillRect(0, 0, width, height);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToBlob(
      canvas,
      settings.format,
      settings.format === "png" ? undefined : clampQuality(settings.quality),
    );
    if (!isCurrent()) throw new Error("已取消");
    return {
      blob,
      width,
      height,
      sourceFormat,
      format: settings.format,
    };
  } finally {
    bitmap.close();
  }
}

export default function ConvertTool() {
  const goBack = useToolBack();
  const { message } = AntdApp.useApp();

  const [sources, setSources] = useState<SourceItem[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [settings, setSettings] = useState<ConvertSettings>(DEFAULT_SETTINGS);
  const [dragging, setDragging] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const sourcesRef = useRef<SourceItem[]>([]);
  const jobsRef = useRef<Record<string, Job>>({});
  const runRef = useRef(0);
  const dragDepth = useRef(0);

  const commitSources = useCallback((next: SourceItem[]) => {
    sourcesRef.current = next;
    setSources(next);
  }, []);

  const applyJobs = useCallback((next: Record<string, Job>) => {
    jobsRef.current = next;
    setJobs(next);
  }, []);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      if (incoming.length === 0) return;

      const supported = incoming.filter(isSupportedRaster);
      const heicCount = incoming.filter(isHeic).length;
      const unsupported = incoming.length - supported.length - heicCount;
      const existing = new Set(
        sourcesRef.current.map((item) => fileKey(item.file)),
      );
      const fresh: SourceItem[] = [];
      let duplicates = 0;

      for (const file of supported) {
        if (existing.has(fileKey(file))) {
          duplicates += 1;
          continue;
        }
        fresh.push({
          id: makeId(),
          file,
          name: file.name,
          size: file.size,
          previewUrl: URL.createObjectURL(file),
        });
      }

      if (fresh.length > 0) {
        commitSources([...sourcesRef.current, ...fresh]);
      }

      const notes: string[] = [];
      if (heicCount > 0) notes.push(`${heicCount} 个 HEIC 暂不支持`);
      if (unsupported > 0) notes.push(`${unsupported} 个格式不支持`);
      if (duplicates > 0) notes.push(`${duplicates} 张重复`);
      if (notes.length > 0) message.warning(`已跳过：${notes.join("，")}`);
    },
    [commitSources, message],
  );

  const removeSource = (id: string) => {
    const target = sourcesRef.current.find((item) => item.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    commitSources(sourcesRef.current.filter((item) => item.id !== id));
    const nextJobs = { ...jobsRef.current };
    delete nextJobs[id];
    applyJobs(nextJobs);
    setPreviewId((current) => (current === id ? null : current));
  };

  const clearAll = () => {
    for (const item of sourcesRef.current) {
      URL.revokeObjectURL(item.previewUrl);
    }
    commitSources([]);
    applyJobs({});
    setPreviewId(null);
  };

  const openPicker = () => inputRef.current?.click();

  useEffect(
    () => () => {
      for (const item of sourcesRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    },
    [],
  );

  useEffect(() => {
    if (sources.length === 0) {
      applyJobs({});
      return;
    }

    const settingsKey = settingsKeyOf(settings);
    const targets = sources.filter((source) => {
      const job = jobsRef.current[source.id];
      if (!job || job.status === "working") return true;
      return job.settingsKey !== settingsKey;
    });
    if (targets.length === 0) return;

    const run = ++runRef.current;
    const isCurrent = () => runRef.current === run;

    const timer = window.setTimeout(() => {
      if (!isCurrent()) return;
      const next = { ...jobsRef.current };
      for (const source of targets) next[source.id] = { status: "working" };
      applyJobs(next);

      let cursor = 0;
      const worker = async () => {
        while (cursor < targets.length) {
          const source = targets[cursor];
          cursor += 1;
          if (!isCurrent()) return;
          try {
            const result = await convertFile(source.file, settings, isCurrent);
            if (!isCurrent()) return;
            applyJobs({
              ...jobsRef.current,
              [source.id]: { status: "done", result, settingsKey },
            });
          } catch (error) {
            if (!isCurrent()) return;
            applyJobs({
              ...jobsRef.current,
              [source.id]: {
                status: "error",
                message:
                  error instanceof Error ? error.message : "转换失败",
                settingsKey,
              },
            });
          }
        }
      };
      void Promise.all(
        Array.from({ length: Math.min(3, targets.length) }, () => worker()),
      );
    }, 160);

    return () => {
      window.clearTimeout(timer);
      runRef.current += 1;
    };
  }, [sources, settings, applyJobs]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (previewId) return;
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
  }, [goBack, previewId]);

  const previewSource = previewId
    ? (sources.find((item) => item.id === previewId) ?? null)
    : null;
  const previewJob = previewSource ? jobs[previewSource.id] : undefined;
  const previewResult = previewJob?.status === "done" ? previewJob.result : null;

  useEffect(() => {
    if (!previewResult) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewResult.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewResult]);

  const doneCount = sources.filter(
    (item) => jobs[item.id]?.status === "done",
  ).length;
  const errorCount = sources.filter(
    (item) => jobs[item.id]?.status === "error",
  ).length;
  const workingCount = sources.length - doneCount - errorCount;
  const settingsKey = settingsKeyOf(settings);
  const stale = sources.some((item) => {
    const job = jobs[item.id];
    return !!job && job.status !== "working" && job.settingsKey !== settingsKey;
  });
  const settled = sources.length > 0 && workingCount === 0;
  const statsReady = settled && !stale;

  const originalTotal = sources.reduce((sum, item) => sum + item.size, 0);
  const outputTotal = sources.reduce((sum, item) => {
    const job = jobs[item.id];
    return job?.status === "done" ? sum + job.result.blob.size : sum;
  }, 0);
  const doneOriginal = sources.reduce((sum, item) => {
    return jobs[item.id]?.status === "done" ? sum + item.size : sum;
  }, 0);
  const savedPercent =
    doneOriginal > 0
      ? Math.round((1 - outputTotal / doneOriginal) * 100)
      : 0;

  const statusText = stale
    ? "正在更新…"
    : workingCount > 0
      ? `已完成 ${doneCount}/${sources.length}`
      : errorCount > 0
        ? `${errorCount} 张未能转换`
        : "全部完成";

  const exportAll = async () => {
    if (stale || workingCount > 0) return;
    const used = new Set<string>();
    const files = sources.flatMap((source) => {
      const job = jobs[source.id];
      if (job?.status !== "done") return [];
      return [
        {
          filename: dedupeFilename(
            outputFilename(source.name, "_转换", job.result.format),
            used,
          ),
          blob: job.result.blob,
        },
      ];
    });
    if (files.length === 0) return;

    setExporting(true);
    try {
      const result = await exportBatch(files);
      if (result.status === "saved") {
        const skipped = errorCount > 0 ? `，${errorCount} 张未导出` : "";
        message.success(
          result.path
            ? `已导出 ${result.count} 张图片${skipped}`
            : `已开始下载 ${result.count} 张图片${skipped}`,
        );
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const exportOne = async (source: SourceItem) => {
    const job = jobs[source.id];
    if (job?.status !== "done" || stale) return;
    setSavingId(source.id);
    try {
      const bytes = new Uint8Array(await job.result.blob.arrayBuffer());
      const result = await saveExport(
        bytes,
        outputFilename(source.name, "_转换", job.result.format),
        FORMAT_EXT[job.result.format],
      );
      if (result.status === "saved") message.success(`已导出：${result.path}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setSavingId(null);
    }
  };

  const carriesFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes("Files");

  const onDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (event.dataTransfer.files.length > 0) {
      addFiles(event.dataTransfer.files);
    }
  };

  const updateSettings = (patch: Partial<ConvertSettings>) =>
    setSettings((previous) => ({ ...previous, ...patch }));

  const previewMeta = (() => {
    if (!previewSource) return "";
    if (previewJob?.status === "done") {
      const result = previewJob.result;
      return `${sourceFormatLabel(result.sourceFormat)} → ${formatLabel(result.format)} · ${result.width}×${result.height} · ${formatBytes(previewSource.size)} → ${formatBytes(result.blob.size)}`;
    }
    return `${formatBytes(previewSource.size)}`;
  })();

  return (
    <div
      className="tool-page studio-page"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <h1 className="visually-hidden">图片格式转换</h1>

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

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif"
        multiple
        tabIndex={-1}
        className="visually-hidden"
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {sources.length === 0 ? (
        <div className="studio-empty-wrap">
          <div className="studio-drop" onClick={openPicker}>
            <span className="studio-drop-icon" aria-hidden="true">
              <FileImage size={26} strokeWidth={1.6} />
            </span>
            <h2>拖入图片开始转换</h2>
            <p>支持 JPG、PNG、WebP、GIF、BMP、AVIF，可一次选择多张。</p>
            <Button
              type="primary"
              size="large"
              icon={<ImagePlus size={16} strokeWidth={1.8} />}
              onClick={(event) => {
                event.stopPropagation();
                openPicker();
              }}
            >
              选择图片
            </Button>
          </div>
        </div>
      ) : (
        <div className="studio-workspace">
          <section className="studio-card" aria-label="待转换图片">
            <header className="studio-card-head">
              <div className="studio-card-title">
                <strong>{sources.length} 张图片</strong>
                <span>{formatBytes(originalTotal)}</span>
              </div>
              <div className="studio-card-actions">
                <Button
                  size="small"
                  icon={<Plus size={14} strokeWidth={1.8} />}
                  onClick={openPicker}
                >
                  添加图片
                </Button>
                <Popconfirm
                  title="清空全部图片？"
                  okText="清空"
                  cancelText="取消"
                  placement="bottomRight"
                  onConfirm={clearAll}
                >
                  <Button size="small" type="text">
                    清空
                  </Button>
                </Popconfirm>
              </div>
            </header>

            <div className="studio-rows">
              {sources.map((item) => {
                const job = jobs[item.id];
                const done = job?.status === "done" ? job.result : null;
                return (
                  <div className="studio-row" key={item.id}>
                    <button
                      type="button"
                      className="studio-row-open"
                      aria-label={`预览 ${item.name}`}
                      onClick={() => setPreviewId(item.id)}
                    >
                      <span className="studio-thumb" aria-hidden="true">
                        {job?.status === "error" ? (
                          <ImageOff size={16} strokeWidth={1.7} />
                        ) : (
                          <img
                            src={item.previewUrl}
                            alt=""
                            loading="lazy"
                            draggable={false}
                          />
                        )}
                      </span>
                      <span className="studio-row-text">
                        <span className="studio-name" title={item.name}>
                          {item.name}
                        </span>
                        <span
                          className={`studio-meta${job?.status === "error" ? " is-error" : ""}`}
                        >
                          {job?.status === "error" ? (
                            <>
                              <span>{formatBytes(item.size)}</span>
                              <span className="studio-sep">·</span>
                              <span>{job.message}</span>
                            </>
                          ) : !done ? (
                            <>
                              <span>{formatBytes(item.size)}</span>
                              <span className="studio-sep">·</span>
                              <span className="studio-busy">
                                <Spin size="small" />
                                转换中…
                              </span>
                            </>
                          ) : (
                            <>
                              <span>
                                {done.width}×{done.height}
                              </span>
                              <span className="studio-sep">·</span>
                              <span>
                                {formatBytes(item.size)}
                                <span className="studio-arrow">→</span>
                                {formatBytes(done.blob.size)}
                              </span>
                              <span className="studio-sep">·</span>
                              <span>{formatLabel(done.format)}</span>
                            </>
                          )}
                        </span>
                      </span>
                    </button>

                    <div className="studio-row-actions">
                      <Tooltip title="导出这张">
                        <Button
                          type="text"
                          size="small"
                          className="studio-icon-btn"
                          aria-label={`导出 ${item.name}`}
                          icon={<Download size={15} strokeWidth={1.8} />}
                          loading={savingId === item.id}
                          disabled={!done || stale}
                          onClick={() => void exportOne(item)}
                        />
                      </Tooltip>
                      <Tooltip title="移除">
                        <Button
                          type="text"
                          size="small"
                          className="studio-icon-btn"
                          aria-label={`移除 ${item.name}`}
                          icon={<X size={15} strokeWidth={1.8} />}
                          onClick={() => removeSource(item.id)}
                        />
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="studio-panel" aria-label="转换设置">
            <div className="studio-panel-head">
              <h2 className="studio-panel-title">转换设置</h2>
              <span className="studio-panel-meta">
                {settings.format === "png" ? "无损" : `质量 ${settings.quality}`}
              </span>
            </div>

            <section className="studio-section">
              <h3 className="studio-section-title">
                输出格式
                <HelpTip
                  text={
                    settings.format === "jpeg"
                      ? "兼容性最好；透明区域会填充背景色。"
                      : settings.format === "png"
                        ? "保留透明背景，适合图标与截图。"
                        : "体积更小，保留透明背景，现代浏览器与手机都支持。"
                  }
                />
              </h3>
              <Segmented
                block
                className="studio-segmented"
                value={settings.format}
                options={[
                  { label: "JPG", value: "jpeg" },
                  { label: "PNG", value: "png" },
                  { label: "WebP", value: "webp" },
                ]}
                onChange={(value) =>
                  updateSettings({ format: value as RasterFormat })
                }
              />
            </section>

            {settings.format !== "png" && (
              <section className="studio-section">
                <div className="studio-label-row">
                  <h3 className="studio-section-title">质量</h3>
                  <span className="studio-value">{settings.quality}</span>
                </div>
                <Slider
                  min={30}
                  max={100}
                  value={settings.quality}
                  onChange={(value) => updateSettings({ quality: value })}
                />
              </section>
            )}

            {settings.format === "jpeg" && (
              <section className="studio-section">
                <h3 className="studio-section-title">
                背景色
                <HelpTip text="透明区域会铺上这个颜色。" />
              </h3>
                <div className="studio-row-inline">
                  <ColorPicker
                    value={settings.background}
                    disabledAlpha
                    showText
                    onChange={(color) =>
                      updateSettings({
                        background: color.toHexString().slice(0, 7),
                      })
                    }
                  />
                </div>
              </section>
            )}

            <section className="studio-result">
              <div className="studio-result-head">
                <span className="studio-result-title">转换结果</span>
                <span
                  className={`studio-status${errorCount > 0 ? " is-warn" : ""}`}
                  aria-live="polite"
                >
                  {statusText}
                </span>
              </div>

              <div className="studio-stats">
                <div className="studio-stat">
                  <span>原始</span>
                  <strong>{formatBytes(originalTotal)}</strong>
                </div>
                <div className="studio-stat">
                  <span>转换后</span>
                  <strong>
                    {statsReady && doneCount > 0
                      ? formatBytes(outputTotal)
                      : "—"}
                  </strong>
                </div>
                <div className="studio-stat">
                  <span>体积变化</span>
                  <strong>
                    {statsReady && doneCount > 0 && errorCount === 0
                      ? savedPercent > 0
                        ? `-${savedPercent}%`
                        : savedPercent === 0
                          ? "0%"
                          : `+${Math.abs(savedPercent)}%`
                      : "—"}
                  </strong>
                </div>
              </div>

              <Button
                type="primary"
                size="large"
                block
                className="studio-export"
                icon={<Download size={16} strokeWidth={1.8} />}
                loading={exporting}
                disabled={stale || workingCount > 0 || doneCount === 0}
                onClick={() => void exportAll()}
              >
                {errorCount > 0 ? `导出 ${doneCount} 张` : "导出全部"}
              </Button>
            </section>
          </aside>
        </div>
      )}

      <div
        className={`studio-drop-overlay${dragging ? " is-active" : ""}`}
        aria-hidden="true"
      >
        <ImagePlus size={22} strokeWidth={1.7} />
        松开以添加图片
      </div>

      <Modal
        open={previewSource !== null}
        onCancel={() => setPreviewId(null)}
        width={880}
        centered
        destroyOnHidden
        title={
          previewSource ? (
            <div className="studio-modal-title">
              <span className="studio-modal-name" title={previewSource.name}>
                {previewSource.name}
              </span>
              <span className="studio-modal-sub">{previewMeta}</span>
            </div>
          ) : null
        }
        footer={[
          <Button key="close" onClick={() => setPreviewId(null)}>
            关闭
          </Button>,
          <Button
            key="export"
            type="primary"
            icon={<Download size={16} strokeWidth={1.8} />}
            loading={previewSource ? savingId === previewSource.id : false}
            disabled={!previewResult || stale}
            onClick={() => {
              if (previewSource) void exportOne(previewSource);
            }}
          >
            导出这张
          </Button>,
        ]}
      >
        {previewSource && (
          <div className="studio-compare">
            <div className="studio-compare-pane">
              <div className="studio-compare-head">
                <span>原图</span>
                <span>{formatBytes(previewSource.size)}</span>
              </div>
              <figure>
                <img
                  src={previewSource.previewUrl}
                  alt={`原图 ${previewSource.name}`}
                  draggable={false}
                />
              </figure>
            </div>

            <div className="studio-compare-pane">
              <div className="studio-compare-head">
                <span>转换后</span>
                <span>
                  {previewResult
                    ? `${formatLabel(previewResult.format)} · ${formatBytes(previewResult.blob.size)}`
                    : previewJob?.status === "error"
                      ? "未能转换"
                      : "处理中"}
                </span>
              </div>
              <figure>
                {previewResult && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`转换后 ${previewSource.name}`}
                    draggable={false}
                  />
                ) : previewJob?.status === "error" ? (
                  <span className="studio-compare-state is-error">
                    {previewJob.message}
                  </span>
                ) : (
                  <span className="studio-compare-state">
                    <Spin size="small" />
                    正在转换…
                  </span>
                )}
              </figure>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}