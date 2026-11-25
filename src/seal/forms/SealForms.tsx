import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Button,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Segmented,
  Select,
  Slider,
  Switch,
} from "antd";
import {
  Eraser,
  ImagePlus,
  PenTool,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import type {
  SignatureInkMode,
  SignaturePad,
  SignatureSource,
} from "../signature/useSignaturePad";
import type {
  OfficialConfig,
  OfficialType,
  OvalConfig,
  PersonalConfig,
  PersonalLayoutMode,
} from "../types";
import {
  OFFICIAL_TYPES,
  OVAL_SIZES,
  PERSONAL_SUFFIXES,
} from "../types";
import {
  fontOptions,
  OFFICIAL_FONT_IDS,
  PERSONAL_FONT_IDS,
  probeSystemFont,
  type FontId,
} from "../fonts";
import type { PersonalFontState } from "../usePersonalFont";
import type { PersonalLayout } from "../geometry";
import type { CompanyLayout } from "../svg/CompanySeal";
import type { OvalLayout } from "../svg/OvalSeal";
import HelpTip from "../../components/HelpTip";

interface MetricFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  precision?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  extra?: ReactNode;
  hint?: string;
  tip?: string;
}

function MetricField({
  label,
  value,
  min,
  max,
  step,
  unit,
  precision = 2,
  onChange,
  disabled = false,
  extra,
  hint,
  tip,
}: MetricFieldProps) {
  const commit = (next: number | null) => {
    if (next === null || Number.isNaN(next)) return;
    onChange(Math.min(max, Math.max(min, next)));
  };

  return (
    <div className={`metric-field${disabled ? " is-disabled" : ""}`}>
      <div className="metric-head">
        <span className="metric-label">
          {label}
          {tip && <HelpTip text={tip} />}
        </span>
        <div className="metric-tail">
          {extra}
          <InputNumber
            size="small"
            className="metric-input"
            min={min}
            max={max}
            step={step}
            precision={precision}
            value={value}
            suffix={unit || undefined}
            disabled={disabled}
            onChange={commit}
          />
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={onChange}
        tooltip={{ formatter: (next) => `${next}${unit}` }}
      />
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="inspector-section">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

function FormWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="form-warnings" role="status">
      {warnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="switch-row">
      <span>{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

function ResetFooter({ onReset }: { onReset: () => void }) {
  return (
    <div className="form-footer">
      <Popconfirm
        title="恢复该模式的标准值？"
        okText="恢复"
        cancelText="取消"
        onConfirm={onReset}
      >
        <Button
          type="text"
          size="small"
          icon={<RotateCcw size={14} strokeWidth={1.7} />}
        >
          恢复标准值
        </Button>
      </Popconfirm>
    </div>
  );
}

function FontSelect({
  ids,
  value,
  onChange,
}: {
  ids: FontId[];
  value: FontId;
  onChange: (value: FontId) => void;
}) {
  const [unavailable, setUnavailable] = useState<Set<FontId>>(
    () => new Set(),
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      ids.map(async (id) => [id, await probeSystemFont(id)] as const),
    ).then((results) => {
      if (cancelled) return;
      setUnavailable(
        new Set(
          results.filter(([, available]) => !available).map(([id]) => id),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const options = fontOptions(ids).map((font) => ({
    value: font.id,
    label: font.label,
    disabled: unavailable.has(font.id),
  }));

  return (
    <Select
      value={value}
      options={options}
      onChange={(next) => onChange(next as FontId)}
      popupMatchSelectWidth={false}
    />
  );
}

function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ColorPicker
      value={value}
      onChangeComplete={(color) => onChange(color.toHexString())}
      showText
      presets={[
        {
          label: "印泥红",
          colors: ["#D40000", "#C8102E", "#E60012", "#A61B29"],
        },
      ]}
    />
  );
}

function FontSizeField({
  label,
  config,
  autoSize,
  onChange,
}: {
  label: string;
  config: {
    fontSizeMode: "auto" | "manual";
    fontSize: number;
  };
  autoSize: number;
  onChange: (patch: {
    fontSizeMode?: "auto" | "manual";
    fontSize?: number;
  }) => void;
}) {
  const auto = config.fontSizeMode === "auto";
  return (
    <MetricField
      label={label}
      value={auto ? autoSize : config.fontSize}
      min={1}
      max={18}
      step={0.1}
      unit="mm"
      disabled={auto}
      onChange={(value) => onChange({ fontSize: value })}
      extra={
        <span className="metric-auto">
          自动
          <Switch
            size="small"
            checked={auto}
            onChange={(checked) =>
              onChange(
                checked
                  ? { fontSizeMode: "auto" }
                  : { fontSizeMode: "manual", fontSize: autoSize },
              )
            }
          />
        </span>
      }
      hint={
        auto
          ? `自动适配 ${Number(autoSize.toFixed(2))}mm`
          : "手动字号"
      }
    />
  );
}

export function CompanyForm({
  config,
  onChange,
  layout,
  onReset,
}: {
  config: OfficialConfig;
  onChange: (patch: Partial<OfficialConfig>) => void;
  layout: CompanyLayout;
  onReset: () => void;
}) {
  return (
    <Form layout="vertical" requiredMark={false} className="seal-form">
      <FormWarnings warnings={layout.warnings} />

      <Section title="单位名称">
        <Form.Item>
          <Input
            aria-label="单位名称"
            value={config.company}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onChange({ company: event.target.value })}
            onFocus={(event) => event.currentTarget.select()}
          />
        </Form.Item>
        <MetricField
          label="文字距边框"
          value={config.textInset}
          min={0}
          max={10}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ textInset: value })}
        />
        <MetricField
          label="弧跨度"
          value={config.arcSpan}
          min={60}
          max={320}
          step={1}
          unit="°"
          precision={0}
          onChange={(value) => onChange({ arcSpan: value })}
        />
        <FontSizeField
          label="字号"
          config={config}
          autoSize={layout.fit.autoFontSize}
          onChange={onChange}
        />
        <MetricField
          label="字距"
          value={config.letterSpacing}
          min={-0.5}
          max={3}
          step={0.05}
          unit="mm"
          onChange={(value) => onChange({ letterSpacing: value })}
        />
      </Section>

      <Section title="章型与底部文字">
        <Form.Item label="章型">
          <Select
            value={config.typeMode}
            options={OFFICIAL_TYPES.map((type) => ({
              value: type.value,
              label: type.label,
            }))}
            onChange={(next) => {
              const type = OFFICIAL_TYPES.find((item) => item.value === next);
              if (!type) return;
              onChange({
                typeMode: type.value as OfficialType,
                typeLabel:
                  type.value === "custom" ? config.typeLabel : type.bottom,
              });
            }}
          />
        </Form.Item>
        {config.typeMode === "custom" && (
          <Form.Item label="底部文字">
            <Input
              value={config.typeLabel}
              maxLength={18}
              placeholder="例如：合同专用章"
              onChange={(event) =>
                onChange({ typeLabel: event.target.value })
              }
            />
          </Form.Item>
        )}
        <MetricField
          label="字号"
          value={config.bottomSize}
          min={1}
          max={10}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ bottomSize: value })}
        />
        <MetricField
          label="上下位置"
          value={config.bottomOffset}
          min={0}
          max={24}
          step={0.5}
          unit="mm"
          precision={1}
          onChange={(value) => onChange({ bottomOffset: value })}
        />
        <MetricField
          label="字距"
          value={config.bottomSpacing}
          min={-0.5}
          max={3}
          step={0.05}
          unit="mm"
          onChange={(value) => onChange({ bottomSpacing: value })}
        />
      </Section>

      <Section title="编号">
        <Form.Item>
          <Input
            aria-label="编号"
            value={config.number}
            maxLength={24}
            placeholder="可选"
            onChange={(event) => onChange({ number: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="排版">
          <Segmented
            block
            value={config.numberLayout}
            options={[
              { label: "弧排", value: "arc" },
              { label: "横排", value: "line" },
            ]}
            onChange={(value) =>
              onChange({ numberLayout: value as "arc" | "line" })
            }
          />
        </Form.Item>
        <MetricField
          label="字号"
          value={config.numberSize}
          min={0.8}
          max={6}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ numberSize: value })}
        />
        {config.numberLayout === "arc" ? (
          <>
            <MetricField
              label="距边框"
              value={config.numberInset}
              min={0}
              max={6}
              step={0.1}
              unit="mm"
              onChange={(value) => onChange({ numberInset: value })}
            />
            <MetricField
              label="弧跨度"
              value={config.numberArcSpan}
              min={40}
              max={180}
              step={1}
              unit="°"
              precision={0}
              onChange={(value) => onChange({ numberArcSpan: value })}
            />
          </>
        ) : (
          <MetricField
            label="上下位置"
            value={config.numberOffset}
            min={0}
            max={26}
            step={0.5}
            unit="mm"
            precision={1}
            onChange={(value) => onChange({ numberOffset: value })}
          />
        )}
        <MetricField
          label="字距"
          value={config.numberSpacing}
          min={0}
          max={2}
          step={0.05}
          unit="mm"
          onChange={(value) => onChange({ numberSpacing: value })}
        />
      </Section>

      <Section title="五角星">
        <ToggleRow
          label="中心五角星"
          checked={config.star}
          onChange={(checked) => onChange({ star: checked })}
        />
        {config.star && (
          <>
            <MetricField
              label="五角星直径"
              value={config.starSize}
              min={4}
              max={28}
              step={0.5}
              unit="mm"
              precision={1}
              onChange={(value) => onChange({ starSize: value })}
            />
            <MetricField
              label="上下位置"
              value={config.starOffsetY}
              min={-8}
              max={8}
              step={0.5}
              unit="mm"
              precision={1}
              onChange={(value) => onChange({ starOffsetY: value })}
            />
          </>
        )}
      </Section>

      <Section title="整体">
        <MetricField
          label="直径"
          value={config.diameter}
          min={20}
          max={80}
          step={0.5}
          unit="mm"
          precision={1}
          onChange={(value) => onChange({ diameter: value })}
        />
        <MetricField
          label="边框粗细"
          value={config.border}
          min={0.2}
          max={4}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ border: value })}
        />
        <MetricField
          label="做旧程度"
          value={config.aging}
          min={0}
          max={100}
          step={1}
          unit="%"
          precision={0}
          onChange={(value) => onChange({ aging: value })}
          tip="用不规则的泛白模拟印泥磨损，0 为关闭。"
        />
        <Form.Item label="字体">
          <FontSelect
            ids={OFFICIAL_FONT_IDS}
            value={config.fontId}
            onChange={(fontId) => onChange({ fontId })}
          />
        </Form.Item>
        <MetricField
          label="字体粗细"
          value={config.fontWeight}
          min={300}
          max={800}
          step={100}
          unit=""
          precision={0}
          onChange={(value) => onChange({ fontWeight: value })}
        />
        <Form.Item label="印章颜色">
          <ColorField
            value={config.color}
            onChange={(color) => onChange({ color })}
          />
        </Form.Item>
      </Section>

      <ResetFooter onReset={onReset} />
    </Form>
  );
}

