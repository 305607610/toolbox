use crate::font::{FontMaps, collect_font_maps, has_unicode_cmap, prepare_font};
use base64::Engine;
use image::{DynamicImage, ImageFormat};
use pdfium_render::prelude::*;
use serde::Serialize;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::io::Cursor;

const CSS_SCALE: f32 = 96.0 / 72.0;

#[derive(Clone)]
pub struct Options {
    pub dpi: f32,
    pub pages: Vec<usize>,
    pub preview: bool,
    pub title: String,
}

#[derive(Serialize)]
pub struct PdfConvertResult {
    pub html: String,
    pub page_count: usize,
    pub warnings: Vec<String>,
}

pub fn convert(
    pdfium: &Pdfium,
    bytes: &[u8],
    password: Option<&str>,
    options: &Options,
) -> Result<PdfConvertResult, String> {
    let doc = pdfium
        .load_pdf_from_byte_slice(bytes, password)
        .map_err(|e| e.to_string())?;

    let page_count = doc.pages().len() as usize;
    let indices: Vec<usize> = if options.pages.is_empty() {
        (0..page_count).collect()
    } else {
        options
            .pages
            .iter()
            .copied()
            .filter(|index| *index < page_count)
            .collect()
    };

    let mut font_faces = String::new();
    let mut embedded_fonts: HashMap<u64, usize> = HashMap::new();
    let mut font_cache: HashMap<String, Option<String>> = HashMap::new();
    let font_maps: FontMaps = collect_font_maps(bytes);
    let mut warnings = Vec::new();
    let mut sizes: Vec<(f32, f32)> = Vec::new();
    let mut pages_html = String::new();

    for &index in &indices {
        let mut page = doc.pages().get(index as i32).map_err(|e| e.to_string())?;
        let width_pt = page.width().value;
        let height_pt = page.height().value;
        let width_mm = width_pt * 25.4 / 72.0;
        let height_mm = height_pt * 25.4 / 72.0;
        let size_key = (
            (width_mm * 100.0).round() / 100.0,
            (height_mm * 100.0).round() / 100.0,
        );
        let size_index = match sizes.iter().position(|size| {
            (size.0 - size_key.0).abs() < 0.01 && (size.1 - size_key.1).abs() < 0.01
        }) {
            Some(index) => index,
            None => {
                sizes.push(size_key);
                sizes.len() - 1
            }
        };

        let html = render_page(
            &mut page,
            &doc,
            index,
            options.dpi,
            &font_maps,
            &mut font_cache,
            &mut font_faces,
            &mut embedded_fonts,
            &mut warnings,
        )?;

        pages_html.push_str(&format!(
            "<section class=\"page\" data-size=\"{size_index}\" style=\"width:{:.3}px;height:{:.3}px\">\n{html}</section>\n",
            width_pt * CSS_SCALE,
            height_pt * CSS_SCALE
        ));
    }

    let html = build_document(
        &options.title,
        &font_faces,
        &pages_html,
        &sizes,
        options.preview,
    );

    Ok(PdfConvertResult {
        html,
        page_count,
        warnings,
    })
}

