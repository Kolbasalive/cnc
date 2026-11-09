import createClient from "openapi-fetch";
import type { paths } from "./schema";

export const api = createClient<paths>({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? "" });

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Result<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

export async function unwrap<T>(request: Promise<Result<T>>): Promise<T> {
  const result = await request;

  if (result.error !== undefined) {
    const message =
      result.error && typeof result.error === "object" && "error" in result.error
        ? String((result.error as { error: unknown }).error)
        : `HTTP ${result.response.status}`;
    throw new ApiError(message, result.response.status);
  }

  if (result.data === undefined) {
    throw new ApiError(`HTTP ${result.response.status}: пустой ответ`, result.response.status);
  }

  return result.data;
}
