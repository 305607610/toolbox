import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Titlebar from "./Titlebar";
import { SearchProvider } from "../context/SearchContext";
import type { Theme } from "../hooks/useThemePreference";

interface AppShellProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export default function AppShell({ theme, onToggleTheme }: AppShellProps) {
  return (
    <SearchProvider>
      <div className="app">
        <Titlebar theme={theme} onToggleTheme={onToggleTheme} />
        <div className="app-body">
          <Sidebar />
          <main className="app-main">
            <Outlet />
          </main>
        </div>
      </div>
    </SearchProvider>
  );
}