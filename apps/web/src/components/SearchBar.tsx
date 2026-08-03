import { Button } from "@ticket-radar/ui";
import { useState, type FormEvent } from "react";

export function SearchBar({
  initialValue = "",
  onSearch,
  compact = false,
}: {
  initialValue?: string;
  onSearch: (query: string) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState(initialValue);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(query.trim());
  }

  return (
    <form
      className={`search-bar${compact ? " search-bar--compact" : ""}`}
      role="search"
      onSubmit={handleSubmit}
    >
      <label htmlFor={compact ? "compact-search" : "home-search"}>
        搜尋歌手、活動或場館
      </label>
      <div className="search-bar__row">
        <span aria-hidden="true" className="search-bar__icon">
          ⌕
        </span>
        <input
          id={compact ? "compact-search" : "home-search"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={100}
          placeholder="試試 Night Orbit、台北市…"
          autoComplete="off"
        />
        <Button type="submit">啟動雷達</Button>
      </div>
    </form>
  );
}
