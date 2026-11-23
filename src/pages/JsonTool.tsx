import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  Input,
  Select,
  Switch,
  Tooltip,
} from "antd";
import {
  AlertTriangle,
  AlignLeft,
  ArrowDownAZ,
  ArrowLeft,
  Braces,
  CheckCircle2,
  Copy,
  FolderOpen,
  Minimize2,
  Quote,
  Save,
  TextQuote,
  Trash2,
} from "lucide-react";
import { useToolBack } from "../hooks/useToolBack";
import { stemOf } from "../lib/files";
import { sanitizeFilename } from "../seal/filename";
import { saveExport } from "../seal/save";
import "../styles/studio.css";
import "../styles/code.css";

type Indent = "2" | "4" | "tab";

type Status =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | {
      kind: "error";
      message: string;
      line?: number;
      column?: number;
    };

const INDENT_OPTIONS = [
  { label: "缩进 2 空格", value: "2" },
  { label: "缩进 4 空格", value: "4" },
  { label: "缩进 Tab", value: "tab" },
];

const indentValue = (indent: Indent) =>
  indent === "tab" ? "\t" : Number(indent);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\bnull\b/g;

function highlightJson(source: string): string {
  let result = "";
  let last = 0;

  for (const match of source.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    result += escapeHtml(source.slice(last, index));
    const [full, text, colon, number, bool] = match;
    if (text !== undefined) {
      if (colon) {
        result += `<span class="json-token-key">${escapeHtml(text)}</span><span class="json-token-punct">${escapeHtml(colon)}</span>`;
      } else {
        result += `<span class="json-token-string">${escapeHtml(text)}</span>`;
      }
    } else if (number !== undefined) {
      result += `<span class="json-token-number">${escapeHtml(number)}</span>`;
    } else if (bool !== undefined) {
      result += `<span class="json-token-bool">${escapeHtml(bool)}</span>`;
    } else {
      result += `<span class="json-token-null">${escapeHtml(full)}</span>`;
    }
    last = index + full.length;
  }

  result += escapeHtml(source.slice(last));
  return result;
}

function countNodes(value: unknown): number {
  if (Array.isArray(value)) {
    return 1 + value.reduce<number>((sum, item) => sum + countNodes(item), 0);
  }
  if (value && typeof value === "object") {
    return (
      1 +
      Object.values(value as Record<string, unknown>).reduce<number>(
        (sum, item) => sum + countNodes(item),
        0,
      )
    );
  }
  return 1;
}

function describeValue(value: unknown): string {
  if (Array.isArray(value)) return `数组 ${value.length} 项`;
  if (value && typeof value === "object") {
    return `对象 ${Object.keys(value as Record<string, unknown>).length} 个键`;
  }
  if (value === null) return "null";
  return typeof value === "string" ? "字符串" : `${typeof value} 值`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => [key, sortValue(source[key])]),
    );
  }
  return value;
}

function parseJson(source: string): unknown {
  return JSON.parse(source) as unknown;
}

function buildError(error: unknown, source: string): Status {
  const message =
    error instanceof Error ? error.message : "JSON 解析失败";
  const explicit = /line (\d+) column (\d+)/i.exec(message);
  let line: number | undefined;
  let column: number | undefined;

  if (explicit) {
    line = Number(explicit[1]);
    column = Number(explicit[2]);
  } else {
    const position = /position (\d+)/i.exec(message);
    if (position) {
      const index = Number(position[1]);
      const before = source.slice(0, index);
      line = before.split("\n").length;
      const lastBreak = before.lastIndexOf("\n");
      column = index - lastBreak;
    }
  }

  const clean = message
    .replace(/\s+in JSON at position.*$/i, "")
    .replace(/\s+\(line \d+ column \d+\)$/i, "")
    .trim();

  return {
    kind: "error",
    message: clean || "JSON 解析失败",
    line,
    column,
  };
}

const textStats = (value: string) => {
  if (!value) return "0 字符 · 0 行";
  return `${value.length} 字符 · ${value.split("\n").length} 行`;
};

