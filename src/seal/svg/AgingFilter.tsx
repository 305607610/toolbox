import { agingFilterParams } from "../aging";

export function AgingFilter({
  id,
  amount,
}: {
  id: string;
  amount: number;
}) {
  const params = agingFilterParams(amount);
  if (!params) return null;

  return (
    <filter
      id={id}
      x="-8%"
      y="-8%"
      width="116%"
      height="116%"
      colorInterpolationFilters="sRGB"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency={params.frequency}
        numOctaves={params.octaves}
        seed={params.seed}
        result="aging-noise"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="aging-noise"
        scale={params.displacement}
        xChannelSelector="R"
        yChannelSelector="G"
        result="aging-worn"
      />
      <feColorMatrix
        in="aging-noise"
        type="matrix"
        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0"
        result="aging-alpha"
      />
      <feComponentTransfer in="aging-alpha" result="aging-mask">
        <feFuncA
          type="linear"
          slope={Number(params.slope.toFixed(4))}
          intercept={Number(params.intercept.toFixed(4))}
        />
      </feComponentTransfer>
      <feComposite
        in="aging-worn"
        in2="aging-mask"
        operator="in"
        result="aging-result"
      />
    </filter>
  );
}