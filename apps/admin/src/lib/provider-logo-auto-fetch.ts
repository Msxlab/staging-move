export const PROVIDER_LOGO_AUTO_FETCH_BULK_CONCURRENCY = 2;

export interface ApiResponsePayload {
  error?: unknown;
  message?: unknown;
  details?: unknown;
  [key: string]: unknown;
}

function compactText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeResponseText(value: string): string {
  return compactText(value).slice(0, 180);
}

export async function readApiResponsePayload(
  response: Response,
): Promise<ApiResponsePayload> {
  const text = await response.text().catch(() => "");
  const trimmed = text.trim();
  if (!trimmed) return {};

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const mightBeJson =
    contentType.includes("application/json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");

  if (mightBeJson) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        return parsed as ApiResponsePayload;
      }
      return { message: String(parsed) };
    } catch {
      return {
        error: "NON_JSON_RESPONSE",
        message:
          summarizeResponseText(text) ||
          "Server returned a response that could not be parsed as JSON",
      };
    }
  }

  return {
    error: "NON_JSON_RESPONSE",
    message:
      summarizeResponseText(text) ||
      `${response.status} ${response.statusText}`.trim() ||
      "Server returned a non-JSON response",
  };
}

export function apiErrorMessage(
  payload: ApiResponsePayload,
  fallback: string,
): string {
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  return fallback;
}
