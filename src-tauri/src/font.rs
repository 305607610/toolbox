//! Turns PDF font subsets into fonts a browser can actually use.
//!
//! Many PDFs embed CID or simple TrueType subsets that contain no usable
//! Unicode `cmap` table, or that omit the `OS/2` and `post` tables browsers
//! expect. Pdfium can still render those fonts, but a browser silently rejects
//! them. This module reads the PDF's ToUnicode/CIDToGIDMap data and the embedded
//! font's own code-to-glyph table, rebuilds an sfnt with a real Unicode cmap,
//! and supplies the missing metadata tables.

use lopdf::{Document, Object};
use std::collections::HashMap;

pub type FontCmap = HashMap<u32, u16>;

/// How a font in the PDF maps its text to glyphs.
#[derive(Debug, Clone)]
pub enum FontMapping {
    /// CID font: Unicode code point to glyph ID.
    UnicodeToGid(FontCmap),
    /// Simple font: PDF character code to Unicode. The embedded font's own
    /// cmap supplies the code-to-glyph half of the mapping.
    SimpleCodes(HashMap<u32, u32>),
}

pub type FontMaps = HashMap<String, FontMapping>;

/// Extracts glyph mappings for the fonts in the PDF.
///
/// Keys are the PDF BaseFont name, with and without the subset prefix.
pub fn collect_font_maps(pdf: &[u8]) -> FontMaps {
    let Ok(document) = Document::load_mem(pdf) else {
        return HashMap::new();
    };

    let mut result: FontMaps = HashMap::new();

    for object in document.objects.values() {
        let Ok(dictionary) = object.as_dict() else {
            continue;
        };

        if dictionary
            .get(b"Type")
            .ok()
            .and_then(|object| object.as_name().ok())
            != Some(&b"Font"[..])
        {
            continue;
        }

        let Ok(base_font) = dictionary
            .get(b"BaseFont")
            .and_then(|object| object.as_name())
        else {
            continue;
        };
        let base_name = String::from_utf8_lossy(base_font).to_string();

        let Ok(to_unicode_object) = dictionary.get_deref(b"ToUnicode", &document) else {
            continue;
        };
        let Ok(to_unicode_stream) = to_unicode_object.as_stream() else {
            continue;
        };
        let Ok(to_unicode) = to_unicode_stream.decompressed_content() else {
            continue;
        };
        let unicode_by_code = parse_to_unicode(&to_unicode);
        if unicode_by_code.is_empty() {
            continue;
        }

        let subtype = dictionary
            .get(b"Subtype")
            .ok()
            .and_then(|object| object.as_name().ok());

        let mapping = if subtype == Some(&b"Type0"[..]) {
            let identity_encoding = dictionary
                .get(b"Encoding")
                .ok()
                .and_then(|object| object.as_name().ok())
                .map(|name| name == b"Identity-H" || name == b"Identity-V")
                .unwrap_or(false);
            if !identity_encoding {
                continue;
            }

            let Ok(descendants_object) = dictionary.get_deref(b"DescendantFonts", &document) else {
                continue;
            };
            let Ok(descendants) = descendants_object.as_array() else {
                continue;
            };
            let Some(descendant_reference) = descendants.first() else {
                continue;
            };
            let Ok((_, descendant_object)) = document.dereference(descendant_reference) else {
                continue;
            };
            let Ok(descendant) = descendant_object.as_dict() else {
                continue;
            };

            if descendant
                .get(b"Subtype")
                .ok()
                .and_then(|object| object.as_name().ok())
                != Some(&b"CIDFontType2"[..])
            {
                continue;
            }

            let cid_to_gid = match descendant.get(b"CIDToGIDMap") {
                Ok(Object::Name(name)) if name == b"Identity" => Some(CidToGidMap::Identity),
                Ok(Object::Reference(_)) | Ok(Object::Stream(_)) => descendant
                    .get_deref(b"CIDToGIDMap", &document)
                    .ok()
                    .and_then(|object| object.as_stream().ok())
                    .and_then(|stream| stream.decompressed_content().ok())
                    .map(CidToGidMap::Bytes),
                Err(_) => Some(CidToGidMap::Identity),
                _ => None,
            };
            let Some(cid_to_gid) = cid_to_gid else {
                continue;
            };

            let mut cmap = FontCmap::new();
            for (code, unicode) in &unicode_by_code {
                if let Some(gid) = cid_to_gid.gid(*code) {
                    if gid != 0 {
                        cmap.insert(*unicode, gid);
                    }
                }
            }
            if cmap.is_empty() {
                continue;
            }
            FontMapping::UnicodeToGid(cmap)
        } else if subtype == Some(&b"TrueType"[..]) || subtype == Some(&b"Type1"[..]) {
            FontMapping::SimpleCodes(unicode_by_code.into_iter().collect())
        } else {
            continue;
        };

        result.insert(base_name.clone(), mapping.clone());
        if let Some(position) = base_name.find('+') {
            result
                .entry(base_name[position + 1..].to_string())
                .or_insert(mapping);
        }
    }

    result
}

