import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface BatchFile {
  filename: string;
  blob: Blob;
}

export type BatchResult =
  | { status: "saved"; count: number; path?: string }
  | { status: "cancelled" };

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Writes every result into one folder picked by the user (desktop), or
 * downloads them one by one in the browser preview.
 */
export async function exportBatch(files: BatchFile[]): Promise<BatchResult> {
  if (files.length === 0) return { status: "cancelled" };

  if (isTauri()) {
    const directory = await open({
      directory: true,
      multiple: false,
      title: "选择导出文件夹",
    });
    if (!directory || typeof directory !== "string") {
      return { status: "cancelled" };
    }

    const base = directory.replace(/[\\/]+$/, "");
    for (const file of files) {
      const bytes = new Uint8Array(await file.blob.arrayBuffer());
      await invoke("save_export", {
        path: `${base}\\${file.filename}`,
        bytes: Array.from(bytes),
      });
    }
    return { status: "saved", count: files.length, path: directory };
  }

  for (const file of files) {
    download(file.blob, file.filename);
    await new Promise((resolve) => window.setTimeout(resolve, 140));
  }
  return { status: "saved", count: files.length };
}