export default function JsonTool() {
  const goBack = useToolBack();
  const { message } = AntdApp.useApp();

  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState<Indent>("2");
  const [wrap, setWrap] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const highlighted = useMemo(() => highlightJson(output), [output]);

  const applyOutput = useCallback(
    (value: unknown, successMessage: string) => {
      setOutput(JSON.stringify(value, null, indentValue(indent)));
      setStatus({ kind: "success", message: successMessage });
    },
    [indent],
  );

  const formatJson = useCallback(() => {
    if (!input.trim()) {
      setOutput("");
      setStatus({ kind: "error", message: "请先输入 JSON 内容" });
      return;
    }
    try {
      const value = parseJson(input);
      applyOutput(
        value,
        `格式化完成：${describeValue(value)} · ${countNodes(value)} 个节点`,
      );
    } catch (error) {
      setOutput("");
      setStatus(buildError(error, input));
    }
  }, [input, applyOutput]);

  const minifyJson = () => {
    if (!input.trim()) {
      setOutput("");
      setStatus({ kind: "error", message: "请先输入 JSON 内容" });
      return;
    }
    try {
      const value = parseJson(input);
      setOutput(JSON.stringify(value));
      setStatus({ kind: "success", message: "已压缩为单行" });
    } catch (error) {
      setOutput("");
      setStatus(buildError(error, input));
    }
  };

  const validateJson = () => {
    if (!input.trim()) {
      setOutput("");
      setStatus({ kind: "error", message: "请先输入 JSON 内容" });
      return;
    }
    try {
      const value = parseJson(input);
      setStatus({
        kind: "success",
        message: `JSON 有效：${describeValue(value)} · ${countNodes(value)} 个节点`,
      });
    } catch (error) {
      setStatus(buildError(error, input));
    }
  };

  const sortJson = () => {
    if (!input.trim()) {
      setOutput("");
      setStatus({ kind: "error", message: "请先输入 JSON 内容" });
      return;
    }
    try {
      const value = parseJson(input);
      applyOutput(sortValue(value), "已按字母序重排对象键名");
    } catch (error) {
      setOutput("");
      setStatus(buildError(error, input));
    }
  };

  const escapeJson = () => {
    if (!input) {
      setOutput("");
      setStatus({ kind: "error", message: "请先输入内容" });
      return;
    }
    setOutput(JSON.stringify(input));
    setStatus({ kind: "success", message: "已转义为带引号的字符串" });
  };

  const unescapeJson = () => {
    if (!input.trim()) {
      setOutput("");
      setStatus({ kind: "error", message: "请先输入内容" });
      return;
    }
    try {
      const value = parseJson(input);
      if (typeof value !== "string") {
        setOutput("");
        setStatus({
          kind: "error",
          message: "输入不是转义字符串，反转义需要一段带引号的 JSON 字符串",
        });
        return;
      }
      setOutput(value);
      setStatus({ kind: "success", message: "已还原被转义的字符串" });
    } catch (error) {
      setOutput("");
      setStatus(buildError(error, input));
    }
  };

  const copyOutput = async () => {
    const value = output || input;
    if (!value) {
      message.info("没有可复制的内容");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      message.success(output ? "已复制结果" : "已复制输入");
    } catch {
      message.error("复制失败，请手动选择文本");
    }
  };

  const saveOutput = useCallback(async () => {
    if (!output) return;
    try {
      const name = fileName
        ? `${sanitizeFilename(stemOf(fileName), "JSON")}_格式化.json`
        : "格式化.json";
      const result = await saveExport(
        new TextEncoder().encode(output),
        name,
        "json",
      );
      if (result.status === "saved") message.success(`已保存：${result.path}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    }
  }, [output, fileName, message]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        formatJson();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        void saveOutput();
        return;
      }
      if (event.key === "Escape" && !event.defaultPrevented) {
        const target = event.target as HTMLElement | null;
        if (
          target?.closest(
            "input, textarea, [contenteditable='true'], .ant-select, .ant-popover",
          ) ||
          document.querySelector(
            ".ant-popover:not(.ant-popover-hidden), .ant-select-dropdown:not(.ant-select-dropdown-hidden)",
          )
        ) {
          return;
        }
        goBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [formatJson, saveOutput, goBack]);

  const clearAll = () => {
    setInput("");
    setOutput("");
    setStatus({ kind: "idle" });
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="tool-page studio-page code-page">
      <h1 className="visually-hidden">JSON 格式化</h1>

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
        ref={fileInputRef}
        type="file"
        accept=".json,.txt,application/json,text/plain"
        tabIndex={-1}
        className="visually-hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            const text = await file.text();
            setInput(text);
            setOutput("");
            setStatus({ kind: "idle" });
            setFileName(file.name);
          } catch {
            message.error("无法读取这个文件");
          }
        }}
      />

      <div className="code-toolbar">
        <div className="code-toolbar-group">
          <Select
            className="code-indent"
            size="small"
            value={indent}
            options={INDENT_OPTIONS}
            onChange={(value) => setIndent(value as Indent)}
            aria-label="缩进方式"
          />
          <Button
            type="primary"
            size="small"
            icon={<AlignLeft size={14} strokeWidth={1.8} />}
            onClick={formatJson}
          >
            格式化
          </Button>
          <Button
            size="small"
            icon={<Minimize2 size={14} strokeWidth={1.8} />}
            onClick={minifyJson}
          >
            压缩
          </Button>
          <Button
            size="small"
            icon={<CheckCircle2 size={14} strokeWidth={1.8} />}
            onClick={validateJson}
          >
            校验
          </Button>
          <Button
            size="small"
            icon={<ArrowDownAZ size={14} strokeWidth={1.8} />}
            onClick={sortJson}
          >
            键名排序
          </Button>
          <Tooltip title="把整段内容转成带引号的转义字符串">
            <Button
              size="small"
              icon={<Quote size={14} strokeWidth={1.8} />}
              onClick={escapeJson}
            >
              转义
            </Button>
          </Tooltip>
          <Tooltip title="还原一段被转义的字符串">
            <Button
              size="small"
              icon={<TextQuote size={14} strokeWidth={1.8} />}
              onClick={unescapeJson}
            >
              反转义
            </Button>
          </Tooltip>
        </div>

        <span className="code-toolbar-spacer" />

        <div className="code-toolbar-group">
          <Button
            size="small"
            icon={<FolderOpen size={14} strokeWidth={1.8} />}
            onClick={() => fileInputRef.current?.click()}
          >
            打开
          </Button>
          <Button
            size="small"
            icon={<Save size={14} strokeWidth={1.8} />}
            disabled={!output}
            onClick={() => void saveOutput()}
          >
            保存
          </Button>
          <Button
            size="small"
            icon={<Copy size={14} strokeWidth={1.8} />}
            disabled={!output && !input}
            onClick={() => void copyOutput()}
          >
            复制
          </Button>
          <Button
            size="small"
            icon={<Trash2 size={14} strokeWidth={1.8} />}
            disabled={!input && !output}
            onClick={clearAll}
          >
            清空
          </Button>
        </div>
      </div>

      {status.kind === "error" && (
        <div className="code-notice is-error" role="alert">
          <AlertTriangle size={15} strokeWidth={1.8} />
          <span>
            {status.line !== undefined && (
              <strong>
                第 {status.line} 行
                {status.column !== undefined ? `第 ${status.column} 列` : ""}：
              </strong>
            )}
            {status.message}
          </span>
        </div>
      )}

      {status.kind === "success" && (
        <div className="code-notice is-success" role="status">
          <CheckCircle2 size={15} strokeWidth={1.8} />
          <span>{status.message}</span>
        </div>
      )}

      <div className="code-workspace">
        <section className="code-pane" aria-label="JSON 输入">
          <header className="code-pane-head">
            <span className="code-pane-title">输入</span>
            <span className="code-pane-meta" title={fileName}>
              {fileName ? `${fileName} · ` : ""}
              {textStats(input)}
            </span>
          </header>
          <div className="code-pane-body">
            <Input.TextArea
              className="code-input"
              value={input}
              spellCheck={false}
              placeholder='粘贴 JSON，例如 {"name":"叮当","tools":10}'
              onChange={(event) => {
                setInput(event.target.value);
                setStatus({ kind: "idle" });
              }}
            />
          </div>
        </section>

        <section className="code-pane" aria-label="格式化结果">
          <header className="code-pane-head">
            <span className="code-pane-title">结果</span>
            <div className="code-pane-tools">
              <span className="code-pane-meta">{textStats(output)}</span>
              <label className="code-wrap-toggle">
                <Switch
                  size="small"
                  checked={wrap}
                  onChange={(checked) => setWrap(checked)}
                />
                自动换行
              </label>
            </div>
          </header>
          <div className="code-pane-body">
            {output ? (
              <pre
                className={`code-output${wrap ? " is-wrap" : ""}`}
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            ) : (
              <div className="code-empty">
                <Braces size={28} strokeWidth={1.4} />
                <span>格式化后的 JSON 会显示在这里</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}