/// Returns a browser-usable version of the given embedded font.
///
/// Returns `None` when the font does not need changes, or cannot be repaired.
pub fn prepare_font(data: &[u8], mapping: Option<&FontMapping>) -> Option<Vec<u8>> {
    let (version, mut tables) = parse_tables(data)?;

    let mut changed = false;

    let new_cmap = match mapping {
        Some(FontMapping::UnicodeToGid(cmap)) => Some(cmap.clone()),
        Some(FontMapping::SimpleCodes(unicode_by_code)) => {
            let parsed = parse_font_cmap(&tables);
            let mut cmap = parsed
                .as_ref()
                .map(|parsed| parsed.unicode.clone())
                .unwrap_or_default();

            if let Some(parsed) = parsed {
                for (code, unicode) in unicode_by_code {
                    if let Some(gid) = parsed.codes.get(code) {
                        if *gid != 0 {
                            cmap.insert(*unicode, *gid);
                        }
                    }
                }
            }

            if cmap.is_empty() { None } else { Some(cmap) }
        }
        None => None,
    };

    if let Some(cmap) = new_cmap {
        if let Some(glyph_count) = maxp_glyph_count(&tables) {
            if let Some(cmap_table) = build_cmap12(&cmap, glyph_count) {
                tables.retain(|table| &table.tag != b"cmap");
                tables.push(Table {
                    tag: *b"cmap",
                    data: cmap_table,
                });
                changed = true;
            }
        }
    }

    if !has_table(&tables, b"cmap") {
        return None;
    }

    if !has_table(&tables, b"name") {
        tables.push(Table {
            tag: *b"name",
            data: build_name(),
        });
        changed = true;
    }

    if !has_table(&tables, b"OS/2") {
        tables.push(Table {
            tag: *b"OS/2",
            data: build_os2(&tables, mapping_cmap(mapping)),
        });
        changed = true;
    }

    if !has_table(&tables, b"post") {
        tables.push(Table {
            tag: *b"post",
            data: build_post(),
        });
        changed = true;
    }

    if !changed {
        return None;
    }

    rebuild_sfnt(&version, tables)
}

fn mapping_cmap(mapping: Option<&FontMapping>) -> Option<&FontCmap> {
    match mapping {
        Some(FontMapping::UnicodeToGid(cmap)) => Some(cmap),
        _ => None,
    }
}

/// Returns `true` if the font has a cmap subtable a browser can use for Unicode.
pub fn has_unicode_cmap(data: &[u8]) -> bool {
    let Some((_, tables)) = parse_tables(data) else {
        return false;
    };
    let Some(cmap) = tables.iter().find(|table| &table.tag == b"cmap") else {
        return false;
    };
    let Some(count) = u16_at(&cmap.data, 2) else {
        return false;
    };

    for index in 0..count as usize {
        let record = 4 + index * 8;
        let (Some(platform), Some(encoding)) =
            (u16_at(&cmap.data, record), u16_at(&cmap.data, record + 2))
        else {
            break;
        };
        if platform == 0 || (platform == 3 && matches!(encoding, 1 | 10)) {
            return true;
        }
    }

    false
}

