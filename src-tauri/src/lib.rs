mod font;
mod pdf;
mod pdftools;

use base64::Engine;
use pdfium_render::prelude::Pdfium;
use std::sync::{Mutex, OnceLock};
use tauri::Manager;

static PDFIUM: OnceLock<Mutex<Option<Pdfium>>> = OnceLock::new();

pub(crate) fn with_pdfium<T>(
    dll: &str,
    operation: impl FnOnce(&Pdfium) -> Result<T, String>,
) -> Result<T, String> {
    let slot = PDFIUM.get_or_init(|| Mutex::new(None));
    let mut guard = slot.lock().map_err(|_| "PDF 引擎初始化失败".to_string())?;

    if guard.is_none() {
        let bindings = Pdfium::bind_to_library(dll).map_err(|error| error.to_string())?;
        *guard = Some(Pdfium::new(bindings));
    }

    operation(guard.as_ref().expect("pdfium initialized"))
}

#[tauri::command]
fn save_export(path: String, bytes: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_export_html(path: String, html: String) -> Result<(), String> {
    std::fs::write(&path, html.as_bytes()).map_err(|error| error.to_string())
}

pub(crate) fn resolve_pdfium(app: &tauri::AppHandle) -> Result<String, String> {
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("resources").join("pdfium.dll"));
        candidates.push(cwd.join("pdfium.dll"));
    }
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("resources").join("pdfium.dll"));
        candidates.push(dir.join("pdfium.dll"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("resources").join("pdfium.dll"));
            candidates.push(parent.join("pdfium.dll"));
        }
    }

    for path in candidates {
        if path.is_file() {
            return Ok(path.to_string_lossy().into_owned());
        }
    }

    Err("找不到 pdfium.dll".to_string())
}

#[tauri::command]
async fn pdf_convert(
    app: tauri::AppHandle,
    base64: String,
    password: Option<String>,
    dpi: u32,
    pages: Vec<usize>,
    preview: bool,
    title: String,
) -> Result<pdf::PdfConvertResult, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64)
        .map_err(|_| "无法读取 PDF 文件".to_string())?;
    let dll = resolve_pdfium(&app)?;
    let had_password = password.is_some();
    let options = pdf::Options {
        dpi: dpi as f32,
        pages,
        preview,
        title,
    };

    let result = tauri::async_runtime::spawn_blocking(move || {
        with_pdfium(&dll, |pdfium| {
            pdf::convert(pdfium, &bytes, password.as_deref(), &options)
        })
    })
    .await
    .map_err(|error| error.to_string())?;

    match result {
        Ok(result) => Ok(result),
        Err(error) => {
            let lower = error.to_lowercase();
            if lower.contains("password") || lower.contains("encrypted") {
                if had_password {
                    Err("invalid-password".to_string())
                } else {
                    Err("password-required".to_string())
                }
            } else {
                Err(error)
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_export,
            save_export_html,
            pdf_convert,
            pdftools::pdf_info,
            pdftools::pdf_merge,
            pdftools::pdf_extract,
            pdftools::pdf_delete,
            pdftools::pdf_rotate,
            pdftools::pdf_images_to_pdf,
            pdftools::pdf_watermark,
            pdftools::pdf_stamp,
            pdftools::pdf_decrypt
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
