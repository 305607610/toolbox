import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { isTauri } from "../seal/save";

export type HtmlSaveResult =
  | { status: "saved"; path: string }
  | { status: "cancelled" };

/**
 * Writes the exported HTML as a single file. The desktop path uses a string
 * command, so a large document never turns into one giant JSON number array.
 */
export async function saveHtml(
  html: string,
  filename: string,
): Promise<HtmlSaveResult> {
  const defaultName = filename.toLowerCase().endsWith(".html")
    ? filename
    : `${filename}.html`;

  if (isTauri()) {
    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: "HTML", extensions: ["html"] }],
    });
    if (!path) return { status: "cancelled" };

    const finalPath = path.toLowerCase().endsWith(".html")
      ? path
      : `${path}.html`;
    await invoke("save_export_html", { path: finalPath, html });
    return { status: "saved", path: finalPath };
  }

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
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