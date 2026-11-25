import { forwardRef, useId } from "react";
import type { OvalConfig } from "../types";
import {
  bottomArcLengthSpan,
  bottomArcPathSpan,
  clamp,
  round,
  topArcLengthSpan,
  topArcPathSpan,
} from "../geometry";
import { measureSpacedTextMm } from "../measure";
import { fontFamily } from "../fonts";
import { agingStrength } from "../aging";
import { AgingFilter } from "./AgingFilter";

export interface OvalArcFit {
  fontSizeMm: number;
  autoFontSize: number;
  fitted: boolean;
  overflow: boolean;
  arcLength: number;
  width: number;
  rx: number;
  ry: number;
}

export interface OvalLineFit {
  fontSizeMm: number;
  overflow: boolean;
  width: number;
  maxWidth: number;
}

export interface OvalLayout {
  top: OvalArcFit;
  center: OvalLineFit;
  bottom: OvalArcFit;
  number: OvalLineFit;
  topPath: string;
  bottomPath: string;
  topRx: number;
  topRy: number;
  bottomRx: number;
  bottomRy: number;
  centerY: number;
  numberY: number;
  warnings: string[];
}

export function ovalLayout(config: OvalConfig): OvalLayout {
  const { width, height, border } = config;
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const borderMm = clamp(border, 0.2, 4);
  const family = fontFamily(config.fontId);

  const topInset = clamp(config.topInset, 0, 10);
  const topSpan = clamp(config.topArcSpan, 60, 300);
  const topSpacing = clamp(config.topSpacing, -1, 4);
  const topText = config.top.trim();
  const topMax = round(Math.min(5.6, height * 0.18), 2);
  const topMin = 1.8;
  const topRadiusFor = (size: number) => ({
    rx: rx - borderMm - topInset - size * 0.85,
    ry: ry - borderMm - topInset - size * 0.85,
  });
  const topLengthFor = (size: number) => {
    const radii = topRadiusFor(size);
    if (radii.rx <= 0.2 || radii.ry <= 0.2) return 0;
    return topArcLengthSpan(radii.rx, radii.ry, topSpan);
  };
  const topWidthFor = (size: number) =>
    topText
      ? measureSpacedTextMm(
          topText,
          size,
          family,
          config.fontWeight,
          topSpacing,
        )
      : 0;

  let topAuto = topMax;
  if (topText) {
    for (let index = 0; index < 90; index += 1) {
      if (topWidthFor(topAuto) * 1.06 <= topLengthFor(topAuto)) break;
      topAuto = round(topAuto - 0.1, 2);
      if (topAuto <= topMin) {
        topAuto = topMin;
        break;
      }
    }
  }

  const topUsed =
    config.topFontSizeMode === "auto"
      ? topAuto
      : clamp(config.topFontSize, 0.5, 18);
  const topRadii = topRadiusFor(topUsed);
  const topRx = Math.max(0.5, topRadii.rx);
  const topRy = Math.max(0.5, topRadii.ry);
  const topLength = topLengthFor(topUsed);
  const topWidth = topWidthFor(topUsed);
  const topOverflow =
    Boolean(topText) &&
    (topRadii.rx <= 0.2 ||
      topRadii.ry <= 0.2 ||
      topWidth * 1.06 > topLength);

  const top: OvalArcFit = {
    fontSizeMm: topUsed,
    autoFontSize: topAuto,
    fitted: !topOverflow,
    overflow: topOverflow,
    arcLength: topLength,
    width: topWidth,
    rx: topRx,
    ry: topRy,
  };

  const centerText = config.center.trim();
  const centerSize = clamp(config.centerFontSize, 0.8, 14);
  const centerSpacing = clamp(config.centerSpacing, -1, 4);
  const centerY = cy + config.centerOffsetY;
  const centerMaxWidth = Math.max(0, 2 * (rx - borderMm - 2));
  const centerWidth = centerText
    ? measureSpacedTextMm(
        centerText,
        centerSize,
        family,
        config.fontWeight,
        centerSpacing,
      )
    : 0;
  const centerOverflow =
    Boolean(centerText) &&
    (centerWidth > centerMaxWidth ||
      centerY + centerSize * 0.2 > cy + ry - borderMm - 0.2 ||
      centerY - centerSize * 0.85 < cy - ry + borderMm + 0.2);
  const center: OvalLineFit = {
    fontSizeMm: centerSize,
    overflow: centerOverflow,
    width: centerWidth,
    maxWidth: centerMaxWidth,
  };

  const bottomInset = clamp(config.bottomInset, 0, 10);
  const bottomSpan = clamp(config.bottomArcSpan, 60, 300);
  const bottomSpacing = clamp(config.bottomSpacing, -1, 4);
  const bottomText = config.bottom.trim();
  const bottomMax = round(Math.min(4.8, height * 0.16), 2);
  const bottomMin = 1.6;
  const bottomRadiusFor = (size: number) => ({
    rx: rx - borderMm - bottomInset - size * 0.15,
    ry: ry - borderMm - bottomInset - size * 0.15,
  });
  const bottomLengthFor = (size: number) => {
    const radii = bottomRadiusFor(size);
    if (radii.rx <= 0.2 || radii.ry <= 0.2) return 0;
    return bottomArcLengthSpan(radii.rx, radii.ry, bottomSpan);
  };
  const bottomWidthFor = (size: number) =>
    bottomText
      ? measureSpacedTextMm(
          bottomText,
          size,
          family,
          config.fontWeight,
          bottomSpacing,
        )
      : 0;

  let bottomAuto = bottomMax;
  if (bottomText) {
    for (let index = 0; index < 60; index += 1) {
      if (bottomWidthFor(bottomAuto) * 1.06 <= bottomLengthFor(bottomAuto)) {
        break;
      }
      bottomAuto = round(bottomAuto - 0.1, 2);
      if (bottomAuto <= bottomMin) {
        bottomAuto = bottomMin;
        break;
      }
    }
  }

  const bottomUsed =
    config.bottomFontSizeMode === "auto"
      ? bottomAuto
      : clamp(config.bottomFontSize, 0.5, 14);
  const bottomRadii = bottomRadiusFor(bottomUsed);
  const bottomRx = Math.max(0.5, bottomRadii.rx);
  const bottomRy = Math.max(0.5, bottomRadii.ry);
  const bottomLength = bottomLengthFor(bottomUsed);
  const bottomWidth = bottomWidthFor(bottomUsed);
  const bottomOverflow =
    Boolean(bottomText) &&
    (bottomRadii.rx <= 0.2 ||
      bottomRadii.ry <= 0.2 ||
      bottomWidth * 1.06 > bottomLength);

  const bottom: OvalArcFit = {
    fontSizeMm: bottomUsed,
    autoFontSize: bottomAuto,
    fitted: !bottomOverflow,
    overflow: bottomOverflow,
    arcLength: bottomLength,
    width: bottomWidth,
    rx: bottomRx,
    ry: bottomRy,
  };

  const numberText = config.number.trim();
  const numberSize = clamp(config.numberSize, 0.6, 8);
  const numberSpacing = clamp(config.numberSpacing, 0, 3);
  const numberMaxWidth = Math.max(0, 2 * (rx - borderMm - 1.2));
  const numberY = cy + config.numberOffset;
  const numberWidth = numberText
    ? measureSpacedTextMm(
        numberText,
        numberSize,
        family,
        config.fontWeight,
        numberSpacing,
      )
    : 0;
  const numberOverflow =
    Boolean(numberText) &&
    (numberWidth > numberMaxWidth ||
      numberY + numberSize * 0.2 > cy + ry - borderMm - 0.2);
  const number: OvalLineFit = {
    fontSizeMm: numberSize,
    overflow: numberOverflow,
    width: numberWidth,
    maxWidth: numberMaxWidth,
  };

  const warnings: string[] = [];
  if (topOverflow) {
    warnings.push("上弧文字超出弧长：请减小字号、加大弧跨度或减小上弧距边框。");
  }
  if (centerOverflow) warnings.push("中间文字过宽或贴近边框。");
  if (bottomOverflow) {
    warnings.push("下弧文字超出弧长：请减小字号、加大弧跨度或减小下弧距边框。");
  }
  if (numberOverflow) warnings.push("编号过宽或贴近边框。");
  if (
    topText &&
    centerText &&
    centerY - centerSize * 0.85 < cy - topRy + 0.6
  ) {
    warnings.push("中间文字与上弧文字过近。");
  }
  if (
    centerText &&
    numberText &&
    centerY + centerSize * 0.2 >
      numberY - numberSize * 0.85 - 0.5
  ) {
    warnings.push("中间文字与编号过近。");
  }
  if (
    centerText &&
    bottomText &&
    centerY + centerSize * 0.2 >
      cy + bottomRy - bottomUsed * 0.85 - 0.6
  ) {
    warnings.push("中间文字与下弧文字过近。");
  }
  if (bottomText && numberText) {
    const bottomInner = cy + bottomRy - bottomUsed * 0.85;
    const bottomOuter = cy + bottomRy;
    const numberTop = numberY - numberSize * 0.85;
    const numberBottom = numberY + numberSize * 0.2;
    if (numberTop < bottomOuter && numberBottom > bottomInner) {
      warnings.push("下弧文字与编号重叠，请上移编号或下移下弧文字。");
    }
  }

  return {
    top,
    center,
    bottom,
    number,
    topPath: topArcPathSpan(cx, cy, topRx, topRy, topSpan),
    bottomPath: bottomArcPathSpan(cx, cy, bottomRx, bottomRy, bottomSpan),
    topRx,
    topRy,
    bottomRx,
    bottomRy,
    centerY,
    numberY,
    warnings,
  };
}