fn render_page(
    page: &mut PdfPage<'_>,
    doc: &PdfDocument<'_>,
    page_index: usize,
    dpi: f32,
    font_maps: &FontMaps,
    font_cache: &mut HashMap<String, Option<String>>,
    font_faces: &mut String,
    embedded_fonts: &mut HashMap<u64, usize>,
    warnings: &mut Vec<String>,
) -> Result<String, String> {
    let page_w = page.width().value;
    let page_h = page.height().value;
    let text_page = page.text().map_err(|e| e.to_string())?;

    let mut text_html = String::new();
    let mut image_html = String::new();
    let mut glyph_html = String::new();
    let mut glyph_crops: Vec<(f32, f32, f32, f32, usize)> = Vec::new();
    let mut path_data = String::new();
    let mut clip_defs = String::new();
    let mut clip_count = 0usize;
    let mut remove = Vec::new();
    let mut text_count = 0usize;

    for (idx, obj) in page.objects().iter().enumerate() {
        match obj.object_type() {
            PdfPageObjectType::Text => {
                let text_object = obj.as_text_object().unwrap();
                let raw_text = text_object.text().replace(['\r', '\n'], " ");
                if raw_text.trim().is_empty() {
                    remove.push(idx);
                    continue;
                }

                let matrix = text_object.matrix().map_err(|e| e.to_string())?;
                let font = text_object.font();
                let font_name = font.name();
                let font_family = font.family();
                let is_embedded = font.is_embedded().unwrap_or(false);

                // For a font that is not embedded, Pdfium's family name is the
                // font it actually substituted when rendering the PDF. Prefer
                // that over the original name, otherwise an installed font with
                // the original name (for example STSong) would be used even
                // though Pdfium rendered the page with SimSun.
                let primary_name = if is_embedded {
                    if font_name.is_empty() {
                        &font_family
                    } else {
                        &font_name
                    }
                } else if !font_family.is_empty() {
                    &font_family
                } else {
                    &font_name
                };
                let fallback_family = font_stack(&[primary_name]);
                let embedded = embedded_font_family(
                    &font,
                    &font_name,
                    font_maps,
                    font_cache,
                    embedded_fonts,
                    font_faces,
                );
                let has_embedded = embedded.is_some();
                let family = match embedded {
                    Some(embedded) => format!("{embedded},{fallback_family}"),
                    None => fallback_family,
                };

                // PDFium's scaled_font_size() only looks at matrix.d, which falls apart for
                // rotated text; use the true vertical scale instead.
                let vertical_scale = (matrix.c() * matrix.c() + matrix.d() * matrix.d()).sqrt();
                let unscaled_size = text_object.unscaled_font_size().value;
                let size_pt = if vertical_scale > 0.0001 {
                    unscaled_size * vertical_scale
                } else {
                    unscaled_size
                };
                let size_pt = if size_pt > 0.01 {
                    size_pt
                } else {
                    unscaled_size
                };
                let size_css = size_pt * CSS_SCALE;

                let ascent_pt = font
                    .ascent(PdfPoints::new(size_pt))
                    .map(|p| p.value)
                    .unwrap_or(size_pt * 0.86);
                let descent_pt = font
                    .descent(PdfPoints::new(size_pt))
                    .map(|p| -p.value)
                    .unwrap_or(size_pt * 0.14);
                let baseline_offset_pt = (size_pt - (ascent_pt + descent_pt)) / 2.0 + ascent_pt;
                let baseline_offset_css = baseline_offset_pt * CSS_SCALE;

                let color = text_object
                    .fill_color()
                    .map(|c| color_css(&c))
                    .unwrap_or_else(|_| "#111".to_string());
                let invisible =
                    matches!(text_object.render_mode(), PdfPageTextRenderMode::Invisible);
                let angle = matrix.b().atan2(matrix.a());
                let css_angle = -angle;
                let (ux, uy) = (angle.cos(), angle.sin());

                let lower_name = format!("{font_name} {font_family}").to_lowercase();
                let bold = font.is_bold_reenforced()
                    || lower_name.contains("bold")
                    || lower_name.contains("black")
                    || matches!(
                        font.weight(),
                        Ok(PdfFontWeight::Weight600
                            | PdfFontWeight::Weight700Bold
                            | PdfFontWeight::Weight800
                            | PdfFontWeight::Weight900)
                    )
                    || matches!(font.weight(), Ok(PdfFontWeight::Custom(w)) if w >= 600);
                let italic = font.is_italic()
                    || lower_name.contains("italic")
                    || lower_name.contains("oblique");

                let mut style_common = format!(
                    "font-size:{size_css:.3}px;font-family:{family};color:{};z-index:{};",
                    if invisible { "transparent" } else { &color },
                    idx + 10
                );
                // An embedded face already is the exact PDF face; applying CSS bold or
                // italic on top would synthesize a second styling on it.
                if bold && !has_embedded {
                    style_common.push_str("font-weight:700;");
                }
                if italic && !has_embedded {
                    style_common.push_str("font-style:italic;");
                }

                struct TextChar {
                    ch: char,
                    x: f32,
                    y: f32,
                    advance: f32,
                }

                let mut items: Vec<TextChar> = Vec::new();
                if let Ok(chars) = text_object.chars(&text_page) {
                    for ch in chars.iter() {
                        let (x, y) = ch
                            .origin()
                            .map(|(x, y)| (x.value, y.value))
                            .unwrap_or((matrix.e(), matrix.f()));
                        let advance = ch
                            .loose_bounds()
                            .map(|bounds| (bounds.right().value - x).max(0.0))
                            .unwrap_or(size_pt * 0.5);
                        let unicode = ch.unicode_char();
                        let mut display = unicode.filter(|ch| !ch.is_control()).unwrap_or(' ');

                        // Some PDFs use glyphs with no Unicode mapping (checkboxes,
                        // symbols, private-use characters). Keep their advance in the
                        // text flow but render the glyph itself as a small raster crop.
                        if unicode.is_none() || ch.unicode_value() == 0 {
                            if let Ok(bounds) = ch.tight_bounds() {
                                let padding = 0.4;
                                let left = (bounds.left().value - padding).max(0.0);
                                let right = (bounds.right().value + padding).min(page_w);
                                let bottom = (bounds.bottom().value - padding).max(0.0);
                                let top = (bounds.top().value + padding).min(page_h);
                                if right > left && top > bottom {
                                    glyph_crops.push((left, bottom, right, top, idx + 10));
                                }
                                display = ' ';
                            }
                        }

                        items.push(TextChar {
                            ch: display,
                            x,
                            y,
                            advance,
                        });
                    }
                }

                if items.is_empty() {
                    let left = matrix.e() * CSS_SCALE;
                    let baseline = (page_h - matrix.f()) * CSS_SCALE;
                    let top = baseline - baseline_offset_css;
                    text_html.push_str(&format!(
                        "<span class=\"t{}\" data-baseline=\"{baseline:.3}\" style=\"left:{left:.3}px;top:{top:.3}px;{style_common}transform-origin:0 {baseline_offset_css:.3}px;transform:rotate({css_angle:.6}rad);\">{}</span>\n",
                        if invisible { " inv" } else { "" },
                        escape(&raw_text)
                    ));
                    text_count += 1;
                    remove.push(idx);
                    continue;
                }

                // Characters can share an object across several baselines (superscripts,
                // rotated labels, multi-line fragments); split them into visual runs.
                let mut segments: Vec<Vec<usize>> = Vec::new();
                let mut current: Vec<usize> = Vec::new();
                for index in 0..items.len() {
                    let split = if current.is_empty() {
                        false
                    } else {
                        let first = &items[current[0]];
                        let dx = items[index].x - first.x;
                        let dy = items[index].y - first.y;
                        let perpendicular = -dx * uy + dy * ux;
                        let along = dx * ux + dy * uy;
                        perpendicular.abs() > 0.35 || along < -0.01
                    };
                    if split {
                        segments.push(std::mem::take(&mut current));
                    }
                    current.push(index);
                }
                if !current.is_empty() {
                    segments.push(current);
                }

                for segment in segments {
                    let first = &items[segment[0]];
                    let left = first.x * CSS_SCALE;
                    let baseline = (page_h - first.y) * CSS_SCALE;
                    let top = baseline - baseline_offset_css;

                    let mut chars_html = String::new();
                    for (position, &index) in segment.iter().enumerate() {
                        let width_pt = if position + 1 < segment.len() {
                            let next = &items[segment[position + 1]];
                            let current = &items[index];
                            let dx = next.x - current.x;
                            let dy = next.y - current.y;
                            (dx * ux + dy * uy).max(0.0)
                        } else if angle.abs() < 0.0001 {
                            // Loose bounds give the exact advance width, unlike tight bounds
                            // which only cover the inked part of the glyph.
                            items[index].advance
                        } else if position > 0 {
                            let previous = &items[segment[position - 1]];
                            let current = &items[index];
                            let dx = current.x - previous.x;
                            let dy = current.y - previous.y;
                            (dx * ux + dy * uy).max(0.0)
                        } else {
                            size_pt * 0.5
                        };
                        let width_css = width_pt * CSS_SCALE;
                        chars_html.push_str(&format!(
                            "<span class=\"c\" data-a=\"{width_css:.3}\" style=\"width:{width_css:.3}px\">{}</span>",
                            escape(&items[index].ch.to_string())
                        ));
                    }

                    let rotation = if css_angle.abs() > 0.000001 {
                        format!(
                            "transform:rotate({css_angle:.6}rad);transform-origin:0 {baseline_offset_css:.3}px;"
                        )
                    } else {
                        String::new()
                    };
                    text_html.push_str(&format!(
                        "<span class=\"t{}\" data-baseline=\"{baseline:.3}\" style=\"left:{left:.3}px;top:{top:.3}px;{style_common}{rotation}\">{chars_html}</span>\n",
                        if invisible { " inv" } else { "" }
                    ));
                    text_count += 1;
                }
                remove.push(idx);
            }
            PdfPageObjectType::Image => {
                // An HTML <img> cannot carry a PDF clip path. Leaving the image in
                // the page renders it (with its clip) in the background instead of
                // exposing the unclipped rectangle as a solid block.
                if obj
                    .get_clip_path()
                    .map(|clip| !clip.is_empty())
                    .unwrap_or(false)
                {
                    continue;
                }

                let image_object = obj.as_image_object().unwrap();
                let mut extracted = false;
                if let Ok(image) = image_object.get_processed_image(doc) {
                    if let Some(url) = data_url(&image) {
                        let matrix = image_object.matrix().map_err(|e| e.to_string())?;
                        let (a, b, c, d, e, f) = (
                            matrix.a(),
                            matrix.b(),
                            matrix.c(),
                            matrix.d(),
                            matrix.e(),
                            matrix.f(),
                        );
                        let w_pts = (a * a + b * b).sqrt();
                        let h_pts = (c * c + d * d).sqrt();
                        if w_pts > 0.0 && h_pts > 0.0 {
                            let css_w = w_pts * CSS_SCALE;
                            let css_h = h_pts * CSS_SCALE;
                            let mx = a / w_pts;
                            let my = -b / w_pts;
                            let nx = -c / h_pts;
                            let ny = d / h_pts;
                            let left = (e + c) * CSS_SCALE;
                            let top = (page_h - (f + d)) * CSS_SCALE;
                            image_html.push_str(&format!(
                                "<img class=\"img\" src=\"{url}\" alt=\"\" style=\"width:{css_w:.3}px;height:{css_h:.3}px;transform:matrix({mx:.6},{my:.6},{nx:.6},{ny:.6},{left:.3},{top:.3});z-index:{};\">\n",
                                idx + 5
                            ));
                            extracted = true;
                        }
                    }
                }
                if extracted {
                    remove.push(idx);
                }
            }
            PdfPageObjectType::Path => {
                let path = obj.as_path_object().unwrap();
                let segment_collection = path.segments();
                let segments: Vec<_> = segment_collection.iter().collect();

                let matrix = path.matrix().map_err(|e| e.to_string())?;

                // A white rectangle covering the whole page is just the page
                // background. Keeping it as an SVG layer would hide any art that
                // has to stay in the raster background (bezier symbols, seals).
                let covers_page = obj
                    .bounds()
                    .map(|bounds| {
                        bounds.left().value <= 1.0
                            && bounds.bottom().value <= 1.0
                            && bounds.right().value >= page_w - 1.0
                            && bounds.top().value >= page_h - 1.0
                    })
                    .unwrap_or(false);
                if covers_page
                    && !path.is_stroked().unwrap_or(false)
                    && matches!(
                        path.fill_mode(),
                        Ok(PdfPathFillMode::Winding) | Ok(PdfPathFillMode::EvenOdd)
                    )
                {
                    if let Ok(fill) = path.fill_color() {
                        if fill.alpha() == 255
                            && fill.red() >= 250
                            && fill.green() >= 250
                            && fill.blue() >= 250
                        {
                            remove.push(idx);
                            continue;
                        }
                    }
                }

                let mut clip_attr = String::new();
                if let Some(clip) = obj.get_clip_path() {
                    if !clip.is_empty() {
                        let mut clip_d = String::new();
                        for clip_path in clip.iter() {
                            clip_d.push_str(&segments_to_svg(clip_path.iter(), None));
                        }
                        if clip_d.trim().is_empty() {
                            // Without its clip this path would turn into a solid
                            // block; keep it in the page background instead.
                            continue;
                        }

                        let clip_id = format!("clip-{page_index}-{clip_count}");
                        clip_count += 1;
                        clip_defs.push_str(&format!(
                            "<clipPath id=\"{clip_id}\" clipPathUnits=\"userSpaceOnUse\"><path d=\"{clip_d}\" clip-rule=\"nonzero\"/></clipPath>\n"
                        ));
                        clip_attr = format!(" clip-path=\"url(#{clip_id})\"");
                    }
                }

                let d = segments_to_svg(segments.into_iter(), Some(&matrix));
                if d.trim().is_empty() {
                    remove.push(idx);
                    continue;
                }

                let fill_mode = path.fill_mode().ok();
                let stroked = path.is_stroked().unwrap_or(false);
                let has_fill = !matches!(fill_mode, None | Some(PdfPathFillMode::None));
                let fill = if has_fill {
                    path.fill_color()
                        .map(|c| color_css(&c))
                        .unwrap_or_else(|_| "none".to_string())
                } else {
                    "none".to_string()
                };
                let stroke = if stroked {
                    path.stroke_color()
                        .map(|c| color_css(&c))
                        .unwrap_or_else(|_| "none".to_string())
                } else {
                    "none".to_string()
                };
                let width = path.stroke_width().map(|w| w.value).unwrap_or(0.0);
                let rule = if matches!(fill_mode, Some(PdfPathFillMode::EvenOdd)) {
                    "evenodd"
                } else {
                    "nonzero"
                };
                path_data.push_str(&format!(
                    "<path d=\"{d}\" fill=\"{fill}\" fill-rule=\"{rule}\" stroke=\"{stroke}\" stroke-width=\"{width:.3}\"{clip_attr}/>\n"
                ));
                remove.push(idx);
            }
            _ => {}
        }
    }

    drop(text_page);

    if !glyph_crops.is_empty() {
        let glyph_dpi = dpi.max(300.0);
        let target_width = ((page_w * glyph_dpi / 72.0).round() as i32).max(1);
        let config = PdfRenderConfig::new()
            .set_target_width(target_width)
            .set_clear_color(PdfColor::new(255, 255, 255, 0));

        if let Ok(bitmap) = page.render_with_config(&config) {
            if let Ok(image) = bitmap.as_image() {
                let bitmap_w = image.width() as f32;
                let bitmap_h = image.height() as f32;

                for (left, bottom, right, top, z_index) in glyph_crops {
                    let x0 = ((left / page_w) * bitmap_w).floor().max(0.0) as u32;
                    let x1 = ((right / page_w) * bitmap_w).ceil().min(bitmap_w) as u32;
                    let y0 = (((page_h - top) / page_h) * bitmap_h).floor().max(0.0) as u32;
                    let y1 = (((page_h - bottom) / page_h) * bitmap_h)
                        .ceil()
                        .min(bitmap_h) as u32;
                    if x1 <= x0 || y1 <= y0 {
                        continue;
                    }

                    let crop = image.crop_imm(x0, y0, x1 - x0, y1 - y0);
                    if let Some(url) = data_url(&crop) {
                        let css_left = (x0 as f32 / bitmap_w) * page_w * CSS_SCALE;
                        let css_top = (y0 as f32 / bitmap_h) * page_h * CSS_SCALE;
                        let css_width = ((x1 - x0) as f32 / bitmap_w) * page_w * CSS_SCALE;
                        let css_height = ((y1 - y0) as f32 / bitmap_h) * page_h * CSS_SCALE;
                        glyph_html.push_str(&format!(
                            "<img class=\"gl\" src=\"{url}\" alt=\"\" style=\"left:{css_left:.3}px;top:{css_top:.3}px;width:{css_width:.3}px;height:{css_height:.3}px;z-index:{z_index}\">\n"
                        ));
                    }
                }
            }
        }
    }

    page.set_content_regeneration_strategy(PdfPageContentRegenerationStrategy::Manual);
    for idx in remove.into_iter().rev() {
        let object = page
            .objects_mut()
            .remove_object_at_index(idx)
            .map_err(|e| e.to_string())?;
        std::mem::forget(object);
    }
    page.regenerate_content().map_err(|e| e.to_string())?;

    let mut background_html = String::new();
    let remaining = page.objects().len();
    if remaining > 0 {
        let config = PdfRenderConfig::new().set_target_width((page_w * dpi / 72.0) as i32);
        let bitmap = page
            .render_with_config(&config)
            .map_err(|e| e.to_string())?;
        if let Some(url) = data_url(&bitmap.as_image().map_err(|e| e.to_string())?) {
            background_html = format!("<img class=\"bg\" src=\"{url}\" alt=\"\">\n");
        }
    }

    if text_count == 0 {
        warnings.push(format!(
            "第 {} 页没有可提取文字，已按原样保留。",
            page_index + 1
        ));
    }
    if remaining > 0 {
        warnings.push(format!("第 {} 页的复杂图形按原样保留。", page_index + 1));
    }

    let vector_html = if path_data.trim().is_empty() {
        String::new()
    } else {
        format!(
            "<svg class=\"vec\" viewBox=\"0 0 {page_w} {page_h}\" preserveAspectRatio=\"none\"><g transform=\"translate(0,{page_h}) scale(1,-1)\"><defs>\n{clip_defs}</defs>\n{path_data}</g></svg>\n"
        )
    };

    Ok(format!(
        "{background_html}{vector_html}{image_html}{glyph_html}{text_html}"
    ))
}

