// utils/apiError.ts
import axios, { AxiosError } from "axios";

export type ApiError = {
  status: number;
  message: string;
  data?: any;
  isConflict?: boolean; // true cuando 409
};

export function parseAxiosError(e: unknown): ApiError {
  if (axios.isAxiosError(e)) {
    const ax = e as AxiosError<any>;
    const status = ax.response?.status ?? 0;
    const data = ax.response?.data;
    const message =
      data?.reason ||
      data?.message ||
      data?.error ||
      ax.message ||
      "Unexpected error";
    return { status, message, data, isConflict: status === 409 };
  }
  return { status: 0, message: (e as Error)?.message ?? "Unknown error" };
}
