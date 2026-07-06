import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ChannelsService } from "./channels.service";
import { ChannelStatusDto, ConnectWhatsAppDto } from "./dto/channels.dto";

@ApiTags("Channels")
@Controller("tenants/:slug/channels")
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  @ApiOperation({ summary: "List a tenant's channels + connection status" })
  @ApiOkResponse({ type: [ChannelStatusDto] })
  list(@Param("slug") slug: string): Promise<ChannelStatusDto[]> {
    return this.channels.list(slug);
  }

  @Post("whatsapp/connect")
  @ApiOperation({
    summary: "Connect WhatsApp via Meta Embedded Signup (coexistence)",
  })
  connectWhatsApp(
    @Param("slug") slug: string,
    @Body() dto: ConnectWhatsAppDto,
  ): Promise<ChannelStatusDto> {
    return this.channels.connectWhatsApp(slug, dto);
  }

  @Post("whatsapp/disconnect")
  @ApiOperation({ summary: "Disconnect the tenant's WhatsApp channel" })
  disconnectWhatsApp(@Param("slug") slug: string): Promise<ChannelStatusDto> {
    return this.channels.disconnectWhatsApp(slug);
  }
}