fn segments_to_svg<'a, I>(segments: I, matrix: Option<&PdfMatrix>) -> String
where
    I: Iterator<Item = PdfPathSegment<'a>>,
{
    let mut d = String::new();
    let mut bezier: Vec<(f32, f32)> = Vec::new();

    let apply = |x: f32, y: f32| -> (f32, f32) {
        match matrix {
            Some(matrix) => {
                let (x, y) = matrix.apply_to_points(PdfPoints::new(x), PdfPoints::new(y));
                (x.value, y.value)
            }
            None => (x, y),
        }
    };

    for segment in segments {
        let (x, y) = segment.point();
        let (x, y) = apply(x.value, y.value);
        let close = segment.is_close();

        match segment.segment_type() {
            PdfPathSegmentType::MoveTo => {
                if !bezier.is_empty() {
                    let (x, y) = *bezier.last().unwrap();
                    d.push_str(&format!("L{x:.3} {y:.3} "));
                    bezier.clear();
                }
                d.push_str(&format!("M{x:.3} {y:.3} "));
            }
            PdfPathSegmentType::LineTo => {
                if !bezier.is_empty() {
                    let (x, y) = *bezier.last().unwrap();
                    d.push_str(&format!("L{x:.3} {y:.3} "));
                    bezier.clear();
                }
                d.push_str(&format!("L{x:.3} {y:.3} "));
            }
            PdfPathSegmentType::BezierTo => {
                // Pdfium reports each of a cubic Bezier's three points as its
                // own BezierTo segment; a group of three forms one C command.
                bezier.push((x, y));
                if bezier.len() == 3 {
                    let (x1, y1) = bezier[0];
                    let (x2, y2) = bezier[1];
                    let (x3, y3) = bezier[2];
                    d.push_str(&format!(
                        "C{x1:.3} {y1:.3} {x2:.3} {y2:.3} {x3:.3} {y3:.3} "
                    ));
                    bezier.clear();
                } else {
                    continue;
                }
            }
            PdfPathSegmentType::Unknown => continue,
        }

        if close {
            d.push_str("Z ");
        }
    }

    if !bezier.is_empty() {
        let (x, y) = *bezier.last().unwrap();
        d.push_str(&format!("L{x:.3} {y:.3} "));
    }

    d
}

