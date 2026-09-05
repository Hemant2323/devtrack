import { api } from "../client";

export const commentsApi = {
  list: (iid, options) => api.get(`/issues/${iid}/comments`, options),
  create: (iid, body) => api.post(`/issues/${iid}/comments`, { body }),
  update: (commentId, body) => api.patch(`/comments/${commentId}`, { body }),
  remove: (commentId) => api.delete(`/comments/${commentId}`),
};
