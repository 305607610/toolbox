const RESERVED_WINDOWS_NAMES =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function sanitizeFilename(value: string, fallback = "未命名"): string {
  let cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  if (!cleaned) cleaned = fallback;
  if (RESERVED_WINDOWS_NAMES.test(cleaned)) cleaned = `_${cleaned}`;
  return cleaned.slice(0, 80);
}

function dateStamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function exportFilename(
  kind: "official" | "personal" | "oval" | "signature",
  subject: string,
  options: { size?: string; dpi?: number; extension?: string } = {},
): string {
  const extension = options.extension ?? "png";
  const name = sanitizeFilename(subject);

  if (kind === "signature") {
    return `签名_${dateStamp()}.${extension}`;
  }

  const size = options.size ? `_${options.size}` : "";
  const dpi =
    options.dpi && kind !== "personal" ? `_${options.dpi}dpi` : "";

  if (kind === "official") {
    return `公章_${name}${size}${dpi}.${extension}`;
  }
  if (kind === "oval") {
    return `椭圆章_${name}${size}${dpi}.${extension}`;
  }
  return `个人章_${name}.${extension}`;
}