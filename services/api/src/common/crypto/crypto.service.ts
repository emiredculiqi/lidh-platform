import { Injectable, Logger } from "@nestjs/common";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Symmetric encryption for per-tenant secrets stored in the DB — specifically
 * the Meta WhatsApp access token in `Channel.credentialsEnc`. AES-256-GCM
 * (authenticated: tampering with the ciphertext fails decryption).
 *
 *   CREDENTIAL_ENC_KEY   32-byte key, base64-encoded. Generate with:
 *                        `openssl rand -base64 32`
 *
 * Blob format (versioned so we can rotate keys / algorithms later without
 * guessing how an old value was encrypted):
 *
 *   v1:<ivB64>:<authTagB64>:<ciphertextB64>
 *
 * GRACEFUL BOOT, FATAL ON USE: a missing/invalid key does NOT crash the app
 * at startup (local dev without WhatsApp shouldn't need it), but the first
 * encrypt/decrypt call throws — we never silently store a token in plaintext.
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  /** null when CREDENTIAL_ENC_KEY is unset/invalid — throws on first use. */
  private readonly key: Buffer | null;
  private static readonly VERSION = "v1";
  private static readonly IV_BYTES = 12; // GCM standard nonce length
  private static readonly KEY_BYTES = 32; // AES-256

  constructor() {
    const raw = process.env.CREDENTIAL_ENC_KEY;
    if (!raw) {
      this.key = null;
      this.logger.warn(
        "CREDENTIAL_ENC_KEY unset — channel credential encryption is " +
          "unavailable (WhatsApp connect will fail until it's set). " +
          "Generate one with `openssl rand -base64 32`.",
      );
      return;
    }
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length !== CryptoService.KEY_BYTES) {
      this.key = null;
      this.logger.error(
        `CREDENTIAL_ENC_KEY must decode to ${CryptoService.KEY_BYTES} bytes ` +
          `(got ${decoded.length}). Encryption disabled until fixed.`,
      );
      return;
    }
    this.key = decoded;
  }

  /** True when a valid key is loaded (for health checks / preflight). */
  get enabled(): boolean {
    return this.key !== null;
  }

  /** Encrypt UTF-8 plaintext → versioned blob. Throws if no key is configured. */
  encrypt(plaintext: string): string {
    const key = this.requireKey();
    const iv = randomBytes(CryptoService.IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      CryptoService.VERSION,
      iv.toString("base64"),
      authTag.toString("base64"),
      ciphertext.toString("base64"),
    ].join(":");
  }

  /** Decrypt a versioned blob → UTF-8 plaintext. Throws on tamper/bad key. */
  decrypt(blob: string): string {
    const key = this.requireKey();
    const parts = blob.split(":");
    if (parts.length !== 4 || parts[0] !== CryptoService.VERSION) {
      throw new Error("crypto: unrecognized credential blob format");
    }
    const [, ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(dataB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  }

  /**
   * Constant-time comparison of two secrets (e.g. a webhook HMAC vs the
   * expected value). Safe against length/timing side channels.
   */
  safeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new Error(
        "crypto: CREDENTIAL_ENC_KEY is not configured — cannot " +
          "encrypt/decrypt channel credentials.",
      );
    }
    return this.key;
  }
}
