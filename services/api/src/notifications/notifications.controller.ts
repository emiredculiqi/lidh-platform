import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { NotificationDto } from "./dto/notification.dto";

@ApiTags("Notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: "Recent activity feed (bell)",
    description:
      "Newest first, max 30: new conversations, registered contacts, captured leads.",
  })
  @ApiQuery({ name: "tenantSlug", example: "acme-coffee" })
  @ApiOkResponse({ type: NotificationDto, isArray: true })
  list(@Query("tenantSlug") tenantSlug: string): Promise<NotificationDto[]> {
    return this.notifications.list(tenantSlug);
  }
}
