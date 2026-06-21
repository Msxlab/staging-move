import type { ApiResponse } from "./types";

type ApiHeaderValue = string | number | boolean | null | undefined;

export interface ApiClientConfig {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  clientType?: "web" | "mobile";
  /**
   * Native platform identifier sent on every request as `X-Client-Platform`
   * (e.g. "ios" / "android"). The server uses this to label the session device
   * ("LocateFlow iOS app") instead of "Unknown browser", since the native
   * fetch User-Agent carries no parseable browser token.
   */
  clientPlatform?: string;
  /** App version sent on every request as `X-Client-Version`. */
  clientVersion?: string;
  /**
   * Descriptive User-Agent for the native client, e.g.
   * "LocateFlow/1.2.3 (iOS; Expo)". Sent as a fallback identifier when a
   * platform can override the default fetch UA. Ignored on platforms that
   * forbid setting User-Agent (the X-Client-Platform header still works).
   */
  userAgent?: string;
  getAdditionalHeaders?: () => Promise<Record<string, ApiHeaderValue>> | Record<string, ApiHeaderValue>;
  onUnauthorized?: () => void | Promise<void>;
  onError?: (error: Error) => void;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const TIMEOUT_ERROR_MESSAGE = "Request timed out. Please try again.";

function buildApiErrorMessage(status: number, body: any) {
  const fallback = `Request failed with status ${status}`;
  if (!body || typeof body !== "object") {
    return fallback;
  }

  const base = typeof body.error === "string" && body.error.trim()
    ? body.error.trim()
    : fallback;

  const rawDetails = Array.isArray(body.details)
    ? body.details
    : typeof body.details === "string"
      ? [body.details]
      : [];

  const details = rawDetails
    .map((detail: any) => {
      if (typeof detail === "string") {
        return detail.trim();
      }
      if (detail && typeof detail.message === "string") {
        const path = Array.isArray(detail.path) && detail.path.length > 0
          ? `${detail.path.join(".")}: `
          : "";
        return `${path}${detail.message}`.trim();
      }
      return "";
    })
    .filter(Boolean);

  if (details.length === 0) {
    return base;
  }

  const uniqueDetails = Array.from(new Set(details));
  const suffix = uniqueDetails.join("; ");
  return base.includes(suffix) ? base : `${base}: ${suffix}`;
}

export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return new Error(TIMEOUT_ERROR_MESSAGE);
      }
      return error;
    }
    return new Error(String(error));
  }

  /**
   * Applies the client-identity headers (client type, native platform/version,
   * and a descriptive User-Agent) that let the server label the session device.
   * Used by both the JSON request path and the multipart upload path.
   */
  private applyClientHeaders(headers: Record<string, string>): void {
    if (this.config.clientType) {
      headers["x-client-type"] = this.config.clientType;
    }
    if (this.config.clientPlatform) {
      headers["x-client-platform"] = this.config.clientPlatform;
    }
    if (this.config.clientVersion) {
      headers["x-client-version"] = this.config.clientVersion;
    }
    if (this.config.userAgent) {
      headers["User-Agent"] = this.config.userAgent;
    }
  }

  private async applyAdditionalHeaders(headers: Record<string, string>): Promise<void> {
    const extraHeaders = await this.config.getAdditionalHeaders?.();
    if (!extraHeaders || typeof extraHeaders !== "object") return;
    for (const [key, value] of Object.entries(extraHeaders)) {
      if (!key || value === null || value === undefined || value === "") continue;
      headers[key] = String(value);
    }
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    this.applyClientHeaders(headers);
    await this.applyAdditionalHeaders(headers);
    const token = await this.config.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  private async handleResponse<T>(
    response: Response,
    opts?: { skipUnauthorizedHandler?: boolean },
  ): Promise<ApiResponse<T>> {
    if (response.status === 401) {
      let body: any = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      // Some endpoints (e.g. MFA-confirm on an older server) return 401 for a
      // bad input rather than a dead session. A caller can opt out of the global
      // sign-out handler so a wrong code doesn't log the user out.
      if (!opts?.skipUnauthorizedHandler) {
        await this.config.onUnauthorized?.();
      }
      const code = typeof body?.code === "string" ? body.code : "UNAUTHORIZED";
      return { error: buildApiErrorMessage(response.status, body), code };
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      return {
        error: `Rate limited. Retry after ${retryAfter || "60"} seconds.`,
        code: "RATE_LIMITED",
      };
    }

    if (!response.ok) {
      try {
        const body: any = await response.json();
        const code = typeof body?.code === "string" ? body.code : undefined;
        return {
          error: buildApiErrorMessage(response.status, body),
          ...(code ? { code } : {}),
        };
      } catch {
        return { error: `Request failed with status ${response.status}` };
      }
    }

    try {
      const contentType = response.headers.get("Content-Type") || "";
      const contentLength = response.headers.get("Content-Length");

      if (response.status === 204 || contentLength === "0") {
        return { data: undefined as unknown as T };
      }

      if (contentType.includes("application/json")) {
        const data = await response.json() as T;
        return { data };
      }

      const data = await response.text();
      return { data: data as unknown as T };
    } catch {
      return { data: undefined as unknown as T };
    }
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    try {
      const url = new URL(path, this.config.baseUrl);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, value);
          }
        });
      }
      const headers = await this.getHeaders();
      const response = await this.fetchWithTimeout(url.toString(), { method: "GET", headers });
      return this.handleResponse<T>(response);
    } catch (error) {
      const err = this.normalizeError(error);
      this.config.onError?.(err);
      return { error: err.message };
    }
  }

  async post<T>(
    path: string,
    body?: unknown,
    opts?: { skipUnauthorizedHandler?: boolean },
  ): Promise<ApiResponse<T>> {
    try {
      const url = new URL(path, this.config.baseUrl);
      const headers = await this.getHeaders();
      const response = await this.fetchWithTimeout(url.toString(), {
        method: "POST",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      return this.handleResponse<T>(response, opts);
    } catch (error) {
      const err = this.normalizeError(error);
      this.config.onError?.(err);
      return { error: err.message };
    }
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    try {
      const url = new URL(path, this.config.baseUrl);
      const headers = await this.getHeaders();
      const response = await this.fetchWithTimeout(url.toString(), {
        method: "PUT",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      const err = this.normalizeError(error);
      this.config.onError?.(err);
      return { error: err.message };
    }
  }

  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    try {
      const url = new URL(path, this.config.baseUrl);
      const headers = await this.getHeaders();
      const response = await this.fetchWithTimeout(url.toString(), {
        method: "PATCH",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      const err = this.normalizeError(error);
      this.config.onError?.(err);
      return { error: err.message };
    }
  }

  async delete<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    try {
      const url = new URL(path, this.config.baseUrl);
      const headers = await this.getHeaders();
      const response = await this.fetchWithTimeout(url.toString(), {
        method: "DELETE",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      const err = this.normalizeError(error);
      this.config.onError?.(err);
      return { error: err.message };
    }
  }

  async upload<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    try {
      const url = new URL(path, this.config.baseUrl);
      const token = await this.config.getToken();
      const headers: Record<string, string> = {};
      this.applyClientHeaders(headers);
      await this.applyAdditionalHeaders(headers);
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await this.fetchWithTimeout(url.toString(), {
        method: "POST",
        headers,
        body: formData,
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      const err = this.normalizeError(error);
      this.config.onError?.(err);
      return { error: err.message };
    }
  }
}
