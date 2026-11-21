import { useEffect, useState } from "react";
import { Button, Tooltip } from "antd";
import { Copy, Minus, Moon, Square, Sun, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Theme } from "../hooks/useThemePreference";

interface TitlebarProps {
  theme: Theme;
  onToggleTheme: () => void;
}

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export default function Titlebar({ theme, onToggleTheme }: TitlebarProps) {
  const [maximized, setMaximized] = useState(false);
  const isDark = theme === "dark";

  useEffect(() => {
    if (!isTauri()) return;

    const win = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    win.isMaximized().then((value) => {
      if (!disposed) setMaximized(value);
    });

    win
      .onResized(() => {
        win.isMaximized().then((value) => {
          if (!disposed) setMaximized(value);
        });
      })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const withWindow = (action: (win: ReturnType<typeof getCurrentWindow>) => void) => {
    if (!isTauri()) return;
    action(getCurrentWindow());
  };

  return (
    <header
      className="titlebar"
      data-tauri-drag-region
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest(".titlebar-actions")) return;
        withWindow((win) => win.toggleMaximize());
      }}
    >
      <div className="titlebar-brand" data-tauri-drag-region>
        <img className="brand-mark" src="/app.png" alt="" aria-hidden="true" />
        <span className="brand-name">叮当</span>
      </div>

      <div className="titlebar-actions">
        <Tooltip title={isDark ? "切换到浅色模式" : "切换到深色模式"} placement="bottom">
          <Button
            type="text"
            className="theme-toggle"
            aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
            aria-pressed={isDark}
            onClick={onToggleTheme}
            icon={
              isDark ? (
                <Sun size={16} strokeWidth={1.7} />
              ) : (
                <Moon size={16} strokeWidth={1.7} />
              )
            }
          />
        </Tooltip>

        <span className="titlebar-divider" aria-hidden="true" />

        <Button
          type="text"
          className="win-btn"
          aria-label="最小化"
          onClick={() => withWindow((win) => win.minimize())}
          icon={<Minus size={15} strokeWidth={1.7} />}
        />
        <Button
          type="text"
          className="win-btn"
          aria-label={maximized ? "还原" : "最大化"}
          onClick={() => withWindow((win) => win.toggleMaximize())}
          icon={
            maximized ? (
              <Copy size={12.5} strokeWidth={1.7} />
            ) : (
              <Square size={12.5} strokeWidth={1.7} />
            )
          }
        />
        <Button
          type="text"
          className="win-btn win-close"
          aria-label="关闭"
          onClick={() => withWindow((win) => win.close())}
          icon={<X size={16} strokeWidth={1.7} />}
        />
      </div>
    </header>
  );
}