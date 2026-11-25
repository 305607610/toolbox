import coverage from "./fontCoverage.json";

export type FontId =
  | "jfzsk"
  | "chongxi"
  | "simsun"
  | "fangsong"
  | "kaiti"
  | "simhei"
  | "lisu"
  | "stzhongsong"
  | "yahei"
  | "youyuan"
  | "xingkai"
  | "xinwei";

export interface FontMeta {
  id: FontId;
  label: string;
  family: string;
  bundled?: "JFZSK" | "ChongXi";
  localNames?: string[];
}

export const FONT_META: Record<FontId, FontMeta> = {
  jfzsk: {
    id: "jfzsk",
    label: "敬峰中山王篆",
    family: '"JFZSK", "SimSun", "宋体", serif',
    bundled: "JFZSK",
  },
  chongxi: {
    id: "chongxi",
    label: "崇羲小篆",
    family: '"ChongXi", "SimSun", "宋体", serif',
    bundled: "ChongXi",
  },
  simsun: {
    id: "simsun",
    label: "宋体",
    family: '"SimSun", "宋体", serif',
    localNames: ["SimSun", "宋体"],
  },
  fangsong: {
    id: "fangsong",
    label: "仿宋",
    family: '"FangSong", "仿宋", serif',
    localNames: ["FangSong", "仿宋"],
  },
  kaiti: {
    id: "kaiti",
    label: "楷体",
    family: '"KaiTi", "楷体", serif',
    localNames: ["KaiTi", "楷体"],
  },
  simhei: {
    id: "simhei",
    label: "黑体",
    family: '"SimHei", "黑体", sans-serif',
    localNames: ["SimHei", "黑体"],
  },
  lisu: {
    id: "lisu",
    label: "隶书",
    family: '"LiSu", "隶书", serif',
    localNames: ["LiSu", "隶书"],
  },
  stzhongsong: {
    id: "stzhongsong",
    label: "华文中宋",
    family: '"STZhongsong", "华文中宋", "SimSun", "宋体", serif',
    localNames: ["STZhongsong", "华文中宋"],
  },
  yahei: {
    id: "yahei",
    label: "微软雅黑",
    family: '"Microsoft YaHei", "微软雅黑", sans-serif',
    localNames: ["Microsoft YaHei", "微软雅黑"],
  },
  youyuan: {
    id: "youyuan",
    label: "幼圆",
    family: '"YouYuan", "幼圆", sans-serif',
    localNames: ["YouYuan", "幼圆"],
  },
  xingkai: {
    id: "xingkai",
    label: "华文行楷",
    family: '"STXingkai", "华文行楷", "KaiTi", "楷体", serif',
    localNames: ["STXingkai", "华文行楷"],
  },
  xinwei: {
    id: "xinwei",
    label: "华文新魏",
    family: '"STXinwei", "华文新魏", "SimSun", "宋体", serif',
    localNames: ["STXinwei", "华文新魏"],
  },
};

export const COMMON_FONT_IDS: FontId[] = [
  "simsun",
  "fangsong",
  "kaiti",
  "simhei",
  "stzhongsong",
  "yahei",
  "lisu",
  "youyuan",
  "xingkai",
  "xinwei",
];

export const OFFICIAL_FONT_IDS: FontId[] = [...COMMON_FONT_IDS];

export const PERSONAL_FONT_IDS: FontId[] = [
  "jfzsk",
  "chongxi",
  ...COMMON_FONT_IDS,
];

const coverageSets: Record<"JFZSK" | "ChongXi", Set<number>> = {
  JFZSK: new Set(coverage.JFZSK),
  ChongXi: new Set(coverage.ChongXi),
};

export function missingGlyphs(fontId: FontId, text: string): string[] {
  const meta = FONT_META[fontId];
  if (!meta.bundled) return [];

  const set = coverageSets[meta.bundled];
  const missing: string[] = [];
  for (const char of Array.from(text)) {
    if (/\s/.test(char)) continue;
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined || set.has(codePoint)) continue;
    if (!missing.includes(char)) missing.push(char);
  }
  return missing;
}

const systemAvailability = new Map<FontId, Promise<boolean>>();

export function probeSystemFont(fontId: FontId): Promise<boolean> {
  const meta = FONT_META[fontId];
  if (meta.bundled) return Promise.resolve(true);
  if (typeof document === "undefined") return Promise.resolve(true);

  const cached = systemAvailability.get(fontId);
  if (cached) return cached;

  const probe = (async () => {
    for (const name of meta.localNames ?? []) {
      try {
        const face = new FontFace(
          `__font_probe_${fontId}_${name}`,
          `local("${name}")`,
        );
        await face.load();
        return true;
      } catch {
        // Try the next local name.
      }
    }
    return false;
  })();

  systemAvailability.set(fontId, probe);
  return probe;
}

export async function loadFont(fontId: FontId): Promise<boolean> {
  const meta = FONT_META[fontId];
  if (!meta.bundled) {
    return probeSystemFont(fontId);
  }
  if (typeof document === "undefined") return true;

  const faces = await document.fonts.load(`16px "${meta.bundled}"`);
  await document.fonts.ready;
  return faces.length > 0;
}

type ConverterFn = (text: string) => string;
let converterPromise: Promise<ConverterFn> | null = null;

export function toTraditional(text: string): Promise<string> {
  if (!text) return Promise.resolve("");
  converterPromise ??= import("opencc-js").then(({ Converter }) => {
    const convert = Converter({ from: "cn", to: "tw" });
    return (value: string) => convert(value);
  });
  return converterPromise.then((convert) => convert(text));
}

export async function displayTextFor(
  fontId: FontId,
  text: string,
): Promise<string> {
  return fontId === "chongxi" ? toTraditional(text) : text;
}

export function fontOptions(ids: FontId[]): FontMeta[] {
  return ids.map((id) => FONT_META[id]);
}

export function fontFamily(fontId: FontId): string {
  return FONT_META[fontId].family;
}