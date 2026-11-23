import { useMemo, useRef, useState } from "react";
import { App as AntdApp, Button, Input, Segmented, Switch, Tooltip } from "antd";
import {
  ArrowLeft,
  ArrowLeftRight,
  Binary,
  Copy,
  FileInput,
  FileOutput,
  Save,
  Trash2,
} from "lucide-react";
import HelpTip from "../components/HelpTip";
import { useToolBack } from "../hooks/useToolBack";
import { readFileBytes, readFileText, saveRawBytes, stemOf } from "../lib/files";
import { formatBytes } from "../compress/compress";
import { sanitizeFilename } from "../seal/filename";
import { saveExport } from "../seal/save";
import "../styles/studio.css";
import "../styles/code.css";

type MainTab = "base64" | "url";
type Base64Tab = "text" | "file";
type Direction = "encode" | "decode";
type UrlScope = "component" | "full";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/json": "json",
  "application/zip": "zip",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "video/mp4": "mp4",
  "text/plain": "txt",
  "text/html": "html",
  "text/css": "css",
  "text/javascript": "js",
};

const extensionForMime = (mime: string) => {
  if (MIME_EXTENSIONS[mime]) return MIME_EXTENSIONS[mime];
  if (mime.startsWith("text/")) return "txt";
  return "bin";
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + chunk),
    );
  }
  return btoa(binary);
};

const normalizeBase64 = (value: string) =>
  value
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

const base64ToBytes = (value: string) => {
  const normalized = normalizeBase64(value);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error("包含 Base64 之外的字符");
  }
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const DATA_URL = /^data:([^;,]*)?(;[^,]*)?,([\s\S]*)$/i;

const parseBase64Payload = (raw: string) => {
  const trimmed = raw.trim();
  let body = trimmed;
  let mime = "";
  const match = DATA_URL.exec(trimmed);
  if (match) {
    mime = match[1] || "application/octet-stream";
    if (!(match[2] ?? "").toLowerCase().includes("base64")) {
      throw new Error("只支持 base64 编码的 Data URL");
    }
    body = match[3];
  }
  if (!body) throw new Error("没有可解码的内容");
  return { bytes: base64ToBytes(body), mime };
};

const textStats = (value: string) => {
  if (!value) return "0 字符";
  const bytes = new TextEncoder().encode(value).length;
  return `${value.length} 字符 · ${formatBytes(bytes)}`;
};