fn data_url(image: &DynamicImage) -> Option<String> {
    let mut buffer = Vec::new();
    image
        .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
        .ok()?;
    Some(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(buffer)
    ))
}

fn color_css(color: &PdfColor) -> String {
    if color.alpha() == 255 {
        format!("rgb({},{},{})", color.red(), color.green(), color.blue())
    } else {
        format!(
            "rgba({},{},{},{:.3})",
            color.red(),
            color.green(),
            color.blue(),
            color.alpha() as f32 / 255.0
        )
    }
}

fn embedded_font_family(
    font: &PdfFont<'_>,
    font_name: &str,
    font_maps: &FontMaps,
    font_cache: &mut HashMap<String, Option<String>>,
    embedded_fonts: &mut HashMap<u64, usize>,
    font_faces: &mut String,
) -> Option<String> {
    // Pdfium can return a substituted system font's data for a font that the
    // PDF did not embed; that data is not the font the document specifies.
    if !font.is_embedded().unwrap_or(false) {
        return None;
    }

    if !font_name.is_empty() {
        if let Some(cached) = font_cache.get(font_name) {
            return cached.clone();
        }
    }

    let result = (|| {
        let data = font.data().ok()?;
        if data.len() < 12 {
            return None;
        }

        let mapping = font_maps.get(font_name).or_else(|| {
            font_name
                .find('+')
                .and_then(|position| font_maps.get(&font_name[position + 1..]))
        });
        let prepared = prepare_font(&data, mapping);
        let bytes = prepared.as_deref().unwrap_or(&data);

        if !has_unicode_cmap(bytes) {
            return None;
        }

        let (mime, format) = font_sfnt_info(bytes)?;

        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        bytes.hash(&mut hasher);
        let key = hasher.finish();

        if let Some(id) = embedded_fonts.get(&key) {
            return Some(format!("'pdf-f{id}'"));
        }

        let id = embedded_fonts.len();
        embedded_fonts.insert(key, id);
        font_faces.push_str(&format!(
            "@font-face{{font-family:\"pdf-f{id}\";src:url(data:{mime};base64,{}) format(\"{format}\");font-display:block}}\n",
            base64::engine::general_purpose::STANDARD.encode(bytes)
        ));
        Some(format!("'pdf-f{id}'"))
    })();

    if !font_name.is_empty() {
        font_cache.insert(font_name.to_string(), result.clone());
    }

    result
}

