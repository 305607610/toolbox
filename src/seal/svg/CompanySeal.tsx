import { forwardRef, useId } from "react";
import type { OfficialConfig } from "../types";
import {
  bottomArcPathSpan,
  clamp,
  round,
  starPointsString,
  topArcPathSpan,
} from "../geometry";
import { measureSpacedTextMm } from "../measure";
import { fontFamily } from "../fonts";

export interface CompanyFit {
  fontSizeMm: number;
  autoFontSize: number;
  fitted: boolean;
  overflow: boolean;
  arcLength: number;
  radius: number;
  textWidth: number;
}

export interface CompanyLineFit {
  fontSizeMm: number;
  overflow: boolean;
  width: number;
  maxWidth: number;
}

export interface CompanyLayout {
  fit: CompanyFit;
  bottom: CompanyLineFit;
  number: CompanyLineFit;
  arcPath: string;
  star: {
    centerX: number;
    centerY: number;
    outer: number;
    inner: number;
  };
  bottomY: number;
  numberY: number;
  numberLayout: "arc" | "line";
  numberPath?: string;
  numberRadius?: number;
  warnings: string[];
}

export function companyLayout(config: OfficialConfig): CompanyLayout {
  const diameter = config.diameter;
  const radius = diameter / 2;
  const border = clamp(config.border, 0.2, 4);
  const inset = clamp(config.textInset, 0, 12);
  const span = clamp(config.arcSpan, 60, 320);
  const spacing = clamp(config.letterSpacing, -1, 4);
  const family = fontFamily(config.fontId);
  const text = config.company.trim();
  const spanRad = (span * Math.PI) / 180;

  const maxFont = round(Math.min(7, diameter * 0.16), 2);
  const minFont = 2;
  const radiusFor = (size: number) => radius - border - inset - size * 0.85;
  const arcLengthFor = (size: number) =>
    Math.max(0, radiusFor(size)) * spanRad;
  const widthFor = (size: number) =>
    text ? measureSpacedTextMm(text, size, family, 500, spacing) : 0;

  let autoFontSize = maxFont;
  if (text) {
    for (let index = 0; index < 80; index += 1) {
      if (widthFor(autoFontSize) * 1.06 <= arcLengthFor(autoFontSize)) {
        break;
      }
      autoFontSize = round(autoFontSize - 0.1, 2);
      if (autoFontSize <= minFont) {
        autoFontSize = minFont;
        break;
      }
    }
  }

  const usedSize =
    config.fontSizeMode === "auto"
      ? autoFontSize
      : clamp(config.fontSize, 0.5, 20);
  const usedRadius = Math.max(0.5, radiusFor(usedSize));
  const arcLength = usedRadius * spanRad;
  const textWidth = widthFor(usedSize);
  const overflow = Boolean(text) && textWidth * 1.06 > arcLength;

  const fit: CompanyFit = {
    fontSizeMm: usedSize,
    autoFontSize,
    fitted: !overflow,
    overflow,
    arcLength,
    radius: usedRadius,
    textWidth,
  };

  const bottomText = config.typeLabel.trim();
  const bottomSize = clamp(config.bottomSize, 1, 12);
  const bottomMaxWidth = diameter - 2 * (border + 1.5);
  const bottomWidth = bottomText
    ? measureSpacedTextMm(
        bottomText,
        bottomSize,
        family,
        500,
        config.bottomSpacing,
      )
    : 0;
  const bottomY = radius + config.bottomOffset;
  const bottomOverflow =
    Boolean(bottomText) &&
    (bottomWidth > bottomMaxWidth ||
      bottomY + bottomSize * 0.2 > diameter - border - 0.1);
  const bottom: CompanyLineFit = {
    fontSizeMm: bottomSize,
    overflow: bottomOverflow,
    width: bottomWidth,
    maxWidth: bottomMaxWidth,
  };

  const numberText = config.number.trim();
  const numberLayout = config.numberLayout;
  const numberSize = clamp(config.numberSize, 0.8, 8);
  const numberMaxWidth = diameter - 2 * (border + 1.2);
  const numberWidth = numberText
    ? measureSpacedTextMm(
        numberText,
        numberSize,
        family,
        400,
        config.numberSpacing,
      )
    : 0;
  const numberY = radius + config.numberOffset;
  const numberInset = clamp(config.numberInset, 0, 8);
  const numberArcSpan = clamp(config.numberArcSpan, 40, 180);
  const numberRadius = radius - border - numberInset;
  const numberArcLength =
    numberRadius > 0.5
      ? numberRadius * ((numberArcSpan * Math.PI) / 180)
      : 0;
  const numberPath =
    numberLayout === "arc"
      ? bottomArcPathSpan(
          radius,
          radius,
          Math.max(0.5, numberRadius),
          Math.max(0.5, numberRadius),
          numberArcSpan,
        )
      : undefined;
  const numberOverflow =
    Boolean(numberText) &&
    (numberLayout === "arc"
      ? numberRadius <= 0.5 || numberWidth * 1.06 > numberArcLength
      : numberWidth > numberMaxWidth ||
        numberY + numberSize * 0.2 > diameter - border - 0.2);
  const number: CompanyLineFit = {
    fontSizeMm: numberSize,
    overflow: numberOverflow,
    width: numberWidth,
    maxWidth: numberMaxWidth,
  };

  const starSize = clamp(config.starSize, 2, diameter * 0.6);
  const starOuter = starSize / 2;
  const starInner = starOuter * 0.382;
  const starCenterY = radius + config.starOffsetY;
  const star = {
    centerX: radius,
    centerY: starCenterY,
    outer: starOuter,
    inner: starInner,
  };

  const warnings: string[] = [];
  if (overflow) {
    warnings.push("单位名称超出弧长：请减小字号、加大弧跨度或减小文字距边框。");
  }
  if (bottomOverflow) warnings.push("底部文字过宽或贴近边框。");
  if (numberOverflow) {
    warnings.push(
      numberLayout === "arc"
        ? "编号超出下弧：请减小字号、加大弧跨度或减小距边框。"
        : "编号过宽或贴近边框。",
    );
  }

  if (config.star) {
    const textInnerY = radius - usedRadius;
    const starTopY = starCenterY - starOuter;
    if (text && starTopY < textInnerY + 0.6) {
      warnings.push("五角星与上弧文字过近。");
    }
    if (
      bottomText &&
      starCenterY + starOuter > bottomY - bottomSize * 0.85 - 0.6
    ) {
      warnings.push("五角星与底部文字过近。");
    }
    if (
      starCenterY - starOuter < border + 0.4 ||
      starCenterY + starOuter > diameter - border - 0.4
    ) {
      warnings.push("五角星超出边框。");
    }
  }
  if (bottomText && numberText) {
    const numberInnerY =
      numberLayout === "arc"
        ? radius + numberRadius - numberSize * 0.85
        : numberY - numberSize * 0.85;
    if (bottomY + bottomSize * 0.2 > numberInnerY - 0.5) {
      warnings.push("底部文字与编号过近。");
    }
  }

  return {
    fit,
    bottom,
    number,
    arcPath: topArcPathSpan(
      radius,
      radius,
      usedRadius,
      usedRadius,
      span,
    ),
    star,
    bottomY,
    numberY,
    numberLayout,
    numberPath,
    numberRadius,
    warnings,
  };
}

