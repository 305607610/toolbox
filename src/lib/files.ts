import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { isTauri } from "../seal/save";
import { sanitizeFilename } from "../seal/filename";

export type RawSaveResult =
  | { status: "saved"; path: string }
  | { status: "cancelled" };

/** Saves arbitrary bytes, used when the output has no fixed extension. */
export async function saveRawBytes(
  bytes: Uint8Array,
  filename: string,
): Promise<RawSaveResult> {
  const defaultName = sanitizeFilename(filename, "文件");

  if (isTauri()) {
    const path = await save({ defaultPath: defaultName });
    if (!path) return { status: "cancelled" };
    await invoke("save_export", { path, bytes: Array.from(bytes) });
    return { status: "saved", path };
  }

  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([buffer]));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = defaultName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { status: "saved", path: defaultName };
}

export function readFileBytes(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}

export function stemOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}