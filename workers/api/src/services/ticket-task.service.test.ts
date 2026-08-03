import { describe, expect, it, vi } from "vitest";

import { TicketTaskService } from "./ticket-task.service";

describe("TicketTaskService", () => {
  it("把建立任務交給 repository，保留使用者範圍", async () => {
    const repository = {
      createTask: vi.fn().mockResolvedValue({ id: "task-1" }),
    };
    const service = new TicketTaskService(repository as never);
    await expect(
      service.createTask("user-demo", {
        eventId: "event-demo",
        acceptableSessions: [],
        areaPreferences: [],
        notes: "",
      }),
    ).resolves.toEqual({ id: "task-1" });
    expect(repository.createTask).toHaveBeenCalledWith("user-demo", {
      eventId: "event-demo",
      acceptableSessions: [],
      areaPreferences: [],
      notes: "",
    });
  });

  it("更新清單時保留任務與使用者識別", async () => {
    const repository = {
      setChecklistItem: vi.fn().mockResolvedValue({ id: "task-1" }),
    };
    const service = new TicketTaskService(repository as never);
    await service.setChecklistItem("task-1", "item-1", "user-demo", true);
    expect(repository.setChecklistItem).toHaveBeenCalledWith(
      "task-1",
      "item-1",
      "user-demo",
      true,
    );
  });
});
