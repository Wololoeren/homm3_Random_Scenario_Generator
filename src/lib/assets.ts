const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Prefix a /public path with the Pages base path so exports work in a subfolder. */
export function asset(path: string): string {
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
