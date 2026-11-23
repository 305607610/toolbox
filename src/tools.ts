import type { LucideIcon } from "lucide-react";
import {
  Binary,
  Braces,
  FileImage,
  FileCode2,
  FileStack,
  IdCard,
  ImageDown,
  QrCode,
  SlidersHorizontal,
  Stamp,
} from "lucide-react";

export type ToolId =
  | "seal"
  | "compress"
  | "idphoto"
  | "pdf"
  | "convert"
  | "imageedit"
  | "qrcode"
  | "json"
  | "base64"
  | "pdftools";
export type ToolGroupId = "documents" | "images" | "dev";

export interface ToolGroup {
  id: ToolGroupId;
  label: string;
}

export interface Tool {
  id: ToolId;
  name: string;
  groupId: ToolGroupId;
  description: string;
  tags: string[];
  icon: LucideIcon;
  planned: string[];
}

export const toolGroups: ToolGroup[] = [
  { id: "documents", label: "文书" },
  { id: "images", label: "图像" },
  { id: "dev", label: "开发" },
];

export const tools: Tool[] = [
  {
    id: "seal",
    name: "电子印章",
    groupId: "documents",
    description:
      "快速生成电子签章，支持自定义签章文字、样式、颜色，一键导出透明底签章图片",
    tags: ["公章", "个人章", "椭圆章", "手写签名"],
    icon: Stamp,
    planned: [],
  },
  {
    id: "pdf",
    name: "PDF 转 HTML",
    groupId: "documents",
    description:
      "把 PDF 转成单个可离线打开的 HTML，原页原样呈现，文字可编辑、图片可替换",
    tags: ["PDF", "HTML", "可编辑", "离线"],
    icon: FileCode2,
    planned: [],
  },
  {
    id: "pdftools",
    name: "PDF 工具箱",
    groupId: "documents",
    description:
      "合并、拆分、删除、旋转 PDF 页面，添加水印或印章，也能把图片转成 PDF",
    tags: ["合并", "拆分", "旋转", "水印", "图片转 PDF"],
    icon: FileStack,
    planned: [],
  },
  {
    id: "compress",
    name: "图片压缩",
    groupId: "images",
    description:
      "无损 / 有损压缩图片，在控制画质损耗的前提下减小图片体积，支持批量处理",
    tags: ["JPG", "PNG", "WebP", "批量"],
    icon: ImageDown,
    planned: [],
  },
  {
    id: "idphoto",
    name: "证件照",
    groupId: "images",
    description:
      "一寸、二寸证件照制作，自动更换底色，可排版到 6 寸相纸打印",
    tags: ["一寸", "二寸", "换底色", "排版打印"],
    icon: IdCard,
    planned: [],
  },
  {
    id: "convert",
    name: "图片格式转换",
    groupId: "images",
    description:
      "把一批图片统一转成 JPG、PNG 或 WebP，保持原尺寸与画面内容",
    tags: ["JPG", "PNG", "WebP", "批量"],
    icon: FileImage,
    planned: [],
  },
  {
    id: "imageedit",
    name: "图片处理",
    groupId: "images",
    description:
      "批量旋转、翻转、裁剪、缩放与加水印，同一组设置一次套用到所有图片",
    tags: ["旋转", "裁剪", "缩放", "水印"],
    icon: SlidersHorizontal,
    planned: [],
  },
  {
    id: "qrcode",
    name: "二维码",
    groupId: "images",
    description:
      "生成文本、网址与 WiFi 二维码，也能从图片或剪贴板识别二维码",
    tags: ["生成", "识别", "WiFi", "PNG / SVG"],
    icon: QrCode,
    planned: [],
  },
  {
    id: "json",
    name: "JSON 格式化",
    groupId: "dev",
    description:
      "格式化、压缩、校验与排序 JSON，出错时直接定位到行列",
    tags: ["格式化", "压缩", "校验", "高亮"],
    icon: Braces,
    planned: [],
  },
  {
    id: "base64",
    name: "Base64 / URL 编解码",
    groupId: "dev",
    description:
      "文本与文件的 Base64 编解码，以及 URL 编码解码和查询参数解析",
    tags: ["Base64", "URL", "文件", "Data URL"],
    icon: Binary,
    planned: [],
  },
];

export const toolsInGroup = (groupId: ToolGroupId) =>
  tools.filter((tool) => tool.groupId === groupId);

export const getGroup = (groupId: ToolGroupId) =>
  toolGroups.find((group) => group.id === groupId);

export const getTool = (id: string | undefined) =>
  tools.find((tool) => tool.id === id);

export const isToolGroupId = (value: string | null): value is ToolGroupId =>
  !!value && toolGroups.some((group) => group.id === value);