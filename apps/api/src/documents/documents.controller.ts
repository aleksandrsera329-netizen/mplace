import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { getCurrentTenantId } from '../common/tenant/tenant.context';
import { CreateActCommand } from './commands/create-act.command';
import { CreateInvoiceCommand } from './commands/create-invoice.command';
import { DocumentsService } from './documents.service';

function resolveTenantId(user: JwtPayload): string | null {
  return getCurrentTenantId() || user.tenantId || null;
}

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly documents: DocumentsService,
  ) {}

  @Post('invoice/:orderId')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create invoice from order' })
  async createInvoice(
    @Param('orderId') orderId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commandBus.execute(
      new CreateInvoiceCommand(
        orderId,
        resolveTenantId(user),
        user.sub,
        user.role,
        user.shopId,
      ),
    );
  }

  @Post('act/:orderId')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create act from order' })
  async createAct(
    @Param('orderId') orderId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commandBus.execute(
      new CreateActCommand(
        orderId,
        resolveTenantId(user),
        user.sub,
        user.role,
        user.shopId,
      ),
    );
  }

  @Get()
  @Roles(
    UserRole.MERCHANT,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'List documents' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('orderId') orderId?: string,
  ) {
    return this.documents.list({
      tenantId: resolveTenantId(user),
      orderId,
      user,
    });
  }

  @Get(':id/pdf')
  @Roles(
    UserRole.MERCHANT,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Download document PDF' })
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.documents.getPdfBuffer(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }

  @Get(':id')
  @Roles(
    UserRole.MERCHANT,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.CUSTOMER,
  )
  async getOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.documents.getOne(id, user);
  }
}
