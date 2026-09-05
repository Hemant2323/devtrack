import { api } from "../client";

export const authApi = {
  signup: (data) => api.post("/auth/signup", data, { auth: false }),
  login: (data) => api.post("/auth/login", data, { auth: false }),
  refresh: (refreshToken) =>
    api.post("/auth/refresh", { refresh_token: refreshToken }, { auth: false }),
  me: (options) => api.get("/auth/me", options),
};
