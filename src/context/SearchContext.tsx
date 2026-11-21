import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface SearchContextValue {
  query: string;
  setQuery: (value: string) => void;
  clearQuery: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQueryState] = useState("");
  const setQuery = useCallback((value: string) => setQueryState(value), []);
  const clearQuery = useCallback(() => setQueryState(""), []);
  const value = useMemo(
    () => ({ query, setQuery, clearQuery }),
    [query, setQuery, clearQuery],
  );

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

export function useSearchQuery() {
  const value = useContext(SearchContext);
  if (!value) {
    throw new Error("useSearchQuery must be used within SearchProvider");
  }
  return value;
}