#[derive(Debug)]
struct Table {
    tag: [u8; 4],
    data: Vec<u8>,
}

#[derive(Debug)]
struct ParsedCmap {
    /// Every code in the font's cmap tables, regardless of platform.
    codes: HashMap<u32, u16>,
    /// Only the Unicode-addressed entries.
    unicode: FontCmap,
}

fn parse_font_cmap(tables: &[Table]) -> Option<ParsedCmap> {
    let cmap = tables.iter().find(|table| &table.tag == b"cmap")?;
    let data = &cmap.data;
    let count = u16_at(data, 2)? as usize;
    let mut codes = HashMap::new();
    let mut unicode = FontCmap::new();
    let mut parsed_offsets: Vec<usize> = Vec::new();

    for index in 0..count {
        let record = 4 + index * 8;
        let (Some(platform), Some(encoding), Some(offset)) = (
            u16_at(data, record),
            u16_at(data, record + 2),
            u32_at(data, record + 4),
        ) else {
            break;
        };
        let offset = offset as usize;
        if parsed_offsets.contains(&offset) {
            continue;
        }
        parsed_offsets.push(offset);

        let Some(entries) = parse_cmap_subtable(data, offset) else {
            continue;
        };
        let is_unicode = platform == 0 || (platform == 3 && matches!(encoding, 1 | 10));

        for (code, gid) in entries {
            if gid == 0 {
                continue;
            }
            codes.entry(code).or_insert(gid);
            if is_unicode {
                unicode.insert(code, gid);
            }
        }
    }

    if codes.is_empty() {
        None
    } else {
        Some(ParsedCmap { codes, unicode })
    }
}

fn parse_cmap_subtable(data: &[u8], offset: usize) -> Option<Vec<(u32, u16)>> {
    let format = u16_at(data, offset)?;
    match format {
        0 => {
            let mut entries = Vec::new();
            for code in 0..256usize {
                if let Some(gid) = data.get(offset + 6 + code).copied() {
                    entries.push((code as u32, gid as u16));
                }
            }
            Some(entries)
        }
        4 => parse_cmap_format4(data, offset),
        6 => {
            let first = u16_at(data, offset + 6)? as u32;
            let count = u16_at(data, offset + 8)? as usize;
            let mut entries = Vec::with_capacity(count);
            for index in 0..count {
                let gid = u16_at(data, offset + 10 + index * 2)?;
                entries.push((first + index as u32, gid));
            }
            Some(entries)
        }
        12 => {
            let groups = u32_at(data, offset + 12)? as usize;
            let mut entries = Vec::new();
            for index in 0..groups {
                let base = offset + 16 + index * 12;
                let (Some(start), Some(end), Some(start_gid)) = (
                    u32_at(data, base),
                    u32_at(data, base + 4),
                    u32_at(data, base + 8),
                ) else {
                    break;
                };
                if end < start || end > 0x10FFFF {
                    continue;
                }
                let count = (end - start).min(0x10000);
                for offset_code in 0..=count {
                    entries.push((start + offset_code, (start_gid + offset_code) as u16));
                }
            }
            Some(entries)
        }
        _ => None,
    }
}

