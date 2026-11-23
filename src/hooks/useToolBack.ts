import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Returns to the workbench, honoring the page the tool was opened from. */
export function useToolBack() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return useCallback(() => {
    navigate(from && from.startsWith("/") ? from : "/");
  }, [from, navigate]);
}