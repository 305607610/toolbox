import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  App as AntdApp,
  Button,
  Dropdown,
  Segmented,
  Select,
  Tabs,
} from "antd";
import type { MenuProps } from "antd";
import {
  ArrowLeft,
  ChevronDown,
  Circle,
  Download,
  PenTool,
  Stamp,
  UserRound,
} from "lucide-react";
import type {
  OfficialConfig,
  OvalConfig,
  PersonalConfig,
  SealMode,
} from "../seal/types";
import {
  DEFAULT_OFFICIAL,
  DEFAULT_OVAL,
  DEFAULT_PERSONAL,
  DPI_OPTIONS,
  SIGNATURE_WIDTHS,
  personalText,
} from "../seal/types";
import { CompanySeal, companyLayout } from "../seal/svg/CompanySeal";
import { OvalSeal, ovalLayout } from "../seal/svg/OvalSeal";
import PersonalSealCanvas from "../seal/personal/PersonalSealCanvas";
import SignatureCanvas from "../seal/signature/SignatureCanvas";
import { useSignaturePad } from "../seal/signature/useSignaturePad";
import { usePersonalFont } from "../seal/usePersonalFont";
import { drawPersonalSeal } from "../seal/personal/drawPersonalSeal";
import {
  canvasToPng,
  svgToFile,
  svgToPng,
  type Background,
} from "../seal/export";
import { exportFilename } from "../seal/filename";
import { mmToPx, personalSealLayout } from "../seal/geometry";
import { saveExport, type SaveFormat } from "../seal/save";
import {
  CompanyForm,
  OvalForm,
  PersonalForm,
  SignatureControls,
} from "../seal/forms/SealForms";
import "../styles/seal.css";

const modeOptions = [
  {
    value: "official",
    label: (
      <span className="seal-mode-label">
        <Stamp size={15} strokeWidth={1.7} aria-hidden="true" />
        公章
      </span>
    ),
  },
  {
    value: "personal",
    label: (
      <span className="seal-mode-label">
        <UserRound size={15} strokeWidth={1.7} aria-hidden="true" />
        个人章
      </span>
    ),
  },
  {
    value: "oval",
    label: (
      <span className="seal-mode-label">
        <Circle size={15} strokeWidth={1.7} aria-hidden="true" />
        椭圆章
      </span>
    ),
  },
  {
    value: "signature",
    label: (
      <span className="seal-mode-label">
        <PenTool size={15} strokeWidth={1.7} aria-hidden="true" />
        签名
      </span>
    ),
  },
];

const mm = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const backgroundOptions = [
  {
    value: "transparent",
    label: (
      <span className="seal-bg-option">
        <span
          className="seal-bg-swatch seal-bg-swatch--transparent"
          aria-hidden="true"
        />
        透明
      </span>
    ),
  },
  {
    value: "white",
    label: (
      <span className="seal-bg-option">
        <span
          className="seal-bg-swatch seal-bg-swatch--white"
          aria-hidden="true"
        />
        白底
      </span>
    ),
  },
];

