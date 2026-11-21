import { useEffect, useRef } from "react";
import { Button, Input } from "antd";
import type { InputRef } from "antd";
import { Search, SearchX, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ToolCard from "../components/ToolCard";
import { useSearchQuery } from "../context/SearchContext";
import { tools, type Tool, type ToolGroupId } from "../tools";

const matches = (tool: Tool, query: string) => {
  const haystack = [tool.name, tool.description, ...tool.tags]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
};

export default function Home() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { query, setQuery } = useSearchQuery();
  const searchRef = useRef<InputRef>(null);

  const groupParam = searchParams.get("group");
  const activeGroup: ToolGroupId | "all" =
    groupParam === "documents" || groupParam === "images" ? groupParam : "all";
  const trimmed = query.trim();
  const groupTools =
    activeGroup === "all"
      ? tools
      : tools.filter((tool) => tool.groupId === activeGroup);
  const results = trimmed
    ? tools.filter((tool) => matches(tool, trimmed))
    : groupTools;

  const count = trimmed
    ? `${results.length} 个搜索结果`
    : `${results.length} 个工具`;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openFirstResult = () => {
    if (results[0]) navigate(`/tool/${results[0].id}`);
  };

  return (
    <div className="home">
      <div className="home-toolbar">
        <Input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onPressEnter={openFirstResult}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              if (query) setQuery("");
              else event.currentTarget.blur();
            }
          }}
          allowClear={{
            clearIcon: (
              <X size={14} strokeWidth={1.8} aria-hidden="true" />
            ),
          }}
          placeholder="搜索工具"
          aria-label="搜索工具"
          className="tool-search"
          prefix={
            <Search
              size={15}
              strokeWidth={1.8}
              className="search-icon"
              aria-hidden="true"
            />
          }
        />
        <span className="home-count" aria-live="polite">
          {count}
        </span>
      </div>

      {results.length > 0 ? (
        <div className="tool-grid">
          {results.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <SearchX size={20} strokeWidth={1.7} />
          </span>
          <h2>{trimmed ? "没有找到工具" : "这个分组还没有工具"}</h2>
          <p>
            {trimmed
              ? "换个关键词试试，比如“印章”或“压缩”。"
              : "工具会随着版本继续加入。"}
          </p>
          {trimmed ? (
            <Button onClick={() => setQuery("")}>清除搜索</Button>
          ) : (
            <Button onClick={() => navigate("/")}>查看全部工具</Button>
          )}
        </div>
      )}
    </div>
  );
}