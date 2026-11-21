import { useEffect } from "react";
import { Button, Tag } from "antd";
import { ArrowLeft, Info } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getGroup, getTool } from "../tools";

export default function ToolPage() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const tool = getTool(toolId);

  const goBack = () => {
    navigate(from && from.startsWith("/") ? from : "/");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        navigate(from && from.startsWith("/") ? from : "/");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, from]);

  if (!tool) {
    return (
      <div className="tool-page">
        <Button
          type="text"
          className="back-btn"
          icon={<ArrowLeft size={16} strokeWidth={1.8} />}
          onClick={goBack}
        >
          返回工作台
        </Button>
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <Info size={20} strokeWidth={1.7} />
          </span>
          <h2>没有找到这个工具</h2>
          <p>它可能已经被移除，或者链接不完整。</p>
          <Button onClick={goBack}>返回工作台</Button>
        </div>
      </div>
    );
  }

  const Icon = tool.icon;
  const group = getGroup(tool.groupId);

  return (
    <div className="tool-page">
      <Button
        type="text"
        className="back-btn"
        icon={<ArrowLeft size={16} strokeWidth={1.8} />}
        onClick={goBack}
      >
        返回工作台
      </Button>

      <header className="tool-head">
        <span className="tool-icon" aria-hidden="true">
          <Icon size={26} strokeWidth={1.6} />
        </span>
        <div className="tool-head-text">
          <h1>{tool.name}</h1>
          <p className="tool-sub">{tool.description}</p>
          <div className="tool-meta">
            <Tag className="tool-tag">{group?.label}</Tag>
            {tool.tags.map((tag) => (
              <Tag key={tag} className="tool-tag">
                {tag}
              </Tag>
            ))}
          </div>
        </div>
      </header>

      <div className="info-strip" role="status">
        <Info size={16} strokeWidth={1.8} aria-hidden="true" />
        <p>此工具将在下一阶段接入，当前先保留入口。</p>
      </div>

      <section className="plan-section" aria-labelledby="plan-title">
        <h2 id="plan-title">计划中的步骤</h2>
        <ol className="plan-list">
          {tool.planned.map((step, index) => (
            <li className="plan-step" key={step}>
              <span className="plan-num" aria-hidden="true">
                {index + 1}
              </span>
              <span className="plan-label">{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}