/// Returns the MIME type and CSS format hint for an embedded font, if it is a
/// complete enough sfnt for a browser to use.
///
/// PDF font subsets usually contain only glyf/loca/head/hhea/maxp and no cmap
/// table. Browsers cannot map Unicode text to glyphs without a cmap, so such a
/// font would silently fail and the text would fall back to a system font. In
/// that case it is better not to embed it at all and let the per-character
/// layout keep the original positions.
fn font_sfnt_info(data: &[u8]) -> Option<(&'static str, &'static str)> {
    if data.len() < 12 {
        return None;
    }

    let is_true_type = data.starts_with(&[0, 1, 0, 0]) || data.starts_with(b"true");
    let is_open_type = data.starts_with(b"OTTO");
    if !is_true_type && !is_open_type {
        return None;
    }

    let table_count = u16::from_be_bytes([data[4], data[5]]) as usize;
    if table_count == 0 || 12 + table_count * 16 > data.len() {
        return None;
    }

    let has_cmap = (0..table_count).any(|index| {
        let offset = 12 + index * 16;
        data.get(offset..offset + 4) == Some(b"cmap")
    });
    if !has_cmap {
        return None;
    }

    if is_open_type {
        Some(("font/otf", "opentype"))
    } else {
        Some(("font/ttf", "truetype"))
    }
}

