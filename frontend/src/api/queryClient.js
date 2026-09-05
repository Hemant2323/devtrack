import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./errors";

/**
 * Shared cache configuration.
 *
 * Defaults are conservative; individual queries override them where the data
 * demands it (members/components cache for minutes, comments stay fresh).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // Never retry a request the server answered deliberately — a 404 or a
        // 403 will not become a 200, and retrying a 401 fights the refresh
        // logic in client.js.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
