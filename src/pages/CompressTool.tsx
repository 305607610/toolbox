import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  App as AntdApp,
  Button,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Slider,
  Spin,
  Tooltip,
} from "antd";
import {
  ArrowLeft,
  Download,
  ImageDown,
  ImageOff,
  ImagePlus,
  Plus,
  X,
} from "lucide-react";
import {
  compressImage,
  dedupeFilename,
  DEFAULT_COMPRESS_SETTINGS,
  formatBytes,
  formatLabel,
  isSupportedImage,
  outputFilename,
  saveFormatOf,
  type CompressFormat,
  type CompressResult,
  type CompressSettings,
} from "../compress/compress";
import { exportBatch } from "../compress/export";
import { saveExport } from "../seal/save";
import "../styles/compress.css";

type Job =
  | { status: "working" }
  | { status: "done"; result: CompressResult; settingsKey: string }
  | { status: "error"; message: string; settingsKey: string };

interface SourceItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

const formatOptions: { label: string; value: CompressFormat }[] = [
  { label: "自动", value: "auto" },
  { label: "JPG", value: "jpeg" },
  { label: "WebP", value: "webp" },
  { label: "PNG", value: "png" },
];

type TargetUnit = "KB" | "MB";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const fileKey = (file: File) =>
  `${file.name}:${file.size}:${file.lastModified}`;

const settingsKeyOf = (settings: CompressSettings) =>
  [
    settings.format,
    settings.quality,
    settings.maxWidth ?? "w",
    settings.maxHeight ?? "h",
    settings.targetBytes ?? "t",
  ].join(":");

async function compressQueue(
  items: SourceItem[],
  settings: CompressSettings,
  settingsKey: string,
  isCurrent: () => boolean,
  onResult: (id: string, job: Job) => void,
) {
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      if (!isCurrent()) return;
      try {
        const result = await compressImage(item.file, settings, isCurrent);
        if (!isCurrent()) return;
        onResult(item.id, { status: "done", result, settingsKey });
      } catch (error) {
        if (!isCurrent()) return;
        onResult(item.id, {
          status: "error",
          message: error instanceof Error ? error.message : "压缩失败",
          settingsKey,
        });
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(3, items.length) }, () => worker()),
  );
}