fn font_stack(names: &[&str]) -> String {
    let joined = names
        .iter()
        .filter(|name| !name.trim().is_empty())
        .copied()
        .collect::<Vec<_>>()
        .join(" ");
    let lower = joined.to_lowercase();

    if lower.contains("dengxian") || joined.contains("等线") {
        "'DengXian','等线','Microsoft YaHei',sans-serif".to_string()
    } else if lower.contains("yahei") || joined.contains("雅黑") {
        "'Microsoft YaHei','微软雅黑',sans-serif".to_string()
    } else if lower.contains("simhei") || lower.contains("hei") || joined.contains("黑体") {
        "'SimHei','黑体','Microsoft YaHei',sans-serif".to_string()
    } else if lower.contains("stkaiti") || joined.contains("华文楷体") {
        "'STKaiti','华文楷体','KaiTi','楷体',serif".to_string()
    } else if lower.contains("simkai") || lower.contains("kai") || joined.contains("楷") {
        "'KaiTi','楷体','SimKai',serif".to_string()
    } else if lower.contains("stfangsong") || joined.contains("华文仿宋") {
        "'STFangsong','华文仿宋','FangSong','仿宋',serif".to_string()
    } else if lower.contains("fangsong") || joined.contains("仿宋") {
        "'FangSong','仿宋',serif".to_string()
    } else if lower.contains("stsong") || joined.contains("华文宋体") {
        "'STSong','华文宋体','SimSun','宋体',serif".to_string()
    } else if lower.contains("simsun") || lower.contains("song") || joined.contains("宋") {
        "'SimSun','宋体',serif".to_string()
    } else if lower.contains("pingfang") || joined.contains("苹方") {
        "'PingFang SC','苹方-简','Microsoft YaHei',sans-serif".to_string()
    } else if lower.contains("source han") || lower.contains("noto") {
        "'Source Han Sans SC','Noto Sans CJK SC','Microsoft YaHei',sans-serif".to_string()
    } else if lower.contains("calibri") {
        "'Calibri','Segoe UI',sans-serif".to_string()
    } else if lower.contains("cambria") {
        "'Cambria','Times New Roman',serif".to_string()
    } else if lower.contains("verdana") {
        "Verdana,'Segoe UI',sans-serif".to_string()
    } else if lower.contains("tahoma") {
        "Tahoma,'Segoe UI',sans-serif".to_string()
    } else if lower.contains("courier") || lower.contains("consolas") {
        "'Courier New',Consolas,monospace".to_string()
    } else if lower.contains("arial") || lower.contains("helvetica") {
        "Arial,Helvetica,sans-serif".to_string()
    } else if lower.contains("times") || lower.contains("roman") {
        "'Times New Roman',Times,serif".to_string()
    } else if lower.contains("segoe") {
        "'Segoe UI','Microsoft YaHei',sans-serif".to_string()
    } else {
        "'SimSun','宋体','Microsoft YaHei',serif".to_string()
    }
}

fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn build_document(
    title: &str,
    font_faces: &str,
    pages_html: &str,
    sizes: &[(f32, f32)],
    preview: bool,
) -> String {
    let safe_title = escape(if title.trim().is_empty() {
        "PDF"
    } else {
        title
    });
    let file_name = serde_json::to_string(&format!(
        "{}_已编辑.html",
        if title.trim().is_empty() {
            "PDF"
        } else {
            title
        }
    ))
    .unwrap_or_else(|_| "\"PDF_已编辑.html\"".to_string());

    let print_pages = sizes
        .iter()
        .enumerate()
        .map(|(index, (w, h))| {
            format!(
                "@page pdf-size-{index} {{ size: {w:.2}mm {h:.2}mm; margin: 0; }}\n.page[data-size=\"{index}\"] {{ page: pdf-size-{index}; }}"
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let toolbar = if preview {
        String::new()
    } else {
        format!(
            r#"<header class="toolbar">
  <span class="toolbar-title" title="{safe_title}">{safe_title}</span>
  <button type="button" id="pdf-edit">编辑文字</button>
  <button type="button" id="pdf-print">打印</button>
  <button type="button" id="pdf-save" class="primary">保存副本</button>
</header>
<div class="hint" id="pdf-hint" hidden>编辑文字，点击图片替换；完成后保存副本。</div>
<input type="file" id="pdf-image-input" accept="image/*" hidden>"#
        )
    };

    let edit_script = if preview {
        String::new()
    } else {
        format!(
            r##"(function(){{
  var filename={file_name};
  var editing=false;
  var editButton=document.getElementById("pdf-edit");
  var hint=document.getElementById("pdf-hint");
  var spans=Array.prototype.slice.call(document.querySelectorAll(".t"));
  var imageInput=document.getElementById("pdf-image-input");
  var targetImage=null;
  function setEditing(next){{
    editing=next;
    document.body.classList.toggle("editing",editing);
    spans.forEach(function(span){{
      if(editing){{span.setAttribute("contenteditable","true");span.setAttribute("spellcheck","false");}}
      else{{span.removeAttribute("contenteditable");}}
    }});
    editButton.textContent=editing?"完成编辑":"编辑文字";
    hint.hidden=!editing;
  }}
  editButton.addEventListener("click",function(){{setEditing(!editing);}});
  document.addEventListener("click",function(event){{
    if(!editing)return;
    var image=event.target.closest?event.target.closest(".img"):null;
    if(!image)return;
    targetImage=image;imageInput.value="";imageInput.click();
  }});
  imageInput.addEventListener("change",function(){{
    var file=imageInput.files&&imageInput.files[0];
    if(!file||!targetImage)return;
    var reader=new FileReader();
    reader.onload=function(){{targetImage.src=String(reader.result);targetImage=null;}};
    reader.readAsDataURL(file);
  }});
  document.getElementById("pdf-print").addEventListener("click",function(){{window.print();}});
  document.getElementById("pdf-save").addEventListener("click",function(){{
    var clone=document.documentElement.cloneNode(true);
    clone.querySelectorAll("[contenteditable]").forEach(function(node){{node.removeAttribute("contenteditable");node.removeAttribute("spellcheck");}});
    var body=clone.querySelector("body");if(body)body.classList.remove("editing");
    var button=clone.querySelector("#pdf-edit");if(button)button.textContent="编辑文字";
    var hintNode=clone.querySelector("#pdf-hint");if(hintNode)hintNode.hidden=true;
    var html="<!doctype html>\n"+clone.outerHTML;
    var blob=new Blob([html],{{type:"text/html;charset=utf-8"}});
    var url=URL.createObjectURL(blob);
    var anchor=document.createElement("a");
    anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();
    window.setTimeout(function(){{URL.revokeObjectURL(url);}},1500);
  }});
}})();"##
        )
    };

    let preview_script = if preview {
        r#"(function(){
  function fit(){
    var pages=Array.prototype.slice.call(document.querySelectorAll(".page"));
    if(!pages.length)return;
    var max=Math.max.apply(null,pages.map(function(page){return page.offsetWidth;}));
    var scale=Math.min(1,(window.innerWidth-32)/max);
    document.documentElement.style.setProperty("--preview-scale",String(scale));
  }
  window.addEventListener("resize",fit);
  document.fonts.ready.then(fit);
  fit();
})();"#
            .to_string()
    } else {
        String::new()
    };

    let body_class = if preview { " class=\"preview\"" } else { "" };

    let template = r#"<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="叮当 · PDF 转 HTML">
