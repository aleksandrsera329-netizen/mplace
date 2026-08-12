import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateWarehouseHandler } from './commands/create-warehouse.handler';
import { UpdateProductStockHandler } from './commands/update-product-stock.handler';
import { UpdateWarehouseHandler } from './commands/update-warehouse.handler';
import { InventoryService } from './inventory.service';
import { WarehouseController } from './warehouse.controller';

@Module({
  imports: [CqrsModule],
  controllers: [WarehouseController],
  providers: [
    CreateWarehouseHandler,
    UpdateWarehouseHandler,
    UpdateProductStockHandler,
    InventoryService,
  ],
  exports: [
    CreateWarehouseHandler,
    UpdateWarehouseHandler,
    UpdateProductStockHandler,
    InventoryService,
  ],
})
export class WarehouseModule {}