export function PersonalForm({
  config,
  onChange,
  fontState,
  layout,
  onReset,
}: {
  config: PersonalConfig;
  onChange: (patch: Partial<PersonalConfig>) => void;
  fontState: PersonalFontState;
  layout: PersonalLayout;
  onReset: () => void;
}) {
  const warnings = layout.overflow
    ? ["字号超过当前布局可容纳大小，请减小字号或增加留白。"]
    : [];

  return (
    <Form layout="vertical" requiredMark={false} className="seal-form">
      <FormWarnings warnings={warnings} />

      <Section title="姓名">
        <Form.Item>
          <Input
            aria-label="姓名"
            value={config.name}
            maxLength={4}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onChange({ name: event.target.value })}
            onFocus={(event) => event.currentTarget.select()}
          />
        </Form.Item>
        <Form.Item label="后缀">
          <Segmented
            block
            value={config.suffix}
            options={PERSONAL_SUFFIXES.map((suffix) => ({
              label: suffix.label,
              value: suffix.value,
            }))}
            onChange={(value) =>
              onChange({ suffix: value as PersonalConfig["suffix"] })
            }
          />
        </Form.Item>
        <Form.Item label="字体">
          <FontSelect
            ids={PERSONAL_FONT_IDS}
            value={config.fontId}
            onChange={(fontId) => onChange({ fontId })}
          />
        </Form.Item>
        <MetricField
          label="字体粗细"
          value={config.fontWeight}
          min={300}
          max={800}
          step={100}
          unit=""
          precision={0}
          onChange={(value) => onChange({ fontWeight: value })}
        />
        {fontState.loading && (
          <div className="field-note">正在加载篆体…</div>
        )}
        {!fontState.loading && fontState.error && (
          <div className="field-note field-note--warn">
            字体加载失败，请换一款字体或重启应用。
          </div>
        )}
        {!fontState.loading &&
          !fontState.error &&
          fontState.missing.length > 0 && (
            <div className="field-note field-note--warn">
              缺字：{fontState.missing.join("、")}。请换字体或改字。
            </div>
          )}
        {!config.name.trim() && (
          <div className="field-note field-note--warn">请输入姓名。</div>
        )}
      </Section>

      <Section title="版面">
        <Form.Item label="布局">
          <Select
            value={config.layout}
            options={[
              { value: "auto", label: "自动" },
              { value: "vertical", label: "竖排" },
              { value: "two-column", label: "双列" },
            ]}
            onChange={(value) =>
              onChange({ layout: value as PersonalLayoutMode })
            }
          />
        </Form.Item>
        <MetricField
          label="文字距边框"
          value={config.textInset}
          min={0}
          max={8}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ textInset: value })}
        />
        <MetricField
          label="字间距"
          value={config.glyphGap}
          min={0}
          max={4}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ glyphGap: value })}
        />
        <FontSizeField
          label="字号"
          config={config}
          autoSize={layout.autoFontSize}
          onChange={onChange}
        />
        <MetricField
          label="整体左右偏移"
          value={config.offsetX}
          min={-6}
          max={6}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ offsetX: value })}
        />
        <MetricField
          label="整体上下偏移"
          value={config.offsetY}
          min={-6}
          max={6}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ offsetY: value })}
        />
      </Section>

      <Section title="整体">
        <Form.Item label="形状">
          <Segmented
            block
            value={config.shape}
            options={[
              { label: "方形", value: "square" },
              { label: "圆形", value: "round" },
            ]}
            onChange={(value) =>
              onChange({ shape: value as PersonalConfig["shape"] })
            }
          />
        </Form.Item>
        <MetricField
          label="尺寸"
          value={config.size}
          min={12}
          max={40}
          step={0.5}
          unit="mm"
          precision={1}
          onChange={(value) => onChange({ size: value })}
        />
        <MetricField
          label="边框粗细"
          value={config.border}
          min={0.2}
          max={4}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ border: value })}
        />
        <MetricField
          label="做旧程度"
          value={config.aging}
          min={0}
          max={100}
          step={1}
          unit="%"
          precision={0}
          onChange={(value) => onChange({ aging: value })}
          tip="用不规则的泛白模拟印泥磨损，0 为关闭。"
        />
        <Form.Item label="刻法">
          <Segmented
            block
            value={config.carving}
            options={[
              { label: "朱文", value: "zhu" },
              { label: "白文", value: "bai" },
            ]}
            onChange={(value) =>
              onChange({ carving: value as PersonalConfig["carving"] })
            }
          />
        </Form.Item>
        <Form.Item label="印章颜色">
          <ColorField
            value={config.color}
            onChange={(color) => onChange({ color })}
          />
        </Form.Item>
      </Section>

      <ResetFooter onReset={onReset} />
    </Form>
  );
}

