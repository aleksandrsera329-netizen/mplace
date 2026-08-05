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
import { UserRole } from '@prisma/client';
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

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Legacy stats (kept for existing admin UI) */
  @Get('stats')
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
  @ApiOperation({ summary: 'Admin dashboard metrics' })
  dashboard() {
    return this.admin.getDashboard();
  }

  @Get('users')
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
  customers() {
    return this.admin.listUsers({ role: 'CUSTOMER', limit: 100 });
  }

  /** Backward-compatible: all merchants */
  @Get('merchants')
  merchants() {
    return this.admin.listUsers({ role: 'MERCHANT', limit: 100 });
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: StatusBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.updateUserStatus(id, body.status, user.sub);
  }

  @Patch('users/:id/role')
  updateUserRole(
    @Param('id') id: string,
    @Body() body: RoleBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.updateUserRole(id, body.role, user.sub);
  }

  @Get('shops')
  listShops(@Query() query: CursorListQuery) {
    return this.admin.listShops({
      status: query.status,
      search: query.search,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Patch('shops/:id/status')
  updateShopStatus(
    @Param('id') id: string,
    @Body() body: StatusBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.updateShopStatus(id, body.status, user.sub);
  }

  @Get('orders')
  listOrders(@Query() query: CursorListQuery) {
    return this.admin.listOrders({
      status: query.status,
      search: query.search,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Get('disputes')
  listDisputes(@Query() query: CursorListQuery) {
    return this.admin.listDisputes({
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Patch('disputes/:id/resolve')
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
}
