use crate::{resolve_pdfium, with_pdfium};
use image::GenericImageView;
use pdfium_render::prelude::*;
use serde::Serialize;
use std::collections::BTreeSet;
use std::path::Path;

const MM_TO_PT: f32 = 72.0 / 25.4;
const A4_WIDTH_PT: f32 = 595.28;
const A4_HEIGHT_PT: f32 = 841.89;

#[derive(Serialize)]
pub struct PdfInfo {
    pub path: String,
    pub pages: usize,
    pub encrypted: bool,
    pub size: u64,
}

fn base_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string())
}

fn parse_pages(spec: &str, total: usize) -> Result<Vec<usize>, String> {
    let mut pages = BTreeSet::new();

    for token in spec.replace(['，', '、'], ",").split(',') {
        let token = token.trim();
        if token.is_empty() {
            continue;
        }
        let parts: Vec<&str> = token.split('-').map(str::trim).collect();
        let (start, end) = match parts.as_slice() {
            [one] => {
                let page = one
                    .parse::<usize>()
                    .map_err(|_| format!("无法识别「{token}」"))?;
                (page, page)
            }
            [first, second] => {
                let start = first
                    .parse::<usize>()
                    .map_err(|_| format!("无法识别「{token}」"))?;
                let end = second
                    .parse::<usize>()
                    .map_err(|_| format!("无法识别「{token}」"))?;
                (start, end)
            }
            _ => return Err(format!("无法识别「{token}」")),
        };

        if start == 0 || end == 0 || start > total || end > total {
            return Err(format!("页码需在 1–{total} 之间"));
        }
        if start > end {
            return Err(format!("「{token}」的起止顺序不对"));
        }
        for page in start..=end {
            pages.insert(page);
        }
    }

    if pages.is_empty() {
        return Err("请输入页码范围".to_string());
    }
    Ok(pages.into_iter().collect())
}

fn pages_to_ranges(pages: &[usize]) -> String {
    let mut parts = Vec::new();
    let mut index = 0;

    while index < pages.len() {
        let start = pages[index];
        let mut end = start;
        while index + 1 < pages.len() && pages[index + 1] == end + 1 {
            index += 1;
            end = pages[index];
        }
        parts.push(if start == end {
            start.to_string()
        } else {
            format!("{start}-{end}")
        });
        index += 1;
    }

    parts.join(",")
}

fn rotation_degrees(rotation: PdfPageRenderRotation) -> i32 {
    match rotation {
        PdfPageRenderRotation::None => 0,
        PdfPageRenderRotation::Degrees90 => 90,
        PdfPageRenderRotation::Degrees180 => 180,
        PdfPageRenderRotation::Degrees270 => 270,
    }
}

fn rotation_from_degrees(degrees: i32) -> Result<PdfPageRenderRotation, String> {
    match degrees.rem_euclid(360) {
        0 => Ok(PdfPageRenderRotation::None),
        90 => Ok(PdfPageRenderRotation::Degrees90),
        180 => Ok(PdfPageRenderRotation::Degrees180),
        270 => Ok(PdfPageRenderRotation::Degrees270),
        _ => Err("旋转角度必须是 90 的倍数".to_string()),
    }
}

fn placed_position(
    position: &str,
    page_width: f32,
    page_height: f32,
    width: f32,
    height: f32,
    margin: f32,
) -> (f32, f32) {
    let column = if position.ends_with("left") {
        0
    } else if position.ends_with("right") {
        2
    } else {
        1
    };
    let row = if position.starts_with("top") {
        0
    } else if position.starts_with("bottom") {
        2
    } else {
        1
    };

    let x = match column {
        0 => margin,
        2 => (page_width - margin - width).max(0.0),
        _ => ((page_width - width) / 2.0).max(0.0),
    };
    let y = match row {
        0 => (page_height - margin - height).max(0.0),
        2 => margin,
        _ => ((page_height - height) / 2.0).max(0.0),
    };

    (x, y)
}

