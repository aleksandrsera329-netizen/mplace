import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Permission, UserRole } from '@prisma/client';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';

class CursorListQuery {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

class StatusBody {
  @IsString()
  @MinLength(1)
  status!: string;
}

class RoleBody {
  @IsString()
  @MinLength(1)
  role!: string;
}

class ResolveDisputeBody {
  @IsString()
  @MinLength(1)
  resolution!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class AuditListQuery {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entityType?: string;
}

class ProcessPayoutBody {
  @IsString()
  @MinLength(1)
  status!: string;

  @IsOptional()
  @IsString()
  adminNote?: string;
}

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Legacy stats (kept for existing admin UI) */
  @Get('stats')
  @RequirePermissions(Permission.users_read, Permission.orders_read)
  @ApiOperation({ summary: 'Legacy dashboard stats' })
  async stats() {
    const d = await this.admin.getDashboard();
    return {
      customers: d.customers,
      merchants: d.merchants,
      orders: d.orders,
      products: d.products,
      pendingVerifications: d.pendingShops,
      appealedDisputes: d.openDisputes,
      todayTotalCents: d.today.gmvCents,
      todayTotal: (d.today.gmvCents / 100).toFixed(2),
      gmvCents: d.gmvCents,
      todayOrders: d.today.orders,
    };
  }

  @Get('dashboard')
  @RequirePermissions(Permission.users_read, Permission.orders_read)
  @ApiOperation({ summary: 'Admin dashboard metrics' })
  dashboard() {
    return this.admin.getDashboard();
  }

  @Get('users')
  @RequirePermissions(Permission.users_read)
  @ApiOperation({ summary: 'List users (cursor)' })
  listUsers(@Query() query: CursorListQuery) {
    return this.admin.listUsers({
      role: query.role,
      status: query.status,
      search: query.search,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  /** Backward-compatible: all customers */
  @Get('customers')
  @RequirePermissions(Permission.users_read)
  customers() {
    return this.admin.listUsers({ role: 'CUSTOMER', limit: 100 });
  }

  /** Backward-compatible: all merchants */
  @Get('merchants')
  @RequirePermissions(Permission.users_read)
  merchants() {
    return this.admin.listUsers({ role: 'MERCHANT', limit: 100 });
  }

  @Patch('users/:id/status')
  @RequirePermissions(Permission.users_write)
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: StatusBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.updateUserStatus(id, body.status, user.sub);
  }

  @Patch('users/:id/role')
  @RequirePermissions(Permission.users_write)
  updateUserRole(
    @Param('id') id: string,
    @Body() body: RoleBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.updateUserRole(id, body.role, user.sub);
  }

  @Get('shops')
  @RequirePermissions(Permission.shops_read)
  listShops(@Query() query: CursorListQuery) {
    return this.admin.listShops({
      status: query.status,
      search: query.search,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Patch('shops/:id/status')
  @RequirePermissions(Permission.shops_suspend)
  updateShopStatus(
    @Param('id') id: string,
    @Body() body: StatusBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.updateShopStatus(id, body.status, user.sub);
  }

  @Get('orders')
  @RequirePermissions(Permission.orders_read)
  listOrders(@Query() query: CursorListQuery) {
    return this.admin.listOrders({
      status: query.status,
      search: query.search,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Get('disputes')
  @RequirePermissions(Permission.disputes_read)
  listDisputes(@Query() query: CursorListQuery) {
    return this.admin.listDisputes({
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Patch('disputes/:id/resolve')
  @RequirePermissions(Permission.disputes_resolve)
  resolveDispute(
    @Param('id') id: string,
    @Body() body: ResolveDisputeBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.resolveDispute(
      id,
      body.resolution,
      body.note || '',
      user.sub,
    );
  }

  @Get('payouts')
  @RequirePermissions(Permission.payouts_read)
  @ApiOperation({ summary: 'List payout requests (cursor)' })
  listPayouts(@Query() query: CursorListQuery) {
    return this.admin.listPayouts({
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Patch('payouts/:id/process')
  @RequirePermissions(Permission.payouts_approve)
  @ApiOperation({ summary: 'Approve / reject / mark paid a payout' })
  processPayout(
    @Param('id') id: string,
    @Body() body: ProcessPayoutBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.processPayout(
      id,
      body.status,
      body.adminNote || '',
      user.sub,
    );
  }

  @Get('audit')
  @RequirePermissions(Permission.audit_read)
  @ApiOperation({ summary: 'Audit log (cursor)' })
  listAudit(@Query() query: AuditListQuery) {
    return this.admin.listAudit({
      action: query.action,
      entityType: query.entityType,
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
