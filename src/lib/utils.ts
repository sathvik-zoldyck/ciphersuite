import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes without conflicts. Used everywhere. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a FirestoreDate or Date to a readable string. */
export function formatDate(
  value: any,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
): string {
  if (!value) return "—";
  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    return date.toLocaleDateString("en-GB", options);
  } catch {
    return "—";
  }
}

/** Format bytes to human-readable size. e.g. 1048576 → "1.0 MB" */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k     = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Truncate a string to maxLength with an ellipsis. */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + "…";
}

/** Sleep for ms milliseconds. Use with await in async functions. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