export const CompanySeal = forwardRef<SVGSVGElement, { config: OfficialConfig }>(
  function CompanySeal({ config }, ref) {
    const rawId = useId();
    const arcId = `company-arc-${rawId.replace(/:/g, "")}`;
    const numberArcId = `company-number-arc-${rawId.replace(/:/g, "")}`;
    const { diameter, color, border, star, company, typeLabel, number } =
      config;
    const radius = diameter / 2;
    const layout = companyLayout(config);
    const family = fontFamily(config.fontId);
    const label = company.trim();

    return (
      <svg
        ref={ref}
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
        role="img"
        aria-label={`公章预览：${label || "未填写单位名称"}`}
      >
        <defs>
          <path id={arcId} d={layout.arcPath} fill="none" />
          {layout.numberPath && (
            <path id={numberArcId} d={layout.numberPath} fill="none" />
          )}
        </defs>

        <circle
          cx={radius}
          cy={radius}
          r={radius - border / 2}
          fill="none"
          stroke={color}
          strokeWidth={border}
        />

        {star && (
          <polygon
            points={starPointsString(
              layout.star.centerX,
              layout.star.centerY,
              layout.star.outer,
              layout.star.inner,
            )}
            fill={color}
          />
        )}

        {label && (
          <text fill={color} fontFamily={family} fontWeight={500}>
            <textPath
              href={`#${arcId}`}
              startOffset="50%"
              textAnchor="middle"
              fontSize={layout.fit.fontSizeMm}
              letterSpacing={config.letterSpacing}
            >
              {label}
            </textPath>
          </text>
        )}

        {typeLabel.trim() && (
          <text
            x={radius}
            y={layout.bottomY}
            fill={color}
            fontFamily={family}
            fontSize={layout.bottom.fontSizeMm}
            fontWeight={500}
            letterSpacing={config.bottomSpacing}
            textAnchor="middle"
          >
            {typeLabel.trim()}
          </text>
        )}

        {number.trim() && layout.numberLayout === "arc" && (
          <text
            fill={color}
            fontFamily={family}
            fontSize={layout.number.fontSizeMm}
            letterSpacing={config.numberSpacing}
          >
            <textPath
              href={`#${numberArcId}`}
              startOffset="50%"
              textAnchor="middle"
            >
              {number.trim()}
            </textPath>
          </text>
        )}

        {number.trim() && layout.numberLayout === "line" && (
          <text
            x={radius}
            y={layout.numberY}
            fill={color}
            fontFamily={family}
            fontSize={layout.number.fontSizeMm}
            letterSpacing={config.numberSpacing}
            textAnchor="middle"
          >
            {number.trim()}
          </text>
        )}
      </svg>
    );
  },
);