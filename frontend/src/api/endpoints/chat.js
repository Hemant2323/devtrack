import { api } from "../client";

/** Shared by team chat and DM threads — both paginate the same way. */
function windowQuery({ limit, beforeId } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (beforeId) params.set("before_id", String(beforeId));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Project chat, team and direct.
 *
 * `before_id` is an id cursor scoped to these endpoints for loading older
 * history — deliberately not a general pagination framework. On a DM thread
 * the server keeps that cursor inside the conversation, so paging back can
 * never surface another pair's messages.
 *
 * Editing and deleting are shared: a message id already identifies its
 * conversation, so the same two calls serve both kinds and the server decides
 * what the caller may do with the message it finds.
 */
export const chatApi = {
  list: (pid, options_ = {}, options) =>
    api.get(`/projects/${pid}/chat${windowQuery(options_)}`, options),
  send: (pid, body) => api.post(`/projects/${pid}/chat`, { body }),

  /** Every other member of the project, conversations first. */
  listDmPartners: (pid, options) => api.get(`/projects/${pid}/chat/dm`, options),
  listDm: (pid, userId, options_ = {}, options) =>
    api.get(`/projects/${pid}/chat/dm/${userId}${windowQuery(options_)}`, options),
  sendDm: (pid, userId, body) => api.post(`/projects/${pid}/chat/dm/${userId}`, { body }),

  edit: (messageId, body) => api.patch(`/chat/${messageId}`, { body }),
  remove: (messageId) => api.delete(`/chat/${messageId}`),
};
