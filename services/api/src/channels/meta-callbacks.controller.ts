import { Body, Controller, HttpCode, Logger, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { createHash } from "node:crypto";
import { Public } from "../common/auth/public.decorator";
import { ChannelsService } from "./channels.service";
import { parseSignedRequest } from "./meta-signed-request";

/** Where a user can check the status of a deletion request. */
const STATUS_BASE =
  process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://app.lidh.al";

/**
 * App-level Meta callbacks for Facebook Login for Business. Configure both in
 * the Meta App Dashboard under **App Settings → Basic**:
 *
 *   Deauthorize callback URL:   https://api.lidh.al/v1/webhooks/meta/deauthorize
 *   Data deletion request URL:  https://api.lidh.al/v1/webhooks/meta/data-deletion
 *
 * Meta POSTs an application/x-www-form-urlencoded body with a single
 * `signed_request` field, HMAC-signed with our app secret. Anything that fails
 * verification is dropped.
 *
 * These are NOT the WhatsApp message webhook — that is
 * POST /v1/webhooks/whatsapp (see whatsapp.controller.ts) and uses a different
 * signature scheme (X-Hub-Signature-256 over the raw body).
 */
@ApiTags("Meta")
@Public() // Meta callbacks carry no Clerk user; authenticated via signed_request.
@Controller("webhooks/meta")
export class MetaCallbacksController {
  private readonly logger = new Logger(MetaCallbacksController.name);

  constructor(private readonly channels: ChannelsService) {}

  @Post("deauthorize")
  @HttpCode(200)
  @ApiOperation({
    summary: "Meta app deauthorize callback",
    description:
      "Fired when a user removes the Lidh.al app from their Meta account. " +
      "Verifies the signed_request, then disconnects every WhatsApp channel " +
      "that user connected and destroys the stored access token.",
  })
  async deauthorize(
    @Body() body: { signed_request?: string },
  ): Promise<{ status: string }> {
    const userId = this.verify(body?.signed_request, "deauthorize");
    if (!userId) return { status: "ignored" };

    const revoked = await this.channels.revokeForMetaUser(userId);
    return { status: "ok", ...(revoked ? { revoked } : {}) } as {
      status: string;
    };
  }

  @Post("data-deletion")
  @HttpCode(200)
  @ApiOperation({
    summary: "Meta data deletion request callback",
    description:
      "Fired when a user requests deletion of their data. Verifies the " +
      "signed_request, revokes their channels, and returns the { url, " +
      "confirmation_code } pair Meta requires so the user can track the request.",
  })
  async dataDeletion(
    @Body() body: { signed_request?: string },
  ): Promise<{ url: string; confirmation_code: string } | { status: string }> {
    const userId = this.verify(body?.signed_request, "data-deletion");
    if (!userId) return { status: "ignored" };

    await this.channels.revokeForMetaUser(userId);

    // Deterministic, non-reversible handle for the request. Deriving it from
    // the user id means a repeat request returns the same code, and it does not
    // leak the Meta user id into a URL the user may share.
    const confirmationCode = createHash("sha256")
      .update(`meta-deletion:${userId}`)
      .digest("hex")
      .slice(0, 24);

    this.logger.log(
      `data deletion request for Meta user ${userId} — code ${confirmationCode}`,
    );
    return {
      url: `${STATUS_BASE}/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    };
  }

  /**
   * Verify a signed_request and pull out the Meta user id. Returns undefined
   * (and logs) for anything unusable, so both handlers can bail identically.
   */
  private verify(
    signedRequest: string | undefined,
    label: string,
  ): string | undefined {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      this.logger.error(`${label}: META_APP_SECRET unset — cannot verify`);
      return undefined;
    }
    if (!signedRequest) {
      this.logger.warn(`${label}: missing signed_request — dropped`);
      return undefined;
    }
    const payload = parseSignedRequest(signedRequest, appSecret);
    if (!payload) {
      this.logger.warn(`${label}: signed_request failed verification — dropped`);
      return undefined;
    }
    if (typeof payload.user_id !== "string" || !payload.user_id) {
      this.logger.warn(`${label}: signed_request carried no user_id — dropped`);
      return undefined;
    }
    return payload.user_id;
  }
}
