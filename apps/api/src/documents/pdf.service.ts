import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

@Injectable()
export class PdfService {
  async generateInvoice(document: {
    number: string;
    issuedAt: Date | string;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    currency?: string;
    data?: unknown;
  }): Promise<Buffer> {
    return this.generateDocumentPdf(document, 'СЧЁТ НА ОПЛАТУ');
  }

  async generateAct(document: {
    number: string;
    issuedAt: Date | string;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    currency?: string;
    data?: unknown;
  }): Promise<Buffer> {
    return this.generateDocumentPdf(document, 'АКТ ВЫПОЛНЕННЫХ РАБОТ');
  }

  private async generateDocumentPdf(
    document: {
      number: string;
      issuedAt: Date | string;
      subtotalCents: number;
      taxCents: number;
      totalCents: number;
      currency?: string;
      data?: unknown;
    },
    title: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = new PassThrough();
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);

      doc.pipe(stream);

      doc.fontSize(18).text(title, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`No ${document.number}`, { align: 'center' });
      doc.text(
        `from ${new Date(document.issuedAt).toLocaleDateString('ru-RU')}`,
        { align: 'center' },
      );
      doc.moveDown(1.5);

      const data = (
        document.data && typeof document.data === 'object'
          ? document.data
          : {}
      ) as {
        seller?: { name?: string };
        buyer?: { name?: string; email?: string };
        orderNumber?: string;
        items?: Array<{
          name?: string;
          quantity?: number;
          priceCents?: number;
          totalCents?: number;
        }>;
        shippingPriceCents?: number;
      };

      if (data.orderNumber) {
        doc.fontSize(11).text(`Order: ${data.orderNumber}`);
      }
      doc.fontSize(11).text(`Seller: ${data.seller?.name || '—'}`);
      doc.text(
        `Buyer: ${data.buyer?.name || data.buyer?.email || '—'}`,
      );
      doc.moveDown();

      const items = data.items || [];
      let y = doc.y;

      doc.font('Helvetica-Bold');
      doc.text('No', 50, y, { width: 30 });
      doc.text('Name', 80, y, { width: 220 });
      doc.text('Qty', 300, y, { width: 50 });
      doc.text('Price', 350, y, { width: 70 });
      doc.text('Sum', 420, y, { width: 80 });
      doc.moveDown(0.5);
      doc.font('Helvetica');

      items.forEach((item, index) => {
        y = doc.y;
        const line =
          item.totalCents ??
          (item.priceCents || 0) * (item.quantity || 1);
        doc.text(String(index + 1), 50, y, { width: 30 });
        doc.text(item.name || '—', 80, y, { width: 220 });
        doc.text(String(item.quantity ?? 1), 300, y, { width: 50 });
        doc.text(this.formatMoney(item.priceCents || 0), 350, y, {
          width: 70,
        });
        doc.text(this.formatMoney(line), 420, y, { width: 80 });
        doc.moveDown(0.7);
      });

      doc.moveDown();
      doc.text(`Subtotal: ${this.formatMoney(document.subtotalCents)}`, {
        align: 'right',
      });
      doc.text(`VAT: ${this.formatMoney(document.taxCents)}`, {
        align: 'right',
      });
      if (data.shippingPriceCents) {
        doc.text(
          `Shipping: ${this.formatMoney(data.shippingPriceCents)}`,
          { align: 'right' },
        );
      }
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(13);
      doc.text(`Total: ${this.formatMoney(document.totalCents)}`, {
        align: 'right',
      });

      doc.end();
    });
  }

  private formatMoney(cents: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format((cents || 0) / 100);
  }
}
