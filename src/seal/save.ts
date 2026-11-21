import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

export type SaveFormat = "png" | "svg" | "jpg" | "webp";

const MIME: Record<SaveFormat, string> = {
  png: "image/png",
  svg: "image/svg+xml",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export type SaveResult =
  | { status: "saved"; path: string }
  | { status: "cancelled" };

export const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function withExtension(filename: string, format: SaveFormat): string {
  const suffix = `.${format}`;
  return filename.toLowerCase().endsWith(suffix)
    ? filename
    : `${filename}${suffix}`;
}

export async function saveExport(
  bytes: Uint8Array,
  filename: string,
  format: SaveFormat,
): Promise<SaveResult> {
  const defaultName = withExtension(filename, format);

  if (isTauri()) {
    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (!path) return { status: "cancelled" };

    const finalPath = withExtension(path, format);
    await invoke("save_export", {
      path: finalPath,
      bytes: Array.from(bytes),
    });
    return { status: "saved", path: finalPath };
  }

  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type: MIME[format] });
  const url = URL.createObjectURL(blob);
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