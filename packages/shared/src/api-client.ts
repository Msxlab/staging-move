import type { ApiResponse } from "./types";

export interface ApiClientConfig {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  clientType?: "web" | "mobile";
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

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.clientType) {
      headers["x-client-type"] = this.config.clientType;
    }
    const token = await this.config.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (response.status === 401) {
      await this.config.onUnauthorized?.();
      return { error: "Unauthorized", code: "UNAUTHORIZED" };
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
        const body = await response.json();
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

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    try {
      const url = new URL(path, this.config.baseUrl);
      const headers = await this.getHeaders();
      const response = await this.fetchWithTimeout(url.toString(), {
        method: "POST",
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
      if (this.config.clientType) {
        headers["x-client-type"] = this.config.clientType;
      }
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