fn parse_cmap_format4(data: &[u8], offset: usize) -> Option<Vec<(u32, u16)>> {
    let segment_count_x2 = u16_at(data, offset + 6)? as usize;
    if segment_count_x2 == 0 || segment_count_x2 % 2 != 0 {
        return None;
    }
    let segment_count = segment_count_x2 / 2;
    let end_codes = offset + 14;
    let start_codes = end_codes + segment_count * 2 + 2;
    let deltas = start_codes + segment_count * 2;
    let range_offsets = deltas + segment_count * 2;

    let mut entries = Vec::new();
    for segment in 0..segment_count {
        let end = u16_at(data, end_codes + segment * 2)? as u32;
        let start = u16_at(data, start_codes + segment * 2)? as u32;
        if start > end || end == 0xFFFF {
            continue;
        }
        let delta = u16_at(data, deltas + segment * 2)?;
        let range_offset = u16_at(data, range_offsets + segment * 2)? as usize;

        let count = (end - start).min(0xFFFF);
        for code in start..=start + count {
            let gid = if range_offset == 0 {
                (code as u16).wrapping_add(delta)
            } else {
                let address =
                    range_offsets + segment * 2 + range_offset + (code - start) as usize * 2;
                let Some(raw) = u16_at(data, address) else {
                    continue;
                };
                if raw == 0 { 0 } else { raw.wrapping_add(delta) }
            };
            if gid != 0 {
                entries.push((code, gid));
            }
        }
    }

    Some(entries)
}

fn has_table(tables: &[Table], tag: &[u8; 4]) -> bool {
    tables.iter().any(|table| &table.tag == tag)
}

fn parse_tables(data: &[u8]) -> Option<(Vec<u8>, Vec<Table>)> {
    if data.len() < 12 {
        return None;
    }

    let version = data[0..4].to_vec();
    if &version == b"ttcf" || &version == b"wOFF" || &version == b"wOF2" {
        return None;
    }

    let count = u16::from_be_bytes([data[4], data[5]]) as usize;
    if count == 0 || 12 + count * 16 > data.len() {
        return None;
    }

    let mut tables: Vec<Table> = Vec::with_capacity(count);
    for index in 0..count {
        let record = 12 + index * 16;
        let tag: [u8; 4] = data[record..record + 4].try_into().ok()?;
        let offset = u32::from_be_bytes(data[record + 8..record + 12].try_into().ok()?) as usize;
        let length = u32::from_be_bytes(data[record + 12..record + 16].try_into().ok()?) as usize;
        let end = offset.checked_add(length)?;
        if offset < 12 || end > data.len() {
            return None;
        }
        if tables.iter().any(|table| table.tag == tag) {
            continue;
        }
        tables.push(Table {
            tag,
            data: data[offset..end].to_vec(),
        });
    }

    Some((version, tables))
}

fn rebuild_sfnt(version: &[u8], mut tables: Vec<Table>) -> Option<Vec<u8>> {
    tables.retain(|table| &table.tag != b"DSIG");
    tables.sort_by(|a, b| a.tag.cmp(&b.tag));

    let head_index = tables.iter().position(|table| &table.tag == b"head")?;
    if tables[head_index].data.len() < 54 {
        return None;
    }

    // The head table's own checksum is defined with checkSumAdjustment zero,
    // and the regular/bold metadata is kept consistent with the OS/2 table.
    tables[head_index].data[8..12].fill(0);
    let mac_style =
        u16::from_be_bytes([tables[head_index].data[44], tables[head_index].data[45]]) & !1;
    tables[head_index].data[44..46].copy_from_slice(&mac_style.to_be_bytes());

    let count = tables.len() as u16;
    let mut search_range = 1u16;
    let mut entry_selector = 0u16;
    while search_range
        .checked_mul(2)
        .map(|value| value <= count)
        .unwrap_or(false)
    {
        search_range *= 2;
        entry_selector += 1;
    }
    let search_range = search_range * 16;
    let range_shift = count * 16 - search_range;

    let mut header = Vec::with_capacity(12 + count as usize * 16);
    header.extend_from_slice(version);
    header.extend_from_slice(&count.to_be_bytes());
    header.extend_from_slice(&search_range.to_be_bytes());
    header.extend_from_slice(&entry_selector.to_be_bytes());
    header.extend_from_slice(&range_shift.to_be_bytes());

    let mut records = Vec::with_capacity(count as usize * 16);
    let mut body = Vec::new();
    let mut head_offset = 0usize;
    let mut data_offset = 12 + count as usize * 16;

    for table in &tables {
        let checksum = table_checksum(&table.data);
        records.extend_from_slice(&table.tag);
        records.extend_from_slice(&checksum.to_be_bytes());
        records.extend_from_slice(&(data_offset as u32).to_be_bytes());
        records.extend_from_slice(&(table.data.len() as u32).to_be_bytes());

        if &table.tag == b"head" {
            head_offset = data_offset;
        }

        body.extend_from_slice(&table.data);
        let padding = (4 - table.data.len() % 4) % 4;
        body.extend(std::iter::repeat_n(0u8, padding));
        data_offset += table.data.len() + padding;
    }

    let mut font = header;
    font.extend(records);
    font.extend(body);

    let checksum = table_checksum(&font);
    let adjustment = 0xB1B0_AFBAu32.wrapping_sub(checksum);
    font[head_offset + 8..head_offset + 12].copy_from_slice(&adjustment.to_be_bytes());

    Some(font)
}

