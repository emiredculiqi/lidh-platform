import { Injectable, Logger } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * S3-compatible object storage (ADR-005). Backend chosen entirely by env —
 * MinIO, Cloudflare R2, or AWS S3 all speak S3:
 *
 *   S3_ENDPOINT       (MinIO/R2 URL; empty = real AWS S3)
 *   S3_REGION         (any value for MinIO/R2, e.g. "auto")
 *   S3_BUCKET
 *   S3_ACCESS_KEY / S3_SECRET_KEY
 *   S3_FORCE_PATH_STYLE  ("true" for MinIO)
 *
 * GRACEFUL: if not configured, `enabled` is false and uploads are skipped.
 * Document ingestion still works (extract→chunk→embed); only original-file
 * retention / re-ingest-from-original is unavailable until storage is wired.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket = process.env.S3_BUCKET ?? "";

  constructor() {
    const key = process.env.S3_ACCESS_KEY;
    const secret = process.env.S3_SECRET_KEY;
    if (key && secret && this.bucket) {
      this.client = new S3Client({
        region: process.env.S3_REGION || "auto",
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        credentials: { accessKeyId: key, secretAccessKey: secret },
      });
    } else {
      this.client = null;
      this.logger.warn(
        "S3 not configured — original documents won't be retained " +
          "(extraction + RAG still work). Set S3_* to enable re-ingest.",
      );
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /** Store an object; returns its key. No-op-ish (returns null) when disabled. */
  async put(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string | null> {
    if (!this.client) return null;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  /** Fetch an object back (for reingest-from-original). */
  async get(key: string): Promise<Buffer | null> {
    if (!this.client) return null;
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  }
}
