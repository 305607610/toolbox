import { useEffect, useState } from "react";
import {
  displayTextFor,
  FONT_META,
  loadFont,
  missingGlyphs,
  type FontId,
} from "./fonts";

export interface PersonalFontState {
  display: string;
  missing: string[];
  loading: boolean;
  error: boolean;
}

export function usePersonalFont(
  text: string,
  fontId: FontId,
  enabled = true,
): PersonalFontState {
  const [state, setState] = useState<PersonalFontState>(() => ({
    display: text,
    missing: [],
    loading: enabled && Boolean(FONT_META[fontId]?.bundled),
    error: false,
  }));

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setState({
        display: text,
        missing: [],
        loading: false,
        error: false,
      });
      return () => {
        cancelled = true;
      };
    }

    setState((previous) => ({
      ...previous,
      loading: true,
      error: false,
    }));

    const run = async () => {
      try {
        const display = await displayTextFor(fontId, text);
        const missing = missingGlyphs(fontId, display);
        const loaded = await loadFont(fontId);
        if (!cancelled) {
          setState({
            display,
            missing,
            loading: false,
            error: !loaded,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            display: text,
            missing: [],
            loading: false,
            error: true,
          });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [text, fontId, enabled]);

  return state;
}