export default function CompressTool() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntdApp.useApp();

  const [sources, setSources] = useState<SourceItem[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [settings, setSettings] = useState<CompressSettings>(
    DEFAULT_COMPRESS_SETTINGS,
  );
  const [targetValue, setTargetValue] = useState<number | null>(null);
  const [targetUnit, setTargetUnit] = useState<TargetUnit>("KB");
  const [dragging, setDragging] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [compressedUrl, setCompressedUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const sourcesRef = useRef<SourceItem[]>([]);
  const jobsRef = useRef<Record<string, Job>>({});
  const runRef = useRef(0);
  const dragDepth = useRef(0);

  const from = (location.state as { from?: string } | null)?.from;
  const goBack = useCallback(() => {
    if (from && from.startsWith("/")) navigate(from);
    else navigate("/");
  }, [from, navigate]);

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

      const supported = incoming.filter(isSupportedImage);
      const unsupported = incoming.length - supported.length;
      const existing = new Set(sourcesRef.current.map((item) => fileKey(item.file)));
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
      void compressQueue(
        targets,
        settings,
        settingsKey,
        isCurrent,
        (id, job) => {
          applyJobs({ ...jobsRef.current, [id]: job });
        },
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
          "input, textarea, [contenteditable='true'], .ant-select, .ant-popover, .ant-modal",
        )
      ) {
        return;
      }
      if (
        document.querySelector(
          ".ant-popover:not(.ant-popover-hidden), .ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-modal-wrap",
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
  const previewResult =
    previewJob?.status === "done" ? previewJob.result : null;

  useEffect(() => {
    if (!previewResult) {
      setCompressedUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewResult.blob);
    setCompressedUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewResult]);

  const doneCount = sources.filter(
    (item) => jobs[item.id]?.status === "done",
  ).length;
  const errorCount = sources.filter(
    (item) => jobs[item.id]?.status === "error",
  ).length;
  const workingCount = sources.length - doneCount - errorCount;

  const originalTotal = sources.reduce((sum, item) => sum + item.size, 0);
  const doneOriginal = sources.reduce((sum, item) => {
    return jobs[item.id]?.status === "done" ? sum + item.size : sum;
  }, 0);
  const compressedTotal = sources.reduce((sum, item) => {
    const job = jobs[item.id];
    return job?.status === "done" ? sum + job.result.blob.size : sum;
  }, 0);
  const savedPercent =
    doneOriginal > 0
      ? Math.round((1 - compressedTotal / doneOriginal) * 100)
      : 0;
  const settled = sources.length > 0 && workingCount === 0;
  const settingsKey = settingsKeyOf(settings);
  const stale = sources.some((item) => {
    const job = jobs[item.id];
    return !!job && job.status !== "working" && job.settingsKey !== settingsKey;
  });
  const statsReady = settled && !stale;
  const targetLabel = settings.targetBytes
    ? formatBytes(settings.targetBytes)
    : null;

  const statusText = stale
    ? "正在更新…"
    : workingCount > 0
      ? `已完成 ${doneCount}/${sources.length}`
      : errorCount > 0
        ? `${errorCount} 张未能压缩`
        : targetLabel
          ? `全部 ≤ ${targetLabel}`
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
            outputFilename(source.name, job.result.format),
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
      const filename = outputFilename(source.name, job.result.format);
      const result = await saveExport(
        bytes,
        filename,
        saveFormatOf(job.result.format),
      );
      if (result.status === "saved") {
        message.success(`已导出：${result.path}`);
      }
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

  const closePreview = () => setPreviewId(null);

  const updateSettings = (patch: Partial<CompressSettings>) =>
    setSettings((previous) => ({ ...previous, ...patch }));

  const targetBytesFor = (value: number | null, unit: TargetUnit) =>
    value && Number.isFinite(value) && value > 0
      ? Math.round(value * (unit === "MB" ? 1024 * 1024 : 1024))
      : null;

  const updateTargetValue = (value: number | null) => {
    const clean = value && Number.isFinite(value) && value > 0 ? value : null;
    setTargetValue(clean);
    updateSettings({ targetBytes: targetBytesFor(clean, targetUnit) });
  };

  const updateTargetUnit = (unit: TargetUnit) => {
    setTargetUnit(unit);
    updateSettings({ targetBytes: targetBytesFor(targetValue, unit) });
  };

  const updateDimension = (
    key: "maxWidth" | "maxHeight",
    value: number | null,
  ) => {
    const clean =
      value && Number.isFinite(value) && value > 0
        ? Math.round(value)
        : null;
    updateSettings(key === "maxWidth" ? { maxWidth: clean } : { maxHeight: clean });
  };

  const previewMeta = (() => {
    if (!previewSource) return "";
    if (previewJob?.status === "done") {
      return `${previewJob.result.sourceWidth}×${previewJob.result.sourceHeight} · ${formatBytes(previewSource.size)} → ${formatBytes(previewJob.result.blob.size)}`;
    }
    return `${formatBytes(previewSource.size)}`;
  })();

  return (
    <div
      className="tool-page compress-page"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <h1 className="visually-hidden">图片压缩</h1>

      <div className="compress-topbar">
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
        accept="image/jpeg,image/png,image/webp"
        multiple
        tabIndex={-1}
        className="visually-hidden"
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {sources.length === 0 ? (
        <div className="compress-empty-wrap">
          <div className="compress-drop" onClick={openPicker}>
            <span className="compress-drop-icon" aria-hidden="true">
              <ImageDown size={26} strokeWidth={1.6} />
            </span>
            <h2>拖入图片开始压缩</h2>
            <p>支持 JPG、PNG、WebP，可一次选择多张。</p>
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
        <div className="compress-workspace">
            <section className="compress-list" aria-label="待压缩图片">
              <header className="compress-list-head">
                <div className="compress-list-title">
                  <strong>{sources.length} 张图片</strong>
                  <span>{formatBytes(originalTotal)}</span>
                </div>
                <div className="compress-list-actions">
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

              <div className="compress-rows">
                {sources.map((item) => {
                  const job = jobs[item.id];
                  const done = job?.status === "done" ? job.result : null;
                  const percent = done
                    ? Math.round((1 - done.blob.size / item.size) * 100)
                    : 0;
                  const gainClass =
                    done &&
                    !done.usedOriginal &&
                    percent < 0 &&
                    !settings.targetBytes
                      ? " compress-gain--up"
                      : "";

                  return (
                    <div className="compress-row" key={item.id}>
                      <button
                        type="button"
                        className="compress-row-open"
                        aria-label={`预览 ${item.name}`}
                        onClick={() => setPreviewId(item.id)}
                      >
                        <span className="compress-thumb" aria-hidden="true">
                          {job?.status === "error" ? (
                            <span className="compress-thumb-fallback">
                              <ImageOff size={16} strokeWidth={1.7} />
                            </span>
                          ) : (
                            <img
                              src={item.previewUrl}
                              alt=""
                              loading="lazy"
                              draggable={false}
                            />
                          )}
                        </span>
                        <span className="compress-row-text">
                          <span className="compress-name" title={item.name}>
                            {item.name}
                          </span>
                          <span
                            className={`compress-meta${job?.status === "error" ? " is-error" : ""}`}
                          >
                            {job?.status === "error" ? (
                              <>
                                <span>{formatBytes(item.size)}</span>
                                <span className="compress-sep">·</span>
                                <span>{job.message}</span>
                              </>
                            ) : !done ? (
                              <>
                                <span>{formatBytes(item.size)}</span>
                                <span className="compress-sep">·</span>
                                <span className="compress-busy">
                                  <Spin size="small" />
                                  压缩中…
                                </span>
                              </>
                            ) : (
                              <>
                                <span>
                                  {done.width}×{done.height}
                                </span>
                                <span className="compress-sep">·</span>
                                <span>
                                  {formatBytes(item.size)}
                                  <span className="compress-arrow">→</span>
                                  {formatBytes(done.blob.size)}
                                </span>
                                <span className="compress-sep">·</span>
                                <span className={`compress-gain${gainClass}`}>
                                  {done.usedOriginal
                                    ? settings.targetBytes
                                      ? "已达标"
                                      : "已是最优"
                                    : settings.targetBytes && percent <= 0
                                      ? "已达标"
                                      : percent > 0
                                        ? `省 ${percent}%`
                                        : percent === 0
                                          ? "未减小"
                                          : `增加 ${Math.abs(percent)}%`}
                                </span>
                              </>
                            )}
                          </span>
                        </span>
                      </button>

                      <div className="compress-row-actions">
                        <Tooltip title="导出这张">
                          <Button
                            type="text"
                            size="small"
                            className="compress-icon-btn"
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
                            className="compress-icon-btn"
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

            <aside className="compress-panel" aria-label="压缩设置">
              <h2 className="compress-panel-title">压缩设置</h2>

              <div className="compress-field">
                <span className="compress-label">输出格式</span>
                <Segmented
                  block
                  className="compress-format"
                  value={settings.format}
                  options={formatOptions}
                  onChange={(value) =>
                    updateSettings({ format: value as CompressFormat })
                  }
                />
              </div>

              <div className="compress-field">
                <span className="compress-label">目标大小</span>
                <div className="compress-target-row">
                  <InputNumber
                    className="compress-target-input"
                    aria-label="目标大小"
                    value={targetValue}
                    min={1}
                    precision={targetUnit === "MB" ? 2 : 0}
                    controls={false}
                    placeholder="不限"
                    onChange={(value) => updateTargetValue(value ?? null)}
                  />
                  <Select
                    className="compress-target-unit"
                    aria-label="目标大小单位"
                    value={targetUnit}
                    options={[
                      { label: "KB", value: "KB" },
                      { label: "MB", value: "MB" },
                    ]}
                    onChange={(unit) => updateTargetUnit(unit as TargetUnit)}
                  />
                </div>
              </div>

              <div className="compress-field">
                <span className="compress-label">尺寸</span>
                <div className="compress-size-row">
                  <div className="compress-size-item">
                    <span className="compress-size-label">宽</span>
                    <InputNumber
                      aria-label="最大宽度"
                      value={settings.maxWidth}
                      min={16}
                      max={20000}
                      precision={0}
                      controls={false}
                      placeholder="不限"
                      suffix="px"
                      onChange={(value) =>
                        updateDimension("maxWidth", value ?? null)
                      }
                    />
                  </div>
                  <div className="compress-size-item">
                    <span className="compress-size-label">高</span>
                    <InputNumber
                      aria-label="最大高度"
                      value={settings.maxHeight}
                      min={16}
                      max={20000}
                      precision={0}
                      controls={false}
                      placeholder="不限"
                      suffix="px"
                      onChange={(value) =>
                        updateDimension("maxHeight", value ?? null)
                      }
                    />
                  </div>
                </div>
              </div>

              {!settings.targetBytes && settings.format !== "png" && (
                <div className="compress-field">
                  <div className="compress-label-row">
                    <span className="compress-label">质量</span>
                    <span className="compress-value">{settings.quality}</span>
                  </div>
                  <Slider
                    min={30}
                    max={100}
                    value={settings.quality}
                    onChange={(value) => updateSettings({ quality: value })}
                  />
                </div>
              )}

              <div className="compress-result">
                <div className="compress-result-head">
                  <span className="compress-result-title">压缩结果</span>
                  <span
                    className={`compress-status${errorCount > 0 ? " is-warn" : ""}`}
                    aria-live="polite"
                  >
                    {statusText}
                  </span>
                </div>

                <div className="compress-stats">
                  <div className="compress-stat">
                    <span>原始</span>
                    <strong>{formatBytes(originalTotal)}</strong>
                  </div>
                  <div className="compress-stat">
                    <span>压缩后</span>
                    <strong>
                      {statsReady && doneCount > 0
                        ? formatBytes(compressedTotal)
                        : "—"}
                    </strong>
                  </div>
                  <div className="compress-stat">
                    <span>节省</span>
                    <strong>
                      {statsReady &&
                      doneCount > 0 &&
                      errorCount === 0 &&
                      savedPercent > 0
                        ? `${savedPercent}%`
                        : "—"}
                    </strong>
                  </div>
                </div>

                <Button
                  type="primary"
                  size="large"
                  block
                  className="compress-export"
                  icon={<Download size={16} strokeWidth={1.8} />}
                  loading={exporting}
                  disabled={stale || workingCount > 0 || doneCount === 0}
                  onClick={() => void exportAll()}
                >
                  {errorCount > 0 ? `导出 ${doneCount} 张` : "导出全部"}
                </Button>
              </div>
            </aside>
          </div>
      )}

      <div
        className={`compress-drop-overlay${dragging ? " is-active" : ""}`}
        aria-hidden="true"
      >
        <ImagePlus size={22} strokeWidth={1.7} />
        松开以添加图片
      </div>

      <Modal
        open={previewSource !== null}
        onCancel={closePreview}
        width={880}
        centered
        destroyOnHidden
        title={
          previewSource ? (
            <div className="compress-modal-title">
              <span className="compress-modal-name" title={previewSource.name}>
                {previewSource.name}
              </span>
              <span className="compress-modal-sub">{previewMeta}</span>
            </div>
          ) : null
        }
        footer={[
          <Button key="close" onClick={closePreview}>
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
          <div className="compress-compare">
            <div className="compress-compare-pane">
              <div className="compress-compare-head">
                <span>原图</span>
                <span>
                  {previewResult
                    ? `${previewResult.sourceWidth}×${previewResult.sourceHeight} · ${formatBytes(previewSource.size)}`
                    : formatBytes(previewSource.size)}
                </span>
              </div>
              <figure>
                <img
                  src={previewSource.previewUrl}
                  alt={`原图 ${previewSource.name}`}
                  draggable={false}
                />
              </figure>
            </div>

            <div className="compress-compare-pane">
              <div className="compress-compare-head">
                <span>压缩后</span>
                <span>
                  {previewResult
                    ? `${formatLabel(previewResult.format)} · ${previewResult.width}×${previewResult.height} · ${formatBytes(previewResult.blob.size)}`
                    : previewJob?.status === "error"
                      ? "未能压缩"
                      : "处理中"}
                </span>
              </div>
              <figure>
                {previewResult && compressedUrl ? (
                  <img
                    src={compressedUrl}
                    alt={`压缩后 ${previewSource.name}`}
                    draggable={false}
                  />
                ) : previewJob?.status === "error" ? (
                  <span className="compress-compare-state is-error">
                    {previewJob.message}
                  </span>
                ) : (
                  <span className="compress-compare-state">
                    <Spin size="small" />
                    正在压缩…
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