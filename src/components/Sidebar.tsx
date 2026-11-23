import { useMemo } from "react";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import {
  Code2,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSearchQuery } from "../context/SearchContext";
import {
  getTool,
  isToolGroupId,
  toolGroups,
  tools,
  toolsInGroup,
  type ToolGroupId,
} from "../tools";

const groupIcons: Record<ToolGroupId, typeof FileText> = {
  documents: FileText,
  images: ImageIcon,
  dev: Code2,
};

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { query, clearQuery } = useSearchQuery();
  const onHome = location.pathname === "/";

  const activeKey = useMemo(() => {
    const toolId = location.pathname.startsWith("/tool/")
      ? location.pathname.split("/")[2]
      : undefined;
    const openTool = getTool(toolId);
    if (openTool) return openTool.groupId;
    if (query.trim()) return "all";
    const group = searchParams.get("group");
    return isToolGroupId(group) ? group : "all";
  }, [location.pathname, query, searchParams]);

  const items: MenuProps["items"] = [
    {
      key: "all",
      icon: <LayoutGrid size={17} strokeWidth={1.7} />,
      label: (
        <span className="nav-label">
          <span>全部工具</span>
          <span className="nav-count">{tools.length}</span>
        </span>
      ),
    },
    ...toolGroups.map((group) => {
      const Icon = groupIcons[group.id];
      return {
        key: group.id,
        icon: <Icon size={17} strokeWidth={1.7} />,
        label: (
          <span className="nav-label">
            <span>{group.label}</span>
            <span className="nav-count">{toolsInGroup(group.id).length}</span>
          </span>
        ),
      };
    }),
  ];

  const handleSelect: MenuProps["onClick"] = ({ key }) => {
    clearQuery();
    navigate(key === "all" ? "/" : `/?group=${key}`);
  };

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav" aria-label="工具分组">
        <Menu
          mode="inline"
          className="sidebar-menu"
          items={items}
          selectedKeys={[activeKey]}
          onClick={handleSelect}
        />
      </nav>

      <div className="sidebar-foot">
        {onHome ? (
          <span className="shortcut" aria-label="按下 Ctrl K 聚焦搜索">
            <kbd>Ctrl</kbd>
            <kbd>K</kbd>
            <span>搜索</span>
          </span>
        ) : (
          <span />
        )}
        <span className="version">v0.1.0</span>
      </div>
    </aside>
  );
}