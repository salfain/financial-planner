import { env } from "cloudflare:workers";
import { ApiError } from "./api";

type StoredObject = {
  body: ReadableStream<Uint8Array> | null;
  arrayBuffer(): Promise<ArrayBuffer>;
  size?: number;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
};

type ObjectBucket = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<unknown>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
};

export function getFilesBucket(): ObjectBucket {
  const bucket = (env as Record<string, unknown>).FILES;
  if (!bucket || typeof bucket !== "object" || typeof (bucket as ObjectBucket).put !== "function") {
    throw new ApiError(503, "FILE_STORAGE_UNAVAILABLE", "Penyimpanan laporan dan backup belum siap. Publikasikan konfigurasi storage terbaru lalu coba lagi.");
  }
  return bucket as ObjectBucket;
}
