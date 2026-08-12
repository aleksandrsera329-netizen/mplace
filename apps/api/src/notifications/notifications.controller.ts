import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List my notifications (unread first, paginated)',
  })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.listForUser(user.sub, {
      unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count' })
  async unreadCount(@CurrentUser() user: JwtPayload) {
    const count = await this.notifications.unreadCount(user.sub);
    return { count };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    await this.notifications.markAllAsRead(user.sub);
    return { ok: true };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  async markAsReadPatch(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.notifications.markAsRead(id, user.sub);
    return { ok: true };
  }

  /** Legacy alias for clients still using POST */
  @Post(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read (POST alias)' })
  async markAsReadPost(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.notifications.markAsRead(id, user.sub);
    return { ok: true };
  }
}