export const OvalSeal = forwardRef<SVGSVGElement, { config: OvalConfig }>(
  function OvalSeal({ config }, ref) {
    const rawId = useId();
    const suffix = rawId.replace(/:/g, "");
    const topId = `oval-top-${suffix}`;
    const bottomId = `oval-bottom-${suffix}`;
    const agingId = `oval-aging-${suffix}`;
    const aged = agingStrength(config.aging) > 0;
    const { width, height, color, border } = config;
    const cx = width / 2;
    const cy = height / 2;
    const rx = width / 2;
    const ry = height / 2;
    const family = fontFamily(config.fontId);
    const layout = ovalLayout(config);

    return (
      <svg
        ref={ref}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`椭圆章预览：${config.top.trim() || "未填写单位名称"}`}
      >
        <defs>
          <path id={topId} d={layout.topPath} fill="none" />
          <path id={bottomId} d={layout.bottomPath} fill="none" />
          <AgingFilter id={agingId} amount={config.aging} />
        </defs>

        <g filter={aged ? `url(#${agingId})` : undefined}>
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx - border / 2}
            ry={ry - border / 2}
            fill="none"
            stroke={color}
            strokeWidth={border}
          />

          {config.top.trim() && (
            <text fill={color} fontFamily={family} fontWeight={config.fontWeight}>
              <textPath
                href={`#${topId}`}
                startOffset="50%"
                textAnchor="middle"
                fontSize={layout.top.fontSizeMm}
                letterSpacing={config.topSpacing}
              >
                {config.top.trim()}
              </textPath>
            </text>
          )}

          {config.center.trim() && (
            <text
              x={cx}
              y={layout.centerY}
              fill={color}
              fontFamily={family}
              fontSize={layout.center.fontSizeMm}
              fontWeight={config.fontWeight}
              letterSpacing={config.centerSpacing}
              textAnchor="middle"
            >
              {config.center.trim()}
            </text>
          )}

          {config.bottom.trim() && (
            <text fill={color} fontFamily={family} fontWeight={config.fontWeight}>
              <textPath
                href={`#${bottomId}`}
                startOffset="50%"
                textAnchor="middle"
                fontSize={layout.bottom.fontSizeMm}
                letterSpacing={config.bottomSpacing}
              >
                {config.bottom.trim()}
              </textPath>
            </text>
          )}

          {config.number.trim() && (
            <text
              x={cx}
              y={layout.numberY}
              fill={color}
              fontFamily={family}
              fontWeight={config.fontWeight}
              fontSize={layout.number.fontSizeMm}
              letterSpacing={config.numberSpacing}
              textAnchor="middle"
            >
              {config.number.trim()}
            </text>
          )}
        </g>
      </svg>
    );
  },
);