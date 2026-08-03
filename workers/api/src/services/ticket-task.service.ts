import type {
  ReminderInput,
  TicketTaskInput,
  TicketTaskUpdate,
} from "@ticket-radar/shared";
import type { D1TicketTaskRepository } from "../repositories/ticket-task.repository";

export class TicketTaskService {
  constructor(private readonly repository: D1TicketTaskRepository) {}
  listTasks(userId: string) {
    return this.repository.listTasks(userId);
  }
  createTask(userId: string, input: TicketTaskInput) {
    return this.repository.createTask(userId, input);
  }
  updateTask(taskId: string, userId: string, input: TicketTaskUpdate) {
    return this.repository.updateTask(taskId, userId, input);
  }
  setChecklistItem(taskId: string, itemId: string, userId: string, completed: boolean) {
    return this.repository.setChecklistItem(taskId, itemId, userId, completed);
  }
  listReminders(userId: string) {
    return this.repository.listReminders(userId);
  }
  createReminder(userId: string, input: ReminderInput) {
    return this.repository.createReminder(userId, input);
  }
}