fn table_checksum(data: &[u8]) -> u32 {
    let mut sum = 0u32;
    for chunk in data.chunks(4) {
        let mut bytes = [0u8; 4];
        bytes[..chunk.len()].copy_from_slice(chunk);
        sum = sum.wrapping_add(u32::from_be_bytes(bytes));
    }
    sum
}

fn maxp_glyph_count(tables: &[Table]) -> Option<u16> {
    let maxp = tables.iter().find(|table| &table.tag == b"maxp")?;
    if maxp.data.len() < 6 {
        return None;
    }
    Some(u16::from_be_bytes([maxp.data[4], maxp.data[5]]))
}

fn build_cmap12(cmap: &FontCmap, glyph_count: u16) -> Option<Vec<u8>> {
    let mut entries: Vec<(u32, u16)> = cmap
        .iter()
        .filter(|(unicode, gid)| **unicode <= 0x10FFFF && **gid > 0 && **gid < glyph_count)
        .map(|(unicode, gid)| (*unicode, *gid))
        .collect();
    entries.sort_by_key(|entry| entry.0);
    entries.dedup_by_key(|entry| entry.0);
    if entries.is_empty() {
        return None;
    }

    let mut groups: Vec<(u32, u32, u16)> = Vec::new();
    let (mut start, mut end, mut start_gid) = (entries[0].0, entries[0].0, entries[0].1);
    for (unicode, gid) in entries.into_iter().skip(1) {
        let expected_gid = start_gid as u32 + (end - start) + 1;
        if unicode == end + 1 && gid as u32 == expected_gid && expected_gid <= u16::MAX as u32 {
            end = unicode;
        } else {
            groups.push((start, end, start_gid));
            start = unicode;
            end = unicode;
            start_gid = gid;
        }
    }
    groups.push((start, end, start_gid));

    let subtable_length = 16u32.checked_add((groups.len() as u32).checked_mul(12)?)?;
    let mut subtable = Vec::with_capacity(subtable_length as usize);
    subtable.extend_from_slice(&12u16.to_be_bytes());
    subtable.extend_from_slice(&0u16.to_be_bytes());
    subtable.extend_from_slice(&subtable_length.to_be_bytes());
    subtable.extend_from_slice(&0u32.to_be_bytes());
    subtable.extend_from_slice(&(groups.len() as u32).to_be_bytes());
    for (group_start, group_end, group_gid) in groups {
        subtable.extend_from_slice(&group_start.to_be_bytes());
        subtable.extend_from_slice(&group_end.to_be_bytes());
        subtable.extend_from_slice(&(group_gid as u32).to_be_bytes());
    }

    let mut table = Vec::with_capacity(12 + subtable.len());
    table.extend_from_slice(&0u16.to_be_bytes());
    table.extend_from_slice(&1u16.to_be_bytes());
    table.extend_from_slice(&3u16.to_be_bytes());
    table.extend_from_slice(&10u16.to_be_bytes());
    table.extend_from_slice(&12u32.to_be_bytes());
    table.extend_from_slice(&subtable);

    Some(table)
}

