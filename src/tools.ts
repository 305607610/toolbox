import type { LucideIcon } from "lucide-react";
import { ImageDown, Stamp } from "lucide-react";

export type ToolId = "seal" | "compress";
export type ToolGroupId = "documents" | "images";

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
    id: "compress",
    name: "图片压缩",
    groupId: "images",
    description:
      "无损 / 有损压缩图片，在控制画质损耗的前提下减小图片体积，支持批量处理",
    tags: ["JPG", "PNG", "WebP", "批量"],
    icon: ImageDown,
    planned: [],
  },
];

export const toolsInGroup = (groupId: ToolGroupId) =>
  tools.filter((tool) => tool.groupId === groupId);

export const getGroup = (groupId: ToolGroupId) =>
  toolGroups.find((group) => group.id === groupId);

export const getTool = (id: string | undefined) =>
  tools.find((tool) => tool.id === id);