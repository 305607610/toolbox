import { Tag } from "antd";
import { ArrowUpRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { getGroup, type Tool } from "../tools";

interface ToolCardProps {
  tool: Tool;
}

export default function ToolCard({ tool }: ToolCardProps) {
  const Icon = tool.icon;
  const group = getGroup(tool.groupId);
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;

  return (
    <Link
      to={`/tool/${tool.id}`}
      state={{ from }}
      className="tool-card"
      aria-label={`打开${tool.name}`}
    >
      <div className="tool-card-top">
        <span className="tool-icon" aria-hidden="true">
          <Icon size={21} strokeWidth={1.7} />
        </span>
        <span className="tool-group">{group?.label}</span>
      </div>

      <h2>{tool.name}</h2>
      <p>{tool.description}</p>

      <div className="tool-card-foot">
        <div className="tool-tags">
          {tool.tags.map((tag) => (
            <Tag key={tag} className="tool-tag">
              {tag}
            </Tag>
          ))}
        </div>
        <span className="tool-open">
          打开
          <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}