fn build_os2(tables: &[Table], cmap: Option<&FontCmap>) -> Vec<u8> {
    let (ascent, descent, line_gap) = tables
        .iter()
        .find(|table| &table.tag == b"hhea")
        .and_then(|table| {
            if table.data.len() < 10 {
                return None;
            }
            Some((
                i16::from_be_bytes([table.data[4], table.data[5]]),
                i16::from_be_bytes([table.data[6], table.data[7]]),
                i16::from_be_bytes([table.data[8], table.data[9]]),
            ))
        })
        .unwrap_or((800, -200, 0));

    let (first_char, last_char) = cmap
        .map(|cmap| {
            let mut codes = cmap
                .keys()
                .copied()
                .filter(|code| *code <= 0xFFFF)
                .collect::<Vec<_>>();
            codes.sort_unstable();
            (
                codes.first().copied().unwrap_or(0x20) as u16,
                codes.last().copied().unwrap_or(0xFFFD) as u16,
            )
        })
        .unwrap_or((0x20, 0xFFFD));

    let win_ascent = ascent.max(0) as u16;
    let win_descent = (-descent).max(0) as u16;

    let mut table = vec![0u8; 96];
    write_u16(&mut table, 0, 4);
    write_i16(&mut table, 2, 500);
    write_u16(&mut table, 4, 400);
    write_u16(&mut table, 6, 5);
    write_u16(&mut table, 8, 0);
    write_i16(&mut table, 10, 650);
    write_i16(&mut table, 12, 600);
    write_i16(&mut table, 14, 0);
    write_i16(&mut table, 16, 75);
    write_i16(&mut table, 18, 650);
    write_i16(&mut table, 20, 600);
    write_i16(&mut table, 22, 0);
    write_i16(&mut table, 24, 350);
    write_i16(&mut table, 26, 50);
    write_i16(&mut table, 28, 250);
    write_i16(&mut table, 30, 0);
    write_u32(&mut table, 42, 1);
    write_u32(&mut table, 46, 1 << 27);
    table[58..62].copy_from_slice(b"NONE");
    write_u16(&mut table, 62, 0x0040);
    write_u16(&mut table, 64, first_char);
    write_u16(&mut table, 66, last_char);
    write_i16(&mut table, 68, ascent);
    write_i16(&mut table, 70, descent);
    write_i16(&mut table, 72, line_gap);
    write_u16(&mut table, 74, win_ascent);
    write_u16(&mut table, 76, win_descent);
    write_u32(&mut table, 78, 0x0004_0001);
    write_u32(&mut table, 82, 0);
    write_i16(&mut table, 86, 0);
    write_i16(&mut table, 88, 0);
    write_u16(&mut table, 90, 0);
    write_u16(&mut table, 92, 32);
    write_u16(&mut table, 94, 1);
    table
}

fn build_name() -> Vec<u8> {
    let names: [(u16, &str); 4] = [
        (1, "PDFFont"),
        (2, "Regular"),
        (4, "PDFFont"),
        (6, "PDFFont-Regular"),
    ];

    let string_offset = 6 + names.len() * 12;
    let mut records = Vec::with_capacity(names.len() * 12);
    let mut strings = Vec::new();

    for (name_id, text) in names {
        let encoded: Vec<u8> = text
            .encode_utf16()
            .flat_map(|unit| unit.to_be_bytes())
            .collect();
        records.extend_from_slice(&3u16.to_be_bytes());
        records.extend_from_slice(&1u16.to_be_bytes());
        records.extend_from_slice(&0x0409u16.to_be_bytes());
        records.extend_from_slice(&name_id.to_be_bytes());
        records.extend_from_slice(&(encoded.len() as u16).to_be_bytes());
        records.extend_from_slice(&((string_offset + strings.len()) as u16).to_be_bytes());
        strings.extend_from_slice(&encoded);
    }

    let mut table = Vec::with_capacity(string_offset + strings.len());
    table.extend_from_slice(&0u16.to_be_bytes());
    table.extend_from_slice(&(names.len() as u16).to_be_bytes());
    table.extend_from_slice(&(string_offset as u16).to_be_bytes());
    table.extend(records);
    table.extend(strings);
    table
}

