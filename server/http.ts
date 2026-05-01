import type { Response } from "express";

export type ApiStatus = "success" | "error";

export type ApiResponse<T> = {
  status: ApiStatus;
  message: string;
  data: T | null;
  error: unknown | null;
};

export function ok<T>(res: Response, data: T, message = "OK", statusCode = 200) {
  const body: ApiResponse<T> = { status: "success", message, data, error: null };
  return res.status(statusCode).json(body);
}

export function fail(res: Response, statusCode: number, message: string, error: unknown = null) {
  const body: ApiResponse<null> = { status: "error", message, data: null, error };
  return res.status(statusCode).json(body);
}
