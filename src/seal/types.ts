import type { FontId } from "./fonts";

export type SealMode = "official" | "personal" | "oval" | "signature";

export type OfficialType = "official" | "contract" | "finance" | "custom";

export type SizeMode = "auto" | "manual";
export type PersonalLayoutMode = "auto" | "vertical" | "two-column";

export interface OfficialConfig {
  company: string;
  typeMode: OfficialType;
  typeLabel: string;
  number: string;
  diameter: number;
  fontId: FontId;
  fontWeight: number;
  star: boolean;
  color: string;
  border: number;
  aging: number;
  textInset: number;
  arcSpan: number;
  fontSizeMode: SizeMode;
  fontSize: number;
  letterSpacing: number;
  starSize: number;
  starOffsetY: number;
  bottomSize: number;
  bottomOffset: number;
  bottomSpacing: number;
  numberLayout: "arc" | "line";
  numberSize: number;
  numberInset: number;
  numberArcSpan: number;
  numberOffset: number;
  numberSpacing: number;
}

export interface PersonalConfig {
  name: string;
  suffix: "" | "印" | "之印" | "印信";
  shape: "square" | "round";
  size: number;
  fontId: FontId;
  fontWeight: number;
  carving: "zhu" | "bai";
  color: string;
  border: number;
  aging: number;
  textInset: number;
  glyphGap: number;
  fontSizeMode: SizeMode;
  fontSize: number;
  offsetX: number;
  offsetY: number;
  layout: PersonalLayoutMode;
}

export interface OvalConfig {
  top: string;
  center: string;
  bottom: string;
  number: string;
  width: number;
  height: number;
  fontId: FontId;
  fontWeight: number;
  color: string;
  border: number;
  aging: number;
  topInset: number;
  topArcSpan: number;
  topFontSizeMode: SizeMode;
  topFontSize: number;
  topSpacing: number;
  centerFontSize: number;
  centerOffsetY: number;
  centerSpacing: number;
  bottomInset: number;
  bottomArcSpan: number;
  bottomFontSizeMode: SizeMode;
  bottomFontSize: number;
  bottomSpacing: number;
  numberSize: number;
  numberOffset: number;
  numberSpacing: number;
}

export const DEFAULT_COLOR = "#D40000";

export const DEFAULT_OFFICIAL: OfficialConfig = {
  company: "示例公司",
  typeMode: "official",
  typeLabel: "",
  number: "",
  diameter: 42,
  fontId: "simsun",
  fontWeight: 500,
  star: true,
  color: DEFAULT_COLOR,
  border: 1.2,
  aging: 0,
  textInset: 0.8,
  arcSpan: 140,
  fontSizeMode: "auto",
  fontSize: 5,
  letterSpacing: 0,
  starSize: 14,
  starOffsetY: -0.5,
  bottomSize: 4.2,
  bottomOffset: 11.5,
  bottomSpacing: 0,
  numberLayout: "arc",
  numberSize: 2.2,
  numberInset: 0.8,
  numberArcSpan: 100,
  numberOffset: 17,
  numberSpacing: 0.3,
};

export const DEFAULT_PERSONAL: PersonalConfig = {
  name: "张三",
  suffix: "印",
  shape: "square",
  size: 22,
  fontId: "chongxi",
  fontWeight: 500,
  carving: "zhu",
  color: DEFAULT_COLOR,
  border: 1,
  aging: 0,
  textInset: 1.2,
  glyphGap: 0.4,
  fontSizeMode: "auto",
  fontSize: 7,
  offsetX: 0,
  offsetY: 0,
  layout: "auto",
};

export const DEFAULT_OVAL: OvalConfig = {
  top: "示例公司",
  center: "合同专用章",
  bottom: "",
  number: "",
  width: 40,
  height: 30,
  fontId: "simsun",
  fontWeight: 500,
  color: DEFAULT_COLOR,
  border: 1.2,
  aging: 0,
  topInset: 0.8,
  topArcSpan: 140,
  topFontSizeMode: "auto",
  topFontSize: 4.2,
  topSpacing: 0,
  centerFontSize: 4.6,
  centerOffsetY: 0.6,
  centerSpacing: 0,
  bottomInset: 1,
  bottomArcSpan: 120,
  bottomFontSizeMode: "auto",
  bottomFontSize: 3.2,
  bottomSpacing: 0,
  numberSize: 2,
  numberOffset: 11.5,
  numberSpacing: 0.25,
};

export const OFFICIAL_TYPES = [
  { value: "official", label: "公章", bottom: "" },
  { value: "contract", label: "合同专用章", bottom: "合同专用章" },
  { value: "finance", label: "财务专用章", bottom: "财务专用章" },
  { value: "custom", label: "自定义", bottom: "" },
] as const;

export const PERSONAL_SUFFIXES = [
  { label: "无", value: "" },
  { label: "印", value: "印" },
  { label: "之印", value: "之印" },
  { label: "印信", value: "印信" },
] as const;

export const OFFICIAL_DIAMETERS = [40, 42, 45];
export const PERSONAL_SIZES = [20, 22, 25];
export const OVAL_SIZES = [
  { width: 40, height: 30 },
  { width: 45, height: 30 },
  { width: 50, height: 35 },
];
export const DPI_OPTIONS = [300, 600, 1200];
export const SIGNATURE_WIDTHS = [30, 40, 50, 60, 80];

export const personalText = (name: string, suffix: PersonalConfig["suffix"]) =>
  `${name.trim()}${suffix}`;