fn build_post() -> Vec<u8> {
    let mut table = vec![0u8; 32];
    write_u32(&mut table, 0, 0x0003_0000);
    write_i16(&mut table, 8, -100);
    write_i16(&mut table, 10, 50);
    table
}

fn write_u16(data: &mut [u8], offset: usize, value: u16) {
    data[offset..offset + 2].copy_from_slice(&value.to_be_bytes());
}

fn write_i16(data: &mut [u8], offset: usize, value: i16) {
    data[offset..offset + 2].copy_from_slice(&value.to_be_bytes());
}

fn write_u32(data: &mut [u8], offset: usize, value: u32) {
    data[offset..offset + 4].copy_from_slice(&value.to_be_bytes());
}

fn u16_at(data: &[u8], offset: usize) -> Option<u16> {
    Some(u16::from_be_bytes(
        data.get(offset..offset + 2)?.try_into().ok()?,
    ))
}

fn u32_at(data: &[u8], offset: usize) -> Option<u32> {
    Some(u32::from_be_bytes(
        data.get(offset..offset + 4)?.try_into().ok()?,
    ))
}

#[derive(Debug)]
enum CidToGidMap {
    Identity,
    Bytes(Vec<u8>),
}

impl CidToGidMap {
    fn gid(&self, cid: u32) -> Option<u16> {
        match self {
            CidToGidMap::Identity => u16::try_from(cid).ok(),
            CidToGidMap::Bytes(bytes) => {
                let offset = (cid as usize).checked_mul(2)?;
                let slice = bytes.get(offset..offset + 2)?;
                Some(u16::from_be_bytes([slice[0], slice[1]]))
            }
        }
    }
}

#[derive(Debug)]
enum CMapToken {
    Hex(Vec<u8>),
    ArrayStart,
    ArrayEnd,
    Word(Vec<u8>),
}

fn tokenize_cmap(content: &[u8]) -> Vec<CMapToken> {
    let mut tokens = Vec::new();
    let mut index = 0;

    while index < content.len() {
        match content[index] {
            b'%' => {
                while index < content.len() && content[index] != b'\n' {
                    index += 1;
                }
            }
            b'<' => {
                let start = index + 1;
                let mut end = start;
                while end < content.len() && content[end] != b'>' {
                    end += 1;
                }
                if end >= content.len() {
                    break;
                }

                let mut bytes = Vec::new();
                let mut high_nibble = None;
                for &byte in &content[start..end] {
                    let nibble = match byte {
                        b'0'..=b'9' => byte - b'0',
                        b'a'..=b'f' => byte - b'a' + 10,
                        b'A'..=b'F' => byte - b'A' + 10,
                        _ => continue,
                    };
                    match high_nibble.take() {
                        Some(high) => bytes.push((high << 4) | nibble),
                        None => high_nibble = Some(nibble),
                    }
                }
                if let Some(high) = high_nibble {
                    bytes.push(high << 4);
                }
                tokens.push(CMapToken::Hex(bytes));
                index = end + 1;
            }
            b'[' => {
                tokens.push(CMapToken::ArrayStart);
                index += 1;
            }
            b']' => {
                tokens.push(CMapToken::ArrayEnd);
                index += 1;
            }
            byte if byte.is_ascii_whitespace() => {
                index += 1;
            }
            _ => {
                let start = index;
                while index < content.len()
                    && !content[index].is_ascii_whitespace()
                    && !matches!(content[index], b'<' | b'>' | b'[' | b']' | b'%')
                {
                    index += 1;
                }
                if index == start {
                    index += 1;
                } else {
                    tokens.push(CMapToken::Word(content[start..index].to_vec()));
                }
            }
        }
    }

    tokens
}

