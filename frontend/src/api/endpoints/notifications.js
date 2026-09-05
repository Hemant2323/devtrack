import { api } from "../client";

export const notificationsApi = {
  /** Returns { unread_count, notifications: [...] }. */
  list: (options) => api.get("/notifications", options),
  markRead: (ids) => api.post("/notifications/read", { ids }),
};
