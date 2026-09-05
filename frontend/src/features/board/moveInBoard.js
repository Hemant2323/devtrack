import { BOARD_COLUMNS } from "../../lib/enums";

/**
 * Move a card between columns in a cached board payload.
 *
 * Pure and separately testable: this is the function the optimistic update
 * depends on, so a bug here would silently corrupt the board cache.
 *
 * Returns the original object unchanged when the issue is not present or the
 * target status is unknown, so a stray drop can never damage the cache.
 */
export function moveInBoard(board, issueId, toStatus) {
  if (!board) return board;

  const next = {};
  let moved = null;

  for (const column of BOARD_COLUMNS) {
    next[column.key] = (board[column.key] ?? []).filter((issue) => {
      if (issue.id === issueId) {
        moved = issue;
        return false;
      }
      return true;
    });
  }
  if (!moved) return board;

  const target = BOARD_COLUMNS.find((column) => column.status === toStatus);
  if (!target) return board;

  // The API orders by created_at DESC and has no rank column, so a moved card
  // takes its place by creation order rather than at an arbitrary index.
  next[target.key] = [{ ...moved, status: toStatus }, ...next[target.key]].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );
  return next;
}