fn parse_to_unicode(content: &[u8]) -> Vec<(u32, u32)> {
    let tokens = tokenize_cmap(content);
    let mut result = Vec::new();
    let mut index = 0;

    while index < tokens.len() {
        let word = match &tokens[index] {
            CMapToken::Word(word) => word.as_slice(),
            _ => {
                index += 1;
                continue;
            }
        };

        if word == b"beginbfchar" {
            index += 1;
            while index < tokens.len() {
                if matches!(&tokens[index], CMapToken::Word(word) if word == b"endbfchar") {
                    index += 1;
                    break;
                }

                if let (Some(CMapToken::Hex(source)), Some(CMapToken::Hex(target))) =
                    (tokens.get(index), tokens.get(index + 1))
                {
                    if let (Some(code), Some(unicode)) = (code_value(source), unicode_value(target))
                    {
                        result.push((code, unicode));
                    }
                    index += 2;
                } else {
                    index += 1;
                }
            }
        } else if word == b"beginbfrange" {
            index += 1;
            while index < tokens.len() {
                if matches!(&tokens[index], CMapToken::Word(word) if word == b"endbfrange") {
                    index += 1;
                    break;
                }

                let (Some(CMapToken::Hex(start)), Some(CMapToken::Hex(end))) =
                    (tokens.get(index), tokens.get(index + 1))
                else {
                    index += 1;
                    continue;
                };

                let (Some(start_code), Some(end_code)) = (code_value(start), code_value(end))
                else {
                    index += 1;
                    continue;
                };

                match tokens.get(index + 2) {
                    Some(CMapToken::Hex(target)) => {
                        if let Some(base) = unicode_value(target) {
                            let span = end_code.saturating_sub(start_code).min(0xFFFF);
                            for offset in 0..=span {
                                if base + offset <= 0x10FFFF {
                                    result.push((start_code + offset, base + offset));
                                }
                            }
                        }
                        index += 3;
                    }
                    Some(CMapToken::ArrayStart) => {
                        let mut cursor = index + 3;
                        let mut glyph = 0u32;
                        while cursor < tokens.len() {
                            match &tokens[cursor] {
                                CMapToken::ArrayEnd => break,
                                CMapToken::Hex(target) => {
                                    if let Some(unicode) = unicode_value(target) {
                                        result.push((start_code + glyph, unicode));
                                    }
                                    glyph += 1;
                                    cursor += 1;
                                }
                                _ => cursor += 1,
                            }
                        }
                        index = cursor + 1;
                    }
                    _ => index += 1,
                }
            }
        } else {
            index += 1;
        }
    }

    result
}

fn code_value(bytes: &[u8]) -> Option<u32> {
    if bytes.is_empty() || bytes.len() > 4 {
        return None;
    }
    Some(
        bytes
            .iter()
            .fold(0u32, |value, byte| (value << 8) | *byte as u32),
    )
}

fn unicode_value(bytes: &[u8]) -> Option<u32> {
    match bytes.len() {
        1 => Some(bytes[0] as u32),
        2 => Some(u16::from_be_bytes([bytes[0], bytes[1]]) as u32),
        4 => {
            let high = u16::from_be_bytes([bytes[0], bytes[1]]);
            let low = u16::from_be_bytes([bytes[2], bytes[3]]);
            if (0xD800..=0xDBFF).contains(&high) && (0xDC00..=0xDFFF).contains(&low) {
                Some(0x10000 + (((high as u32 - 0xD800) << 10) | (low as u32 - 0xDC00)))
            } else {
                Some(high as u32)
            }
        }
        _ => None,
    }
}
