import { Tooltip } from "antd";
import { CircleHelp } from "lucide-react";

interface HelpTipProps {
  text: string;
  className?: string;
}

/**
 * A small help icon whose explanation only appears on hover or keyboard focus.
 * Use it for notes that would otherwise sit in the page as prose.
 */
export default function HelpTip({ text, className }: HelpTipProps) {
  return (
    <Tooltip title={text} placement="top" trigger={["hover", "focus"]}>
      <span
        className={`help-tip${className ? ` ${className}` : ""}`}
        role="img"
        aria-label={text}
        tabIndex={0}
        onClick={(event) => event.stopPropagation()}
      >
        <CircleHelp size={13} strokeWidth={1.9} aria-hidden="true" />
      </span>
    </Tooltip>
  );
}