export function OvalForm({
  config,
  onChange,
  layout,
  onReset,
}: {
  config: OvalConfig;
  onChange: (patch: Partial<OvalConfig>) => void;
  layout: OvalLayout;
  onReset: () => void;
}) {
  const currentSize = OVAL_SIZES.find(
    (size) => size.width === config.width && size.height === config.height,
  );
  const sizeValue = currentSize
    ? `${currentSize.width}x${currentSize.height}`
    : "custom";

  const topFontChange = (patch: {
    fontSizeMode?: "auto" | "manual";
    fontSize?: number;
  }) => {
    const next: Partial<OvalConfig> = {};
    if (patch.fontSizeMode) next.topFontSizeMode = patch.fontSizeMode;
    if (patch.fontSize !== undefined) next.topFontSize = patch.fontSize;
    onChange(next);
  };

  const bottomFontChange = (patch: {
    fontSizeMode?: "auto" | "manual";
    fontSize?: number;
  }) => {
    const next: Partial<OvalConfig> = {};
    if (patch.fontSizeMode) next.bottomFontSizeMode = patch.fontSizeMode;
    if (patch.fontSize !== undefined) next.bottomFontSize = patch.fontSize;
    onChange(next);
  };

  return (
    <Form layout="vertical" requiredMark={false} className="seal-form">
      <FormWarnings warnings={layout.warnings} />

      <Section title="上弧">
        <Form.Item>
          <Input
            aria-label="上弧文字"
            value={config.top}
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onChange({ top: event.target.value })}
          />
        </Form.Item>
        {!config.top.trim() && (
          <div className="field-note field-note--warn">
            请输入上弧文字。
          </div>
        )}
        <MetricField
          label="文字距边框"
          value={config.topInset}
          min={0}
          max={10}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ topInset: value })}
        />
        <MetricField
          label="弧跨度"
          value={config.topArcSpan}
          min={60}
          max={300}
          step={1}
          unit="°"
          precision={0}
          onChange={(value) => onChange({ topArcSpan: value })}
        />
        <FontSizeField
          label="字号"
          config={{
            fontSizeMode: config.topFontSizeMode,
            fontSize: config.topFontSize,
          }}
          autoSize={layout.top.autoFontSize}
          onChange={topFontChange}
        />
        <MetricField
          label="字距"
          value={config.topSpacing}
          min={-0.5}
          max={3}
          step={0.05}
          unit="mm"
          onChange={(value) => onChange({ topSpacing: value })}
        />
      </Section>

      <Section title="中间">
        <Form.Item>
          <Input
            aria-label="中间文字"
            value={config.center}
            maxLength={18}
            placeholder="例如：合同专用章"
            onChange={(event) => onChange({ center: event.target.value })}
          />
        </Form.Item>
        <MetricField
          label="字号"
          value={config.centerFontSize}
          min={0.8}
          max={14}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ centerFontSize: value })}
        />
        <MetricField
          label="上下位置"
          value={config.centerOffsetY}
          min={-8}
          max={8}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ centerOffsetY: value })}
        />
        <MetricField
          label="字距"
          value={config.centerSpacing}
          min={-0.5}
          max={3}
          step={0.05}
          unit="mm"
          onChange={(value) => onChange({ centerSpacing: value })}
        />
      </Section>

      <Section title="下弧">
        <Form.Item>
          <Input
            aria-label="下弧文字"
            value={config.bottom}
            maxLength={24}
            placeholder="可选"
            onChange={(event) => onChange({ bottom: event.target.value })}
          />
        </Form.Item>
        <MetricField
          label="文字距边框"
          value={config.bottomInset}
          min={0}
          max={10}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ bottomInset: value })}
        />
        <MetricField
          label="弧跨度"
          value={config.bottomArcSpan}
          min={60}
          max={300}
          step={1}
          unit="°"
          precision={0}
          onChange={(value) => onChange({ bottomArcSpan: value })}
        />
        <FontSizeField
          label="字号"
          config={{
            fontSizeMode: config.bottomFontSizeMode,
            fontSize: config.bottomFontSize,
          }}
          autoSize={layout.bottom.autoFontSize}
          onChange={bottomFontChange}
        />
        <MetricField
          label="字距"
          value={config.bottomSpacing}
          min={-0.5}
          max={3}
          step={0.05}
          unit="mm"
          onChange={(value) => onChange({ bottomSpacing: value })}
        />
      </Section>

      <Section title="编号">
        <Form.Item>
          <Input
            aria-label="编号"
            value={config.number}
            maxLength={24}
            placeholder="可选"
            onChange={(event) => onChange({ number: event.target.value })}
          />
        </Form.Item>
        <MetricField
          label="字号"
          value={config.numberSize}
          min={0.6}
          max={8}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ numberSize: value })}
        />
        <MetricField
          label="上下位置"
          value={config.numberOffset}
          min={0}
          max={22}
          step={0.5}
          unit="mm"
          precision={1}
          onChange={(value) => onChange({ numberOffset: value })}
        />
        <MetricField
          label="字距"
          value={config.numberSpacing}
          min={0}
          max={3}
          step={0.05}
          unit="mm"
          onChange={(value) => onChange({ numberSpacing: value })}
        />
      </Section>

      <Section title="整体">
        <Form.Item label="预设尺寸">
          <Select
            value={sizeValue}
            options={[
              ...OVAL_SIZES.map((size) => ({
                value: `${size.width}x${size.height}`,
                label: `${size.width} × ${size.height} mm`,
              })),
              { value: "custom", label: "自定义", disabled: true },
            ]}
            onChange={(value) => {
              const next = OVAL_SIZES.find(
                (size) => `${size.width}x${size.height}` === value,
              );
              if (next) onChange({ width: next.width, height: next.height });
            }}
          />
        </Form.Item>
        <MetricField
          label="宽度"
          value={config.width}
          min={20}
          max={80}
          step={0.5}
          unit="mm"
          precision={1}
          onChange={(value) => onChange({ width: value })}
        />
        <MetricField
          label="高度"
          value={config.height}
          min={15}
          max={60}
          step={0.5}
          unit="mm"
          precision={1}
          onChange={(value) => onChange({ height: value })}
        />
        <MetricField
          label="边框粗细"
          value={config.border}
          min={0.2}
          max={4}
          step={0.1}
          unit="mm"
          onChange={(value) => onChange({ border: value })}
        />
        <MetricField
          label="做旧程度"
          value={config.aging}
          min={0}
          max={100}
          step={1}
          unit="%"
          precision={0}
          onChange={(value) => onChange({ aging: value })}
          tip="用不规则的泛白模拟印泥磨损，0 为关闭。"
        />
        <Form.Item label="字体">
          <FontSelect
            ids={OFFICIAL_FONT_IDS}
            value={config.fontId}
            onChange={(fontId) => onChange({ fontId })}
          />
        </Form.Item>
        <MetricField
          label="字体粗细"
          value={config.fontWeight}
          min={300}
          max={800}
          step={100}
          unit=""
          precision={0}
          onChange={(value) => onChange({ fontWeight: value })}
        />
        <Form.Item label="印章颜色">
          <ColorField
            value={config.color}
            onChange={(color) => onChange({ color })}
          />
        </Form.Item>
      </Section>

      <ResetFooter onReset={onReset} />
    </Form>
  );
}

function InkColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ColorPicker
      value={value}
      onChangeComplete={(color) => onChange(color.toHexString())}
      showText
      presets={[
        {
          label: "常用墨色",
          colors: ["#1C1D20", "#1E3A5F", "#334155"],
        },
      ]}
    />
  );
}

export function SignatureControls({
  signature,
}: {
  signature: SignaturePad;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Form layout="vertical" requiredMark={false} className="seal-form">
      <Segmented
        block
        className="signature-source-switch"
        value={signature.source}
        options={[
          {
            value: "draw",
            label: (
              <span className="signature-source-option">
                <PenTool size={14} strokeWidth={1.7} aria-hidden="true" />
                手写
              </span>
            ),
          },
          {
            value: "image",
            label: (
              <span className="signature-source-option">
                <ImagePlus size={14} strokeWidth={1.7} aria-hidden="true" />
                上传图片
              </span>
            ),
          },
        ]}
        onChange={(value) => signature.setSource(value as SignatureSource)}
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        className="visually-hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void signature.loadImage(file);
          event.target.value = "";
        }}
      />

      {signature.source === "draw" ? (
        <Section title="笔迹">
          <MetricField
            label="笔宽"
            value={signature.penWidth}
            min={1.5}
            max={6}
            step={0.1}
            unit=""
            precision={1}
            onChange={signature.setPenWidth}
          />
          <MetricField
            label="平滑"
            value={signature.smoothing}
            min={0}
            max={100}
            step={1}
            unit="%"
            precision={0}
            onChange={signature.setSmoothing}
          />
          <Form.Item label="墨色">
            <InkColorPicker
              value={signature.color}
              onChange={signature.setColor}
            />
          </Form.Item>
          <div className="signature-actions">
            <Button
              icon={<Undo2 size={15} strokeWidth={1.7} />}
              disabled={!signature.canUndo}
              onClick={signature.undo}
            >
              撤销
            </Button>
            <Button
              icon={<Redo2 size={15} strokeWidth={1.7} />}
              disabled={!signature.canRedo}
              onClick={signature.redo}
            >
              重做
            </Button>
            <Popconfirm
              title="清空当前签名？"
              okText="清空"
              cancelText="取消"
              disabled={!signature.hasInk}
              onConfirm={signature.clear}
            >
              <Button
                icon={<Eraser size={15} strokeWidth={1.7} />}
                disabled={!signature.hasInk}
              >
                清空
              </Button>
            </Popconfirm>
          </div>
        </Section>
      ) : (
        <Section title="签名图片">
          <div className="signature-image-picker">
            <Button
              icon={<ImagePlus size={15} strokeWidth={1.7} />}
              onClick={() => inputRef.current?.click()}
            >
              {signature.imageInfo ? "更换图片" : "选择签名图片"}
            </Button>
            {signature.imageInfo && (
              <Popconfirm
                title="移除签名图片？"
                okText="移除"
                cancelText="取消"
                onConfirm={signature.removeImage}
              >
                <Button icon={<Trash2 size={15} strokeWidth={1.7} />}>
                  移除
                </Button>
              </Popconfirm>
            )}
          </div>

          {signature.imageInfo && (
            <div className="signature-image-meta">
              <span
                className="signature-image-name"
                title={signature.imageInfo.name}
              >
                {signature.imageInfo.name}
              </span>
            </div>
          )}

          {signature.imageError && (
            <p className="signature-image-error">{signature.imageError}</p>
          )}

          {!signature.imageHasAlpha && (
            <>
              <MetricField
                label="去底阈值"
                value={signature.threshold}
                min={2}
                max={60}
                step={1}
                unit="%"
                precision={0}
                onChange={signature.setThreshold}
              />
              <MetricField
                label="边缘羽化"
                value={signature.softness}
                min={0}
                max={40}
                step={1}
                unit="%"
                precision={0}
                onChange={signature.setSoftness}
              />
            </>
          )}
          <Form.Item label="墨色处理">
            <Segmented
              block
              size="small"
              value={signature.inkMode}
              options={[
                { value: "original", label: "保留原色" },
                { value: "solid", label: "统一墨色" },
              ]}
              onChange={(value) =>
                signature.setInkMode(value as SignatureInkMode)
              }
            />
          </Form.Item>
          {signature.inkMode === "solid" && (
            <Form.Item label="墨色">
              <InkColorPicker
                value={signature.color}
                onChange={signature.setColor}
              />
            </Form.Item>
          )}
        </Section>
      )}

      <Section title="导出">
        <MetricField
          label="裁切留白"
          value={signature.cropPadding}
          min={1}
          max={8}
          step={0.5}
          unit="mm"
          precision={1}
          onChange={signature.setCropPadding}
        />
      </Section>
    </Form>
  );
}