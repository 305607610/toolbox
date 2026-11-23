import { useMemo } from "react";
import { App as AntdApp, ConfigProvider, theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";
import zhCN from "antd/locale/zh_CN";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import CompressTool from "./pages/CompressTool";
import ConvertTool from "./pages/ConvertTool";
import EncodingTool from "./pages/EncodingTool";
import Home from "./pages/Home";
import IdPhotoTool from "./pages/IdPhotoTool";
import ImageEditTool from "./pages/ImageEditTool";
import JsonTool from "./pages/JsonTool";
import PdfTool from "./pages/PdfTool";
import PdfToolsTool from "./pages/PdfToolsTool";
import QrCodeTool from "./pages/QrCodeTool";
import SealTool from "./pages/SealTool";
import ToolPage from "./pages/ToolPage";
import { useThemePreference } from "./hooks/useThemePreference";

const fontFamily =
  '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif';

export default function App() {
  const { theme, toggleTheme } = useThemePreference();
  const isDark = theme === "dark";

  const themeConfig = useMemo<ThemeConfig>(
    () => ({
      algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        fontFamily,
        colorPrimary: isDark ? "#3B82F6" : "#2563EB",
        colorInfo: isDark ? "#3B82F6" : "#2563EB",
        colorBgBase: isDark ? "#0F1115" : "#F6F6F4",
        colorBgLayout: isDark ? "#0F1115" : "#F6F6F4",
        colorBgContainer: isDark ? "#161A21" : "#FFFFFF",
        colorBgElevated: isDark ? "#1B2029" : "#FFFFFF",
        colorText: isDark ? "#F2F4F7" : "#1C1D20",
        colorTextSecondary: isDark ? "#9AA3B1" : "#5F646B",
        colorTextTertiary: isDark ? "#8A94A3" : "#5F646B",
        colorTextPlaceholder: isDark ? "#8B95A5" : "#6B7077",
        colorTextDisabled: isDark ? "#9AA3B1" : "#5F646B",
        motionEaseInBack: "cubic-bezier(0.2, 0.7, 0.2, 1)",
        motionEaseOutBack: "cubic-bezier(0.2, 0.7, 0.2, 1)",
        motionEaseInOutBack: "cubic-bezier(0.2, 0.7, 0.2, 1)",
        colorBorder: isDark ? "#252A34" : "#E4E4DF",
        colorBorderSecondary: isDark ? "#1F242D" : "#EDEDE9",
        borderRadius: 10,
        borderRadiusLG: 12,
        borderRadiusSM: 8,
        controlHeight: 36,
        fontSize: 14,
        lineWidth: 1,
        wireframe: false,
      },
      components: {
        Button: {
          fontWeight: 500,
          primaryShadow: "none",
          defaultShadow: "none",
          dangerShadow: "none",
        },
        Input: {
          activeShadow: isDark
            ? "0 0 0 3px rgba(59,130,246,.24)"
            : "0 0 0 3px rgba(37,99,235,.16)",
          hoverBorderColor: isDark ? "#3A4150" : "#D6D6D0",
          activeBorderColor: isDark ? "#3B82F6" : "#2563EB",
        },
        Menu: {
          itemBg: "transparent",
          itemColor: isDark ? "#9AA3B1" : "#5F646B",
          itemHoverBg: isDark ? "#1C212A" : "#E9E9E5",
          itemHoverColor: isDark ? "#F2F4F7" : "#1C1D20",
          itemSelectedBg: isDark ? "rgba(59,130,246,.14)" : "#EAF1FE",
          itemSelectedColor: isDark ? "#93C5FD" : "#1D4ED8",
          itemBorderRadius: 8,
          itemHeight: 40,
          itemMarginInline: 0,
          itemMarginBlock: 2,
          iconSize: 17,
        },
        Tag: {
          defaultBg: "transparent",
          defaultColor: isDark ? "#9AA3B1" : "#5F646B",
        },
        Tooltip: {
          colorBgSpotlight: isDark ? "#F2F4F7" : "#1C1D20",
          colorTextLightSolid: isDark ? "#0F1115" : "#FFFFFF",
        },
      },
    }),
    [isDark],
  );

  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <AntdApp>
        <HashRouter>
          <Routes>
            <Route element={<AppShell theme={theme} onToggleTheme={toggleTheme} />}>
              <Route index element={<Home />} />
              <Route path="tool/seal" element={<SealTool />} />
              <Route path="tool/compress" element={<CompressTool />} />
              <Route path="tool/idphoto" element={<IdPhotoTool />} />
              <Route path="tool/pdf" element={<PdfTool />} />
              <Route path="tool/convert" element={<ConvertTool />} />
              <Route path="tool/imageedit" element={<ImageEditTool />} />
              <Route path="tool/qrcode" element={<QrCodeTool />} />
              <Route path="tool/json" element={<JsonTool />} />
              <Route path="tool/base64" element={<EncodingTool />} />
              <Route path="tool/pdftools" element={<PdfToolsTool />} />
              <Route path="tool/:toolId" element={<ToolPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </AntdApp>
    </ConfigProvider>
  );
}