export default function SealTool() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntdApp.useApp();

  const [mode, setMode] = useState<SealMode>("official");
  const [official, setOfficial] = useState<OfficialConfig>(DEFAULT_OFFICIAL);
  const [personal, setPersonal] = useState<PersonalConfig>(DEFAULT_PERSONAL);
  const [oval, setOval] = useState<OvalConfig>(DEFAULT_OVAL);
  const [dpi, setDpi] = useState(600);
  const [background, setBackground] = useState<Background>("transparent");
  const [signatureWidth, setSignatureWidth] = useState(50);
  const [exporting, setExporting] = useState(false);

  const officialRef = useRef<SVGSVGElement>(null);
  const ovalRef = useRef<SVGSVGElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const exportLock = useRef(false);

  const signature = useSignaturePad();
  const personalFullText = personalText(personal.name, personal.suffix);
  const personalFont = usePersonalFont(
    personalFullText,
    personal.fontId,
    mode === "personal",
  );

  const officialLayout = useMemo(() => companyLayout(official), [official]);
  const ovalLayoutData = useMemo(() => ovalLayout(oval), [oval]);
  const personalLayout = useMemo(
    () =>
      personalSealLayout(Array.from(personalFont.display), {
        size: personal.size,
        border: personal.border,
        shape: personal.shape,
        textInset: personal.textInset,
        glyphGap: personal.glyphGap,
        layout: personal.layout,
        fontSizeMode: personal.fontSizeMode,
        fontSize: personal.fontSize,
        offsetX: personal.offsetX,
        offsetY: personal.offsetY,
      }),
    [personalFont.display, personal],
  );

  const from = (location.state as { from?: string } | null)?.from;
  const goBack = useCallback(() => {
    if (from && from.startsWith("/")) navigate(from);
    else navigate("/");
  }, [from, navigate]);

  useEffect(() => {
    const holder =
      panelRef.current?.querySelector<HTMLElement>(
        ".ant-tabs-body-holder",
      );
    if (holder) holder.scrollTop = 0;
  }, [mode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, [contenteditable='true'], .ant-select, .ant-color-picker, .ant-popover, .ant-modal",
        )
      ) {
        return;
      }
      if (
        document.querySelector(
          ".ant-popover:not(.ant-popover-hidden), .ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-modal-wrap",
        )
      ) {
        return;
      }
      if (signature.drawing) return;
      goBack();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, signature.drawing]);

  const runExport = async (task: () => Promise<void>) => {
    if (exportLock.current) return;
    exportLock.current = true;
    setExporting(true);
    try {
      await task();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      exportLock.current = false;
      setExporting(false);
    }
  };

  const saveAndNotify = async (
    bytes: Uint8Array,
    filename: string,
    format: SaveFormat,
  ) => {
    const result = await saveExport(bytes, filename, format);
    if (result.status === "saved") {
      message.success(`已导出：${result.path}`);
    }
  };

  const exportOfficial = async (format: SaveFormat) => {
    if (!official.company.trim()) {
      message.warning("请先填写单位名称");
      return;
    }
    if (officialLayout.warnings.length > 0) {
      message.warning(officialLayout.warnings[0]);
      return;
    }
    const svg = officialRef.current;
    if (!svg) return;

    await runExport(async () => {
      const widthMm = official.diameter;
      const bytes =
        format === "png"
          ? await svgToPng(svg, {
              widthMm,
              heightMm: widthMm,
              dpi,
              background,
            })
          : new TextEncoder().encode(
              svgToFile(svg, {
                widthMm,
                heightMm: widthMm,
                background,
              }),
            );
      const filename = exportFilename("official", official.company, {
        size: `${mm(official.diameter)}mm`,
        dpi: format === "png" ? dpi : undefined,
        extension: format,
      });
      await saveAndNotify(bytes, filename, format);
    });
  };

  const exportOval = async (format: SaveFormat) => {
    if (!oval.top.trim()) {
      message.warning("请先填写上弧文字");
      return;
    }
    if (ovalLayoutData.warnings.length > 0) {
      message.warning(ovalLayoutData.warnings[0]);
      return;
    }
    const svg = ovalRef.current;
    if (!svg) return;

    await runExport(async () => {
      const bytes =
        format === "png"
          ? await svgToPng(svg, {
              widthMm: oval.width,
              heightMm: oval.height,
              dpi,
              background,
            })
          : new TextEncoder().encode(
              svgToFile(svg, {
                widthMm: oval.width,
                heightMm: oval.height,
                background,
              }),
            );
      const filename = exportFilename("oval", oval.top, {
        size: `${mm(oval.width)}x${mm(oval.height)}mm`,
        dpi: format === "png" ? dpi : undefined,
        extension: format,
      });
      await saveAndNotify(bytes, filename, format);
    });
  };

  const exportPersonal = async () => {
    if (!personal.name.trim()) {
      message.warning("请先填写姓名");
      return;
    }
    if (personalFont.loading) {
      message.warning("篆体正在加载，请稍候");
      return;
    }
    if (personalFont.error) {
      message.warning("字体加载失败，请换一款字体");
      return;
    }
    if (personalFont.missing.length > 0) {
      message.warning(`缺字：${personalFont.missing.join("、")}`);
      return;
    }
    if (personalLayout.overflow) {
      message.warning("字号超过当前布局，请调整字号或留白");
      return;
    }

    await runExport(async () => {
      const canvas = document.createElement("canvas");
      const pxPerMm = mmToPx(personal.size, dpi) / personal.size;
      drawPersonalSeal(canvas, {
        config: personal,
        text: personalFont.display,
        pxPerMm,
        background,
      });
      const bytes = await canvasToPng(canvas, dpi);
      const filename = exportFilename("personal", personalFullText, {
        extension: "png",
      });
      await saveAndNotify(bytes, filename, "png");
    });
  };

  const exportSignature = async () => {
    if (!signature.hasInk) {
      message.warning("请先手写签名");
      return;
    }

    await runExport(async () => {
      const bytes = await signature.exportPng(signatureWidth, background);
      const filename = exportFilename("signature", "", {
        extension: "png",
      });
      await saveAndNotify(bytes, filename, "png");
    });
  };

  const validOfficial =
    official.company.trim().length > 0 &&
    officialLayout.warnings.length === 0;
  const validPersonal =
    personal.name.trim().length > 0 &&
    !personalFont.loading &&
    !personalFont.error &&
    personalFont.missing.length === 0 &&
    !personalLayout.overflow;
  const validOval =
    oval.top.trim().length > 0 &&
    ovalLayoutData.warnings.length === 0;
  const validSignature = signature.hasInk;

  const exportDisabled =
    exporting ||
    (mode === "official" && !validOfficial) ||
    (mode === "personal" && !validPersonal) ||
    (mode === "oval" && !validOval) ||
    (mode === "signature" && !validSignature);

  const exportWarnings: string[] =
    mode === "official"
      ? [
          ...(official.company.trim() ? [] : ["请填写单位名称。"]),
          ...officialLayout.warnings,
        ]
      : mode === "personal"
        ? [
            ...(personal.name.trim() ? [] : ["请填写姓名。"]),
            ...(personalFont.loading ? ["篆体加载中。"] : []),
            ...(personalFont.error
              ? ["字体加载失败，请换一款字体。"]
              : []),
            ...(personalFont.missing.length > 0
              ? [`缺字：${personalFont.missing.join("、")}。`]
              : []),
            ...(personalLayout.overflow
              ? ["字号超过当前布局可容纳大小。"]
              : []),
          ]
        : mode === "oval"
          ? [
              ...(oval.top.trim() ? [] : ["请填写上弧文字。"]),
              ...ovalLayoutData.warnings,
            ]
          : [...(signature.hasInk ? [] : ["请先手写签名。"])];

  const svgMenu: MenuProps = {
    items: [
      {
        key: "svg",
        label: "导出 SVG",
        disabled: exportDisabled,
      },
    ],
    onClick: ({ key }) => {
      if (key !== "svg") return;
      if (mode === "official") void exportOfficial("svg");
      if (mode === "oval") void exportOval("svg");
    },
  };

  const mainExport = () => {
    if (mode === "official") void exportOfficial("png");
    if (mode === "personal") void exportPersonal();
    if (mode === "oval") void exportOval("png");
    if (mode === "signature") void exportSignature();
  };

  const stageCaption =
    mode === "official"
      ? `圆形 · Ø${mm(official.diameter)}mm`
      : mode === "personal"
        ? `${mm(personal.size)}mm · ${personal.carving === "zhu" ? "朱文" : "白文"}`
        : mode === "oval"
          ? `${mm(oval.width)} × ${mm(oval.height)}mm`
          : "手写签名";

  const panelTabs = modeOptions.map((option) => ({
    key: option.value,
    label: option.label,
    children:
      option.value === "official" ? (
        <CompanyForm
          config={official}
          onChange={(patch) =>
            setOfficial((previous) => ({ ...previous, ...patch }))
          }
          layout={officialLayout}
          onReset={() => setOfficial(DEFAULT_OFFICIAL)}
        />
      ) : option.value === "personal" ? (
        <PersonalForm
          config={personal}
          onChange={(patch) =>
            setPersonal((previous) => ({ ...previous, ...patch }))
          }
          fontState={personalFont}
          layout={personalLayout}
          onReset={() => setPersonal(DEFAULT_PERSONAL)}
        />
      ) : option.value === "oval" ? (
        <OvalForm
          config={oval}
          onChange={(patch) =>
            setOval((previous) => ({ ...previous, ...patch }))
          }
          layout={ovalLayoutData}
          onReset={() => setOval(DEFAULT_OVAL)}
        />
      ) : (
        <SignatureControls signature={signature} />
      ),
  }));

  return (
    <div className="tool-page seal-page">
      <div className="seal-topbar">
        <Button
          type="text"
          className="back-btn"
          icon={<ArrowLeft size={16} strokeWidth={1.8} />}
          onClick={goBack}
        >
          返回工作台
        </Button>
      </div>

      <div className="seal-workspace">
        <aside ref={panelRef} className="seal-panel" aria-label="印章配置">
          <Tabs
            className="seal-tabs"
            activeKey={mode}
            items={panelTabs}
            animated={false}
            onChange={(key) => setMode(key as SealMode)}
          />
        </aside>

        <section className="seal-stage" aria-label="印章预览">
          <div className="seal-stage-head">
            <p className="seal-stage-caption">{stageCaption}</p>
            <div className="seal-bg-control">
              <span className="seal-bg-label">背景</span>
              <Segmented
                size="small"
                className="seal-bg-switch"
                value={background}
                options={backgroundOptions}
                onChange={(value) => setBackground(value as Background)}
              />
            </div>
          </div>

          <div
            className={`seal-paper${mode === "signature" ? " seal-paper--signature" : ""}${background === "white" ? " seal-paper--white" : ""}`}
          >
            {mode === "official" && (
              <div className="seal-artboard seal-artboard--official">
                <CompanySeal ref={officialRef} config={official} />
              </div>
            )}
            {mode === "oval" && (
              <div className="seal-artboard seal-artboard--oval">
                <OvalSeal ref={ovalRef} config={oval} />
              </div>
            )}
            {mode === "personal" && (
              <div className="seal-artboard seal-artboard--personal">
                <PersonalSealCanvas
                  config={personal}
                  text={personalFont.display}
                  ready={
                    !personalFont.loading &&
                    !personalFont.error &&
                    personalFont.missing.length === 0
                  }
                />
                {personalFont.loading && (
                  <div className="stage-loading">正在加载篆体…</div>
                )}
                {personalFont.error && (
                  <div className="stage-loading stage-loading--error">
                    字体加载失败
                  </div>
                )}
                {!personalFont.loading &&
                  !personalFont.error &&
                  personalFont.missing.length > 0 && (
                    <div className="stage-loading stage-loading--error">
                      <span>缺字：{personalFont.missing.join("、")}</span>
                      <span className="stage-loading-sub">
                        请换字体或改字
                      </span>
                    </div>
                  )}
              </div>
            )}
            {mode === "signature" && (
              <div className="signature-artboard">
                <SignatureCanvas signature={signature} />
              </div>
            )}
          </div>

          <div className="seal-export">
            {exportWarnings.length > 0 && (
              <p className="seal-export-warning">
                {exportWarnings[0]}
                {exportWarnings.length > 1
                  ? `（共 ${exportWarnings.length} 项提示）`
                  : ""}
              </p>
            )}

            <div className="seal-export-row">
              <div className="export-field">
                <span className="export-label">
                  {mode === "signature" ? "宽度" : "精度"}
                </span>
                {mode === "signature" ? (
                  <Select
                    value={signatureWidth}
                    options={SIGNATURE_WIDTHS.map((width) => ({
                      value: width,
                      label: `${width}mm`,
                    }))}
                    onChange={(value) => setSignatureWidth(Number(value))}
                  />
                ) : (
                  <Select
                    value={dpi}
                    options={DPI_OPTIONS.map((value) => ({
                      value,
                      label: `${value} DPI`,
                    }))}
                    onChange={(value) => setDpi(Number(value))}
                  />
                )}
              </div>

              <div
                className={`seal-export-actions${mode === "official" || mode === "oval" ? " seal-export-actions--split" : ""}`}
              >
                <Button
                  type="primary"
                  size="large"
                  className="export-main"
                  icon={<Download size={16} strokeWidth={1.8} />}
                  loading={exporting}
                  disabled={exportDisabled && !exporting}
                  onClick={mainExport}
                >
                  导出 PNG
                </Button>
                {(mode === "official" || mode === "oval") && (
                  <Dropdown
                    menu={svgMenu}
                    trigger={["click"]}
                    disabled={exportDisabled}
                  >
                    <Button
                      size="large"
                      className="export-more"
                      aria-label="更多导出格式"
                      disabled={exportDisabled}
                      icon={<ChevronDown size={16} strokeWidth={1.8} />}
                    />
                  </Dropdown>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}