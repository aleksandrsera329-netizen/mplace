import { ConfigService } from '@nestjs/config';

jest.mock('meilisearch', () => ({
  Meilisearch: jest.fn().mockImplementation(() => ({
    health: jest.fn(),
    index: jest.fn().mockReturnValue({
      updateSettings: jest.fn(),
      addDocuments: jest.fn(),
      deleteDocument: jest.fn(),
      search: jest.fn(),
    }),
  })),
}));

import { SearchService } from './search.service';

describe('SearchService (Stage 17)', () => {
  let service: SearchService;

  beforeEach(() => {
    service = new SearchService({
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService);
  });

  it('toDocument maps brand/stock/moq/inStock/attributes', () => {
    const doc = service.toDocument({
      id: 'p1',
      name: 'Valve',
      description: 'Steel valve',
      sku: 'SKU-1',
      priceCents: 1500,
      status: 'ACTIVE',
      categoryId: 'c1',
      shopId: 's1',
      brand: 'Acme',
      stock: 10,
      reservedStock: 2,
      moq: 5,
      attributes: { color: 'red' },
      category: { name: 'Valves' },
      shop: { name: 'Shop A' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(doc).toEqual(
      expect.objectContaining({
        id: 'p1',
        name: 'Valve',
        sku: 'SKU-1',
        brand: 'Acme',
        stock: 8,
        moq: 5,
        inStock: true,
        categoryName: 'Valves',
        shopName: 'Shop A',
        attributes: { color: 'red' },
        status: 'ACTIVE',
      }),
    );
  });

  it('buildFilter composes category, price, vendor, inStock', () => {
    const filter = service.buildFilter({
      categoryId: 'cat-1',
      shopId: 'shop-9',
      brand: 'Acme',
      priceMin: 100,
      priceMax: 5000,
      inStock: true,
      moq: 10,
    });

    expect(filter).toContain('status = ACTIVE');
    expect(filter).toContain('categoryId = "cat-1"');
    expect(filter).toContain('shopId = "shop-9"');
    expect(filter).toContain('brand = "Acme"');
    expect(filter).toContain('priceCents >= 100');
    expect(filter).toContain('priceCents <= 5000');
    expect(filter).toContain('inStock = true');
    expect(filter).toContain('moq <= 10');
  });

  it('buildFilter supports stock=out and attributes', () => {
    const filter = service.buildFilter({
      stock: 'out of stock',
      attributes: 'color:blue,size:xl',
    });
    expect(filter).toContain('inStock = false');
    expect(filter).toContain('attributes.color = "blue"');
    expect(filter).toContain('attributes.size = "xl"');
  });

  it('searchProductsAdvanced returns empty when Meili disabled', async () => {
    const res = await service.searchProductsAdvanced({
      q: 'pump',
      page: 1,
      limit: 10,
    });
    expect(res.enabled).toBe(false);
    expect(res.hits).toEqual([]);
    expect(res.facets).toEqual({});
    expect(res.total).toBe(0);
  });

  it('autocomplete returns empty when disabled', async () => {
    const res = await service.autocomplete('val');
    expect(res.suggestions).toEqual([]);
  });
});