export default function EncodingTool() {
  const goBack = useToolBack();
  const { message } = AntdApp.useApp();

  const [mainTab, setMainTab] = useState<MainTab>("base64");
  const [base64Tab, setBase64Tab] = useState<Base64Tab>("text");
  const [base64Direction, setBase64Direction] =
    useState<Direction>("encode");
  const [urlDirection, setUrlDirection] = useState<Direction>("encode");
  const [urlScope, setUrlScope] = useState<UrlScope>("component");
  const [urlSafe, setUrlSafe] = useState(false);

  const [base64Input, setBase64Input] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const [fileSource, setFileSource] = useState<{
    file: File;
    base64: string;
  } | null>(null);
  const [dataUrl, setDataUrl] = useState(false);
  const [fileInput, setFileInput] = useState("");
  const filePickerRef = useRef<HTMLInputElement>(null);
  const textPickerRef = useRef<HTMLInputElement>(null);

  const base64Result = useMemo(() => {
    if (!base64Input) {
      return { output: "", error: "", binary: false };
    }
    try {
      if (base64Direction === "encode") {
        const encoded = bytesToBase64(
          new TextEncoder().encode(base64Input),
        );
        const output = urlSafe
          ? encoded
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=+$/, "")
          : encoded;
        return { output, error: "", binary: false };
      }
      const { bytes } = parseBase64Payload(base64Input);
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      return {
        output: text,
        error: "",
        binary: text.includes("�"),
      };
    } catch {
      return {
        output: "",
        error: "不是有效的 Base64 内容",
        binary: false,
      };
    }
  }, [base64Input, base64Direction, urlSafe]);

  const urlResult = useMemo(() => {
    if (!urlInput) return { output: "", error: "" };
    try {
      if (urlDirection === "encode") {
        return {
          output:
            urlScope === "component"
              ? encodeURIComponent(urlInput)
              : encodeURI(urlInput),
          error: "",
        };
      }
      return {
        output:
          urlScope === "component"
            ? decodeURIComponent(urlInput)
            : decodeURI(urlInput),
        error: "",
      };
    } catch {
      return {
        output: "",
        error: "URL 中的百分号编码不完整或非法",
      };
    }
  }, [urlInput, urlDirection, urlScope]);

  const params = useMemo(() => {
    const raw = urlInput.trim();
    if (!raw) return [];
    const withoutHash = raw.split("#")[0];
    const queryIndex = withoutHash.indexOf("?");
    const query =
      queryIndex >= 0
        ? withoutHash.slice(queryIndex + 1)
        : withoutHash;
    if (!query.includes("=")) return [];
    const search = new URLSearchParams(query);
    return Array.from(search.entries()).map(([key, value], index) => ({
      key,
      value,
      id: index,
    }));
  }, [urlInput]);

  const fileBase64 = fileSource
    ? dataUrl
      ? `data:${fileSource.file.type || "application/octet-stream"};base64,${fileSource.base64}`
      : fileSource.base64
    : "";

  const decodedFile = useMemo(() => {
    if (!fileInput.trim()) return null;
    try {
      const { bytes, mime } = parseBase64Payload(fileInput);
      return {
        bytes,
        mime,
        extension: extensionForMime(mime),
        error: "",
      };
    } catch {
      return {
        bytes: null,
        mime: "",
        extension: "bin",
        error: "不是有效的 Base64 或 Data URL",
      };
    }
  }, [fileInput]);

  const copyText = async (value: string, label: string) => {
    if (!value) {
      message.info("没有可复制的内容");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      message.success(`已复制${label}`);
    } catch {
      message.error("复制失败，请手动选择文本");
    }
  };

  const swapBase64 = () => {
    if (!base64Result.output || base64Result.error) return;
    setBase64Input(base64Result.output);
    setBase64Direction((previous) =>
      previous === "encode" ? "decode" : "encode",
    );
  };

  const swapUrl = () => {
    if (!urlResult.output || urlResult.error) return;
    setUrlInput(urlResult.output);
    setUrlDirection((previous) =>
      previous === "encode" ? "decode" : "encode",
    );
  };

  const chooseSourceFile = async (file: File) => {
    try {
      const bytes = await readFileBytes(file);
      if (file.size > 20 * 1024 * 1024) {
        message.warning("文件超过 20 MB，Base64 会很长，复制和保存可能较慢");
      }
      setFileSource({ file, base64: bytesToBase64(bytes) });
    } catch {
      message.error("无法读取这个文件");
    }
  };

  const saveFileBase64 = async () => {
    if (!fileSource) return;
    try {
      const name = `${sanitizeFilename(stemOf(fileSource.file.name), "文件")}_base64.txt`;
      const result = await saveExport(
        new TextEncoder().encode(fileBase64),
        name,
        "txt",
      );
      if (result.status === "saved") message.success(`已保存：${result.path}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const saveDecodedFile = async () => {
    if (!decodedFile?.bytes) return;
    try {
      const result = await saveRawBytes(
        decodedFile.bytes,
        `解码.${decodedFile.extension}`,
      );
      if (result.status === "saved") message.success(`已保存：${result.path}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const chooseBase64Text = async (file: File) => {
    try {
      setFileInput(await readFileText(file));
    } catch {
      message.error("无法读取这个文件");
    }
  };

  return (
    <div className="tool-page studio-page code-page encoding-page">
      <h1 className="visually-hidden">Base64 / URL 编解码</h1>

      <div className="studio-topbar encoding-topbar">
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
          value={mainTab}
          options={[
            { label: "Base64", value: "base64" },
            { label: "URL", value: "url" },
          ]}
          onChange={(value) => setMainTab(value as MainTab)}
        />
      </div>

      {mainTab === "base64" ? (
        <>
          <div className="code-toolbar encoding-toolbar">
            <Segmented
              className="tool-segmented"
              value={base64Tab}
              options={[
                { label: "文本转换", value: "text" },
                { label: "文件转换", value: "file" },
              ]}
              onChange={(value) => setBase64Tab(value as Base64Tab)}
            />
            {base64Tab === "text" && (
              <div className="encoding-control-row">
                <Segmented
                  className="encoding-direction"
                  value={base64Direction}
                  options={[
                    { label: "编码", value: "encode" },
                    { label: "解码", value: "decode" },
                  ]}
                  onChange={(value) =>
                    setBase64Direction(value as Direction)
                  }
                />
                <HelpTip text="编码按 UTF-8；解码兼容 URL-safe 与缺失的 = 补位。" />
              </div>
            )}
            {base64Tab === "text" && base64Direction === "encode" && (
              <label className="encoding-dataurl-row">
                <Switch
                  size="small"
                  checked={urlSafe}
                  onChange={setUrlSafe}
                />
                URL-safe（- _，无补位）
              </label>
            )}
          </div>

          {base64Tab === "text" ? (
            <>
              {base64Result.error && (
                <div className="code-notice is-error" role="alert">
                  {base64Result.error}
                </div>
              )}
              {base64Result.binary && (
                <div className="code-notice is-error" role="alert">
                  解码结果包含无法按 UTF-8 显示的字节；如果是文件，请使用「文件转换」还原。
                </div>
              )}

              <div className="code-workspace">
                <section className="code-pane" aria-label="Base64 输入">
                  <header className="code-pane-head">
                    <span className="code-pane-title">
                      {base64Direction === "encode" ? "文本" : "Base64"}
                    </span>
                    <span className="code-pane-meta">
                      {textStats(base64Input)}
                    </span>
                  </header>
                  <div className="code-pane-body encoding-pane-body">
                    <Input.TextArea
                      className="code-input"
                      value={base64Input}
                      spellCheck={false}
                      placeholder={
                        base64Direction === "encode"
                          ? "输入要编码的文本"
                          : "粘贴 Base64 或 Data URL"
                      }
                      onChange={(event) =>
                        setBase64Input(event.target.value)
                      }
                    />
                  </div>
                </section>

                <section className="code-pane" aria-label="Base64 结果">
                  <header className="code-pane-head">
                    <span className="code-pane-title">
                      {base64Direction === "encode" ? "Base64" : "文本"}
                    </span>
                    <span className="code-pane-meta">
                      {textStats(base64Result.output)}
                    </span>
                  </header>
                  <div className="code-pane-body encoding-pane-body">
                    {base64Result.output ? (
                      <pre className="code-output is-wrap">
                        {base64Result.output}
                      </pre>
                    ) : (
                      <div className="code-empty">
                        <Binary size={28} strokeWidth={1.4} />
                        <span>结果会显示在这里</span>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="encoding-actions">
                <Button
                  icon={<ArrowLeftRight size={15} strokeWidth={1.8} />}
                  disabled={!base64Result.output || !!base64Result.error}
                  onClick={swapBase64}
                >
                  交换
                </Button>
                <Button
                  icon={<Copy size={15} strokeWidth={1.8} />}
                  disabled={!base64Result.output}
                  onClick={() =>
                    void copyText(base64Result.output, "结果")
                  }
                >
                  复制结果
                </Button>
                <Button
                  icon={<Trash2 size={15} strokeWidth={1.8} />}
                  disabled={!base64Input}
                  onClick={() => setBase64Input("")}
                >
                  清空
                </Button>
              </div>
            </>
          ) : (
            <div className="encoding-file-grid">
              <section className="encoding-card encoding-file-card">
                <header className="encoding-card-head">
                  <h2 className="encoding-card-title">文件转 Base64</h2>
                </header>
                <div className="encoding-card-body">
                  <input
                    ref={filePickerRef}
                    type="file"
                    tabIndex={-1}
                    className="visually-hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void chooseSourceFile(file);
                    }}
                  />

                  {fileSource ? (
                    <>
                      <div className="encoding-file-meta">
                        <strong title={fileSource.file.name}>
                          {fileSource.file.name}
                        </strong>
                        <span>{formatBytes(fileSource.file.size)}</span>
                        <span>
                          {fileSource.file.type || "未知类型"}
                        </span>
                      </div>
                      <div className="encoding-dataurl-row">
                        <span>输出为 Data URL</span>
                        <Switch
                          size="small"
                          checked={dataUrl}
                          onChange={setDataUrl}
                        />
                      </div>
                      <Input.TextArea
                        className="encoding-preview"
                        readOnly
                        value={fileBase64}
                        spellCheck={false}
                      />
                      <div className="encoding-actions">
                        <Button
                          icon={<Copy size={15} strokeWidth={1.8} />}
                          onClick={() =>
                            void copyText(
                              fileBase64,
                              dataUrl ? "Data URL" : "Base64",
                            )
                          }
                        >
                          复制
                        </Button>
                        <Button
                          icon={<Save size={15} strokeWidth={1.8} />}
                          onClick={() => void saveFileBase64()}
                        >
                          保存为 .txt
                        </Button>
                        <Button
                          type="text"
                          icon={<Trash2 size={15} strokeWidth={1.8} />}
                          onClick={() => setFileSource(null)}
                        >
                          移除
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div
                      className="encoding-file-drop"
                      onClick={() => filePickerRef.current?.click()}
                    >
                      <FileInput size={26} strokeWidth={1.5} />
                      <span>选择任意文件，生成 Base64</span>
                      <Button
                        size="small"
                        type="primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          filePickerRef.current?.click();
                        }}
                      >
                        选择文件
                      </Button>
                    </div>
                  )}
                </div>
              </section>

              <section className="encoding-card encoding-file-card">
                <header className="encoding-card-head">
                  <h2 className="encoding-card-title">Base64 转文件</h2>
                </header>
                <div className="encoding-card-body">
                  <input
                    ref={textPickerRef}
                    type="file"
                    accept=".txt,text/plain"
                    tabIndex={-1}
                    className="visually-hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void chooseBase64Text(file);
                    }}
                  />
                  <Input.TextArea
                    className="encoding-preview"
                    value={fileInput}
                    spellCheck={false}
                    placeholder="粘贴 Base64 或 data:...;base64,..."
                    onChange={(event) => setFileInput(event.target.value)}
                  />
                  {decodedFile?.error ? (
                    <p className="studio-error">{decodedFile.error}</p>
                  ) : decodedFile ? (
                    <div className="encoding-file-meta">
                      <span>{formatBytes(decodedFile.bytes?.length ?? 0)}</span>
                      <span>{decodedFile.mime || "未知类型"}</span>
                      <span>.{decodedFile.extension}</span>
                    </div>
                  ) : null}
                  <div className="encoding-actions">
                    <Button
                      icon={<FileOutput size={15} strokeWidth={1.8} />}
                      onClick={() => textPickerRef.current?.click()}
                    >
                      选择 .txt
                    </Button>
                    <Button
                      type="primary"
                      icon={<Save size={15} strokeWidth={1.8} />}
                      disabled={!decodedFile?.bytes}
                      onClick={() => void saveDecodedFile()}
                    >
                      还原并保存
                    </Button>
                    <Button
                      type="text"
                      icon={<Trash2 size={15} strokeWidth={1.8} />}
                      disabled={!fileInput}
                      onClick={() => setFileInput("")}
                    >
                      清空
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="code-toolbar encoding-toolbar">
            <Segmented
              className="encoding-direction"
              value={urlDirection}
              options={[
                { label: "编码", value: "encode" },
                { label: "解码", value: "decode" },
              ]}
              onChange={(value) => setUrlDirection(value as Direction)}
            />
            <div className="encoding-control-row">
              <Segmented
                className="encoding-scope"
                value={urlScope}
                options={[
                  { label: "组件", value: "component" },
                  { label: "完整链接", value: "full" },
                ]}
                onChange={(value) => setUrlScope(value as UrlScope)}
              />
              <HelpTip text="组件：连分隔符一起编码；完整链接：保留分隔符，只编码内容。" />
            </div>
          </div>

          {urlResult.error && (
            <div className="code-notice is-error" role="alert">
              {urlResult.error}
            </div>
          )}

          <div className="code-workspace">
            <section className="code-pane" aria-label="URL 输入">
              <header className="code-pane-head">
                <span className="code-pane-title">
                  {urlDirection === "encode" ? "原文" : "编码文本"}
                </span>
                <span className="code-pane-meta">{textStats(urlInput)}</span>
              </header>
              <div className="code-pane-body encoding-pane-body">
                <Input.TextArea
                  className="code-input"
                  value={urlInput}
                  spellCheck={false}
                  placeholder={
                    urlDirection === "encode"
                      ? "输入文本或链接，例如 你好 world"
                      : "粘贴编码后的文本或链接"
                  }
                  onChange={(event) => setUrlInput(event.target.value)}
                />
              </div>
            </section>

            <section className="code-pane" aria-label="URL 结果">
              <header className="code-pane-head">
                <span className="code-pane-title">
                  {urlDirection === "encode" ? "编码结果" : "解码结果"}
                </span>
                <span className="code-pane-meta">
                  {textStats(urlResult.output)}
                </span>
              </header>
              <div className="code-pane-body encoding-pane-body">
                {urlResult.output ? (
                  <pre className="code-output is-wrap">
                    {urlResult.output}
                  </pre>
                ) : (
                  <div className="code-empty">
                    <Binary size={28} strokeWidth={1.4} />
                    <span>结果会显示在这里</span>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="encoding-actions">
            <Button
              icon={<ArrowLeftRight size={15} strokeWidth={1.8} />}
              disabled={!urlResult.output || !!urlResult.error}
              onClick={swapUrl}
            >
              交换
            </Button>
            <Button
              icon={<Copy size={15} strokeWidth={1.8} />}
              disabled={!urlResult.output}
              onClick={() => void copyText(urlResult.output, "结果")}
            >
              复制结果
            </Button>
            <Button
              icon={<Trash2 size={15} strokeWidth={1.8} />}
              disabled={!urlInput}
              onClick={() => setUrlInput("")}
            >
              清空
            </Button>
          </div>

          <section className="encoding-card encoding-param-card">
            <header className="encoding-card-head">
              <h2 className="encoding-card-title">查询参数</h2>
              {params.length > 0 && (
                <span className="encoding-hint">
                  {params.length} 个参数
                </span>
              )}
            </header>
            {params.length > 0 ? (
              <div className="encoding-param-list">
                {params.map((param) => (
                  <div className="encoding-param-row" key={param.id}>
                    <span
                      className="encoding-param-key"
                      title={param.key}
                    >
                      {param.key}
                    </span>
                    <span
                      className="encoding-param-value"
                      title={param.value}
                    >
                      {param.value}
                    </span>
                    <Tooltip title="复制值">
                      <Button
                        type="text"
                        size="small"
                        icon={<Copy size={14} strokeWidth={1.8} />}
                        aria-label={`复制参数 ${param.key}`}
                        onClick={() => void copyText(param.value, "参数值")}
                      />
                    </Tooltip>
                  </div>
                ))}
              </div>
            ) : (
              <div className="encoding-param-empty">
                输入完整链接或 a=1&amp;b=2 形式的查询字符串后，这里会列出键值。
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}