<title>__TITLE__</title>
<style>
__FONTS__
*{box-sizing:border-box}
html{background:#e7e7e3}
body{margin:0;padding:24px 0 56px;background:#e7e7e3;color:#1c1d20;font-family:"Segoe UI Variable Text","Segoe UI","Microsoft YaHei UI","Microsoft YaHei",system-ui,sans-serif}
body.preview{padding:16px 0;zoom:var(--preview-scale,1)}
.toolbar{position:fixed;z-index:50;top:14px;right:18px;display:flex;align-items:center;gap:4px;max-width:min(640px,calc(100vw - 36px));padding:5px 6px 5px 12px;background:rgba(255,255,255,.97);border:1px solid #deded8;border-radius:10px;box-shadow:0 6px 22px rgba(20,22,26,.12);backdrop-filter:blur(8px)}
.toolbar-title{max-width:240px;overflow:hidden;color:#5f646b;font-size:11px;white-space:nowrap;text-overflow:ellipsis}
.toolbar button{height:30px;padding:0 11px;color:#1c1d20;font:500 12px/1 inherit;background:transparent;border:0;border-radius:7px;cursor:pointer}
.toolbar button:hover{background:#efefeb}
.toolbar button:focus-visible{outline:2px solid #2563eb;outline-offset:1px}
.toolbar button.primary{color:#fff;background:#2563eb}
.toolbar button.primary:hover{background:#1d4ed8}
.hint{position:fixed;z-index:50;bottom:18px;left:50%;padding:8px 14px;color:#fff;font-size:12px;line-height:1.4;white-space:nowrap;background:rgba(28,29,32,.92);border-radius:999px;transform:translateX(-50%)}
.page{position:relative;flex:none;margin:0 auto 18px;background:#fff;box-shadow:0 2px 10px rgba(20,22,26,.18);overflow:hidden}
.bg{position:absolute;inset:0;display:block;width:100%;height:100%;pointer-events:none;z-index:0}
.vec{position:absolute;inset:0;display:block;width:100%;height:100%;z-index:1}
.img{position:absolute;left:0;top:0;display:block;object-fit:fill;transform-origin:0 0;pointer-events:none;z-index:5}
.gl{position:absolute;display:block;object-fit:fill;pointer-events:none}
.t{position:absolute;display:block;white-space:pre;line-height:1;transform-origin:0 0;user-select:text;pointer-events:auto;letter-spacing:0;word-spacing:0;font-kerning:none;font-variant-ligatures:none;font-feature-settings:"kern" 0,"liga" 0,"clig" 0;text-rendering:geometricPrecision}
.t .c{display:inline-block;vertical-align:baseline;line-height:1;white-space:pre;overflow:visible}
.t.inv{color:transparent!important}
.editing .t{outline:1px dashed transparent}
.editing .t:hover{background:rgba(37,99,235,.07);outline-color:rgba(37,99,235,.45)}
.editing .t:focus{background:rgba(37,99,235,.09);outline:2px solid #2563eb;outline-offset:2px}
.editing .t.inv{color:rgba(28,29,32,.4)!important}
.editing .img{pointer-events:auto;cursor:pointer;outline:1px dashed rgba(37,99,235,.45);outline-offset:2px}
.editing .img:hover{outline:2px solid #2563eb}
@media print{
  body{padding:0!important;background:#fff!important;zoom:1!important}
  .toolbar,.hint{display:none!important}
  .page{margin:0;box-shadow:none;break-after:page;page-break-after:always}
  .page:last-child{break-after:auto;page-break-after:auto}
  .page,.page *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
__PRINT_PAGES__
}
</style>
</head>
<body__BODY_CLASS__>
__TOOLBAR__
<main class="doc">
__PAGES__
</main>
<script>
(function(){
  function apply(){
    var canvas=document.createElement("canvas");
    var context=canvas.getContext("2d");
    var cache={};
    function metrics(family,size){
      var key=family+"|"+size;
      if(cache[key])return cache[key];
      var ascent=size*0.86;
      var descent=size*0.14;
      if(context){
        context.font=size+"px "+family;
        var measured=context.measureText("汉Hg");
        if(typeof measured.fontBoundingBoxAscent==="number"&&measured.fontBoundingBoxAscent>0)ascent=measured.fontBoundingBoxAscent;
        if(typeof measured.fontBoundingBoxDescent==="number"&&measured.fontBoundingBoxDescent>0)descent=measured.fontBoundingBoxDescent;
      }
      return cache[key]={ascent:ascent,descent:descent};
    }
    Array.prototype.forEach.call(document.querySelectorAll(".t"),function(run){
      var style=window.getComputedStyle(run);
      var size=parseFloat(style.fontSize);
      var family=style.fontFamily;
      var baseline=parseFloat(run.getAttribute("data-baseline")||"");
      if(size>0&&isFinite(baseline)){
        var font=metrics(family,size);
        var offset=(size-(font.ascent+font.descent))/2+font.ascent;
        run.style.top=(baseline-offset).toFixed(3)+"px";
        if(run.style.transform)run.style.transformOrigin="0 "+offset.toFixed(3)+"px";
      }
      if(!context)return;
      Array.prototype.forEach.call(run.querySelectorAll(".c"),function(ch){
        var advance=parseFloat(ch.getAttribute("data-a")||"");
        if(!isFinite(advance))return;
        context.font=size+"px "+family;
        var natural=context.measureText(ch.textContent).width;
        if(!isFinite(natural))return;
        ch.style.width="auto";
        ch.style.marginRight=(advance-natural).toFixed(3)+"px";
      });
    });
  }
  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(apply);}else{apply();}
})();
__EDIT_SCRIPT__
__PREVIEW_SCRIPT__
</script>
</body>
</html>"#;

    let mut html = template
        .replace("__TITLE__", &safe_title)
        .replace("__FONTS__", font_faces)
        .replace("__PRINT_PAGES__", &print_pages)
        .replace("__BODY_CLASS__", body_class)
        .replace("__TOOLBAR__", &toolbar)
        .replace("__PAGES__", pages_html)
        .replace("__EDIT_SCRIPT__", &edit_script)
        .replace("__PREVIEW_SCRIPT__", &preview_script);

    if font_faces.is_empty() {
        html = html.replace("__FONTS__", "");
    }
    html
}
