export class UpdateProductStockCommand {
  constructor(
    public readonly productId: string,
    public readonly warehouseId: string,
    public readonly quantity: number,
    public readonly merchantId: string,
    public readonly tenantId: string | null,
  ) {}
}
