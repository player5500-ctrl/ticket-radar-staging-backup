import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  it("只在使用者送出後傳回已整理的查詢字串", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);

    await user.type(screen.getByLabelText("搜尋歌手、活動或場館"), "  Night Orbit  ");
    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "啟動雷達" }));
    expect(onSearch).toHaveBeenCalledWith("Night Orbit");
  });
});