fn load_error(name: &str) -> String {
    format!("无法打开 {name}，可能已加密或文件损坏")
}

#[tauri::command]
pub async fn pdf_info(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<Vec<PdfInfo>, String> {
    let dll = resolve_pdfium(&app)?;

    let result = tauri::async_runtime::spawn_blocking(move || {
        with_pdfium(&dll, |pdfium| {
            let mut infos = Vec::with_capacity(paths.len());

            for path in &paths {
                let metadata = std::fs::metadata(path)
                    .map_err(|error| format!("无法读取 {}: {error}", base_name(path)))?;
                let bytes = std::fs::read(path)
                    .map_err(|error| format!("无法读取 {}: {error}", base_name(path)))?;

                let (pages, encrypted) = match pdfium.load_pdf_from_byte_slice(&bytes, None) {
                    Ok(document) => (document.pages().len() as usize, false),
                    Err(_) => (0, true),
                };

                infos.push(PdfInfo {
                    path: path.clone(),
                    pages,
                    encrypted,
                    size: metadata.len(),
                });
            }

            Ok(infos)
        })
    })
    .await
    .map_err(|error| error.to_string())?;

    result
}

#[tauri::command]
pub async fn pdf_merge(
    app: tauri::AppHandle,
    paths: Vec<String>,
    output: String,
) -> Result<usize, String> {
    if paths.len() < 2 {
        return Err("至少选择两个 PDF 文件".to_string());
    }
    let dll = resolve_pdfium(&app)?;

    let result = tauri::async_runtime::spawn_blocking(move || {
        with_pdfium(&dll, |pdfium| {
            let mut merged = pdfium
                .create_new_pdf()
                .map_err(|error| error.to_string())?;

            for path in &paths {
                let bytes = std::fs::read(path)
                    .map_err(|error| format!("无法读取 {}: {error}", base_name(path)))?;
                let document = pdfium
                    .load_pdf_from_byte_slice(&bytes, None)
                    .map_err(|_| load_error(&base_name(path)))?;
                if document.pages().is_empty() {
                    continue;
                }
                merged
                    .pages_mut()
                    .append(&document)
                    .map_err(|error| format!("合并 {} 失败: {error}", base_name(path)))?;
            }

            let count = merged.pages().len() as usize;
            if count == 0 {
                return Err("没有可合并的页面".to_string());
            }
            merged
                .save_to_file(&output)
                .map_err(|error| format!("保存失败: {error}"))?;
            Ok(count)
        })
    })
    .await
    .map_err(|error| error.to_string())?;

    result
}

#[tauri::command]
pub async fn pdf_extract(
    app: tauri::AppHandle,
    path: String,
    pages: String,
    output: String,
) -> Result<usize, String> {
    let dll = resolve_pdfium(&app)?;

    let result = tauri::async_runtime::spawn_blocking(move || {
        with_pdfium(&dll, |pdfium| {
            let bytes = std::fs::read(&path)
                .map_err(|error| format!("无法读取 {}: {error}", base_name(&path)))?;
            let document = pdfium
                .load_pdf_from_byte_slice(&bytes, None)
                .map_err(|_| load_error(&base_name(&path)))?;
            let total = document.pages().len() as usize;
            let selected = parse_pages(&pages, total)?;
            let spec = pages_to_ranges(&selected);

            let mut extracted = pdfium
                .create_new_pdf()
                .map_err(|error| error.to_string())?;
            extracted
                .pages_mut()
                .copy_pages_from_document(&document, &spec, 0)
                .map_err(|error| format!("提取页面失败: {error}"))?;
            extracted
                .save_to_file(&output)
                .map_err(|error| format!("保存失败: {error}"))?;

            Ok(selected.len())
        })
    })
    .await
    .map_err(|error| error.to_string())?;

    result
}

#[tauri::command]
pub async fn pdf_delete(
    app: tauri::AppHandle,
    path: String,
    pages: String,
    output: String,
) -> Result<usize, String> {
    let dll = resolve_pdfium(&app)?;

    let result = tauri::async_runtime::spawn_blocking(move || {
        with_pdfium(&dll, |pdfium| {
            let bytes = std::fs::read(&path)
                .map_err(|error| format!("无法读取 {}: {error}", base_name(&path)))?;
            let document = pdfium
                .load_pdf_from_byte_slice(&bytes, None)
                .map_err(|_| load_error(&base_name(&path)))?;
            let total = document.pages().len() as usize;
            let removed = parse_pages(&pages, total)?;
            let removed_set: BTreeSet<usize> = removed.iter().copied().collect();
            let kept: Vec<usize> = (1..=total)
                .filter(|page| !removed_set.contains(page))
                .collect();
            if kept.is_empty() {
                return Err("不能删除全部页面".to_string());
            }

            let spec = pages_to_ranges(&kept);
            let mut result_document = pdfium
                .create_new_pdf()
                .map_err(|error| error.to_string())?;
            result_document
                .pages_mut()
                .copy_pages_from_document(&document, &spec, 0)
                .map_err(|error| format!("删除页面失败: {error}"))?;
            result_document
                .save_to_file(&output)
                .map_err(|error| format!("保存失败: {error}"))?;

            Ok(kept.len())
        })
    })
    .await
    .map_err(|error| error.to_string())?;

    result
}

#[tauri::command]
pub async fn pdf_rotate(
    app: tauri::AppHandle,
    path: String,
    pages: String,
    degrees: i32,
    output: String,
) -> Result<usize, String> {
    if degrees.rem_euclid(90) != 0 {
        return Err("旋转角度必须是 90 的倍数".to_string());
    }
    let dll = resolve_pdfium(&app)?;

    let result = tauri::async_runtime::spawn_blocking(move || {
        with_pdfium(&dll, |pdfium| {
            let bytes = std::fs::read(&path)
                .map_err(|error| format!("无法读取 {}: {error}", base_name(&path)))?;
            let mut document = pdfium
                .load_pdf_from_byte_slice(&bytes, None)
                .map_err(|_| load_error(&base_name(&path)))?;
            let total = document.pages().len() as usize;
            let selected = parse_pages(&pages, total)?;

            for page_number in &selected {
                let mut page = document
                    .pages_mut()
                    .get((*page_number - 1) as PdfPageIndex)
                    .map_err(|error| error.to_string())?;
                let current = rotation_degrees(
                    page.rotation().map_err(|error| error.to_string())?,
                );
                let next = rotation_from_degrees(current + degrees)?;
                page.set_rotation(next);
            }

            document
                .save_to_file(&output)
                .map_err(|error| format!("保存失败: {error}"))?;

            Ok(selected.len())
        })
    })
    .await
    .map_err(|error| error.to_string())?;

    result
}

#[tauri::command]
pub async fn pdf_images_to_pdf(
    app: tauri::AppHandle,
    paths: Vec<String>,
    output: String,
    page_size: String,
    orientation: String,
    margin_mm: f32,
) -> Result<usize, String> {
    if paths.is_empty() {
        return Err("请选择图片".to_string());
    }
    let dll = resolve_pdfium(&app)?;
    let auto_page = page_size == "auto";
    let landscape = orientation == "landscape";

    let result = tauri::async_runtime::spawn_blocking(move || {
        with_pdfium(&dll, |pdfium| {
            let margin = margin_mm.max(0.0) * MM_TO_PT;
            let mut document = pdfium
                .create_new_pdf()
                .map_err(|error| error.to_string())?;

            for path in &paths {
                let image = image::open(path)
                    .map_err(|_| format!("无法读取图片 {}", base_name(path)))?;
                let (image_width, image_height) = image.dimensions();
                if image_width == 0 || image_height == 0 {
                    return Err(format!("图片 {} 尺寸无效", base_name(path)));
                }

                let (page_width, page_height, draw_width, draw_height) = if auto_page {
                    let width = image_width as f32 * 0.75 + margin * 2.0;
                    let height = image_height as f32 * 0.75 + margin * 2.0;
                    (
                        width.max(1.0),
                        height.max(1.0),
                        image_width as f32 * 0.75,
                        image_height as f32 * 0.75,
                    )
                } else {
                    let (width, height) = if landscape {
                        (A4_HEIGHT_PT, A4_WIDTH_PT)
                    } else {
                        (A4_WIDTH_PT, A4_HEIGHT_PT)
                    };
                    let available_width = (width - margin * 2.0).max(1.0);
                    let available_height = (height - margin * 2.0).max(1.0);
                    let scale = (available_width / image_width as f32)
                        .min(available_height / image_height as f32);
                    (
                        width,
                        height,
                        image_width as f32 * scale,
                        image_height as f32 * scale,
                    )
                };

                let mut page = document
                    .pages_mut()
                    .create_page_at_end(PdfPagePaperSize::from_points(
                        PdfPoints::new(page_width),
                        PdfPoints::new(page_height),
                    ))
                    .map_err(|error| error.to_string())?;
                let x = ((page_width - draw_width) / 2.0).max(0.0);
                let y = ((page_height - draw_height) / 2.0).max(0.0);
                page.objects_mut()
                    .create_image_object(
                        PdfPoints::new(x),
                        PdfPoints::new(y),
                        &image,
                        Some(PdfPoints::new(draw_width)),
                        Some(PdfPoints::new(draw_height)),
                    )
                    .map_err(|error| format!("添加图片失败: {error}"))?;
            }

            document
                .save_to_file(&output)
                .map_err(|error| format!("保存失败: {error}"))?;
            Ok(paths.len())
        })
    })
    .await
    .map_err(|error| error.to_string())?;

    result
}

fn load_watermark_font(document: &mut PdfDocument<'_>) -> Result<PdfFontToken, String> {
    let candidates = [
        "C:\\Windows\\Fonts\\simhei.ttf",
        "C:\\Windows\\Fonts\\simkai.ttf",
        "C:\\Windows\\Fonts\\simfang.ttf",
    ];
    for candidate in candidates {
        if Path::new(candidate).is_file() {
            if let Ok(token) = document.fonts_mut().load_true_type_from_file(candidate, true) {
                return Ok(token);
            }
        }
    }
    Err("找不到可用的中文字体（需要系统自带的黑体或楷体）".to_string())
}

#[tauri::command]
pub async fn pdf_watermark(
    app: tauri::AppHandle,
    path: String,
    output: String,
    text: String,
    pages: String,
    size: f32,
    color: String,
    position: String,
    margin_mm: f32,
) -> Result<usize, String> {
    if text.trim().is_empty() {
        return Err("请输入水印文字".to_string());
    }
    let dll = resolve_pdfium(&app)?;
    let font_size = size.clamp(6.0, 400.0);

    let result = tauri::async_runtime::spawn_blocking(move || {
        with_pdfium(&dll, |pdfium| {
            let bytes = std::fs::read(&path)
                .map_err(|error| format!("无法读取 {}: {error}", base_name(&path)))?;
            let mut document = pdfium
                .load_pdf_from_byte_slice(&bytes, None)
                .map_err(|_| load_error(&base_name(&path)))?;
            let total = document.pages().len() as usize;
            let selected = parse_pages(&pages, total)?;
            let font = load_watermark_font(&mut document)?;
            let fill = PdfColor::from_hex(&color).unwrap_or(PdfColor::new(120, 120, 120, 255));
            let margin = margin_mm.max(0.0) * MM_TO_PT;

            for page_number in &selected {
                let mut page = document
                    .pages_mut()
                    .get((*page_number - 1) as PdfPageIndex)
                    .map_err(|error| error.to_string())?;
                let page_width = page.width().value;
                let page_height = page.height().value;
                let mut object = page
                    .objects_mut()
                    .create_text_object(
                        PdfPoints::new(0.0),
                        PdfPoints::new(0.0),
                        &text,
                        font,
                        PdfPoints::new(font_size),
                    )
                    .map_err(|error| format!("添加水印失败: {error}"))?;
                object
                    .set_fill_color(fill)
                    .map_err(|error| error.to_string())?;
                let width = object.width().map(|value| value.value).unwrap_or(0.0);
                let height = object.height().map(|value| value.value).unwrap_or(0.0);
                let (x, y) = placed_position(
                    &position,
                    page_width,
                    page_height,
                    width,
                    height,
                    margin,
                );
                object
                    .translate(PdfPoints::new(x), PdfPoints::new(y))
                    .map_err(|error| error.to_string())?;
            }

            document
                .save_to_file(&output)
                .map_err(|error| format!("保存失败: {error}"))?;
            Ok(selected.len())
        })
    })
    .await
    .map_err(|error| error.to_string())?;

    result
}

#[tauri::command]
pub async fn pdf_stamp(
    app: tauri::AppHandle,
    path: String,
    output: String,
    image_path: String,
    pages: String,
    width_percent: f32,
    position: String,
    margin_mm: f32,
) -> Result<usize, String> {
    let dll = resolve_pdfium(&app)?;
    let stamp_image = image::open(&image_path)
        .map_err(|_| format!("无法读取图片 {}", base_name(&image_path)))?;
    let percent = width_percent.clamp(1.0, 100.0);

    let result = tauri::async_runtime::spawn_blocking(move || {
        with_pdfium(&dll, |pdfium| {
            let bytes = std::fs::read(&path)
                .map_err(|error| format!("无法读取 {}: {error}", base_name(&path)))?;
            let mut document = pdfium
                .load_pdf_from_byte_slice(&bytes, None)
                .map_err(|_| load_error(&base_name(&path)))?;
            let total = document.pages().len() as usize;
            let selected = parse_pages(&pages, total)?;
            let margin = margin_mm.max(0.0) * MM_TO_PT;
            let image_width = stamp_image.width() as f32;
            let image_height = stamp_image.height() as f32;

            for page_number in &selected {
                let mut page = document
                    .pages_mut()
                    .get((*page_number - 1) as PdfPageIndex)
                    .map_err(|error| error.to_string())?;
                let page_width = page.width().value;
                let page_height = page.height().value;
                let draw_width = (page_width * percent / 100.0)
                    .max(1.0)
                    .min(page_width);
                let draw_height = draw_width * image_height / image_width;
                let (x, y) = placed_position(
                    &position,
                    page_width,
                    page_height,
                    draw_width,
                    draw_height,
                    margin,
                );
                page.objects_mut()
                    .create_image_object(
                        PdfPoints::new(x),
                        PdfPoints::new(y),
                        &stamp_image,
                        Some(PdfPoints::new(draw_width)),
                        Some(PdfPoints::new(draw_height)),
                    )
                    .map_err(|error| format!("添加图片失败: {error}"))?;
            }

            document
                .save_to_file(&output)
                .map_err(|error| format!("保存失败: {error}"))?;
            Ok(selected.len())
        })
    })
    .await
    .map_err(|error| error.to_string())?;

    result
}

#[tauri::command]
pub async fn pdf_decrypt(
    path: String,
    password: String,
    output: String,
) -> Result<(), String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let bytes = std::fs::read(&path)
            .map_err(|error| format!("无法读取 {}: {error}", base_name(&path)))?;
        let mut document = lopdf::Document::load_mem_with_options(
            &bytes,
            lopdf::LoadOptions::with_password(&password),
        )
        .map_err(|_| "无法打开 PDF，密码可能不正确".to_string())?;

        if document.is_encrypted() {
            return Err("密码不正确".to_string());
        }

        document.encryption_state = None;
        let mut saved = Vec::new();
        document
            .save_to(&mut saved)
            .map_err(|error| format!("保存失败: {error}"))?;
        std::fs::write(&output, saved)
            .map_err(|error| format!("写入文件失败: {error}"))?;
        Ok(())
    })
    .await
    .map_err(|error| error.to_string())?;

    result
}

