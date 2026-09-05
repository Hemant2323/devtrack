/**
 * Normalised API error.
 *
 * The backend returns two different shapes under `detail`:
 *
 *   business errors  HTTPException(status, "Email already registered")
 *                    -> { detail: "Email already registered" }        (string)
 *
 *   validation       Pydantic / FastAPI RequestValidationError
 *                    -> { detail: [ { loc, msg, type }, ... ] }       (array)
 *
 * The old client did `new Error(body.detail)`, so every 422 rendered as
 * "[object Object]" — a short password or a bug missing its severity gave the
 * user nothing to act on. ApiError flattens both into `message`, and exposes
 * `fieldErrors` so a form can put the message next to the offending input.
 */
export class ApiError extends Error {
  constructor(status, message, { fieldErrors = {}, body = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.body = body;
  }

  /** True when the failure is the user's input, not the system's fault. */
  get isValidation() {
    return this.status === 422 || Object.keys(this.fieldErrors).length > 0;
  }

  get isAuth() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  /** Message for a given form field, if the backend blamed that field. */
  fieldError(name) {
    return this.fieldErrors[name];
  }
}

/**
 * FastAPI reports the failing field as a `loc` path, e.g.
 * ["body", "password"] or ["body"] for a whole-model validator.
 * We key by the last string segment after "body"/"query", falling back to
 * "_form" for model-level rules such as "severity is required for bugs".
 */
function fieldNameFromLoc(loc) {
  if (!Array.isArray(loc)) return "_form";
  const path = loc.filter(
    (part) => typeof part === "string" && !["body", "query", "path"].includes(part),
  );
  return path.length ? path[path.length - 1] : "_form";
}

function humanise(msg) {
  if (typeof msg !== "string" || !msg) return "Invalid value";
  // Pydantic v2 prefixes model-validator messages; strip it for display.
  return msg.replace(/^Value error,\s*/i, "");
}

/** Build an ApiError from a parsed response body. */
export function normaliseError(status, body, fallback) {
  const detail = body?.detail;

  if (Array.isArray(detail)) {
    const fieldErrors = {};
    for (const item of detail) {
      const field = fieldNameFromLoc(item?.loc);
      if (!fieldErrors[field]) fieldErrors[field] = humanise(item?.msg);
    }
    const first = Object.values(fieldErrors)[0];
    return new ApiError(status, first ?? fallback, { fieldErrors, body });
  }

  if (typeof detail === "string" && detail) {
    return new ApiError(status, detail, { body });
  }

  return new ApiError(status, fallback, { body });
}

/** Thrown when the network never reached the API at all. */
export function networkError(cause) {
  const err = new ApiError(
    0,
    "Can't reach the DevTrack API. Check that the backend is running on port 8000.",
  );
  err.cause = cause;
  return err;
}
