import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PdfService {
  constructor(private prisma: PrismaService) {}

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  async generateSaleInvoice(saleId: string): Promise<Buffer> {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        items: { include: { product: { include: { category: true } } } },
        invoices: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!sale) throw new Error('Vente non trouvée');

    const settings = await this.prisma.setting.findMany({ where: { group: 'company' } });
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
    const invoice = sale.invoices[0];

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const colors = { primary: '#1a56db', secondary: '#374151', light: '#f9fafb', border: '#e5e7eb', accent: '#059669' };
      const W = 595 - 100; // page width minus margins

      // ── Header band ──────────────────────────────────────
      doc.rect(0, 0, 595, 120).fill(colors.primary);
      doc.fillColor('white').fontSize(26).font('Helvetica-Bold').text(settingsMap.company_name || 'QUINCAILLERIE', 50, 35);
      doc.fontSize(10).font('Helvetica').text(settingsMap.company_address || '', 50, 68);
      doc.text(settingsMap.company_phone || '', 50, 83);

      // Invoice badge
      doc.rect(420, 30, 130, 60).fill('white').fillColor(colors.primary).fontSize(18).font('Helvetica-Bold').text('FACTURE', 430, 42);
      doc.fillColor(colors.secondary).fontSize(10).font('Helvetica');

      // ── Invoice meta ─────────────────────────────────────
      doc.moveDown(4);
      const metaTop = 140;
      doc.fillColor(colors.secondary).fontSize(10);
      doc.text(`N° Facture :`, 50, metaTop).font('Helvetica-Bold').text(invoice?.number || sale.reference, 160, metaTop);
      doc.font('Helvetica').text(`Date :`, 50, metaTop + 18).font('Helvetica-Bold').text(this.formatDate(sale.createdAt), 160, metaTop + 18);
      doc.font('Helvetica').text(`Vendeur :`, 50, metaTop + 36).font('Helvetica-Bold').text(`${sale.user.firstName} ${sale.user.lastName}`, 160, metaTop + 36);

      // ── Customer box ─────────────────────────────────────
      if (sale.customer) {
        const cTop = metaTop;
        doc.rect(340, cTop - 5, 205, 70).fill(colors.light).stroke(colors.border);
        doc.fillColor(colors.primary).fontSize(10).font('Helvetica-Bold').text('CLIENT', 350, cTop + 5);
        doc.fillColor(colors.secondary).font('Helvetica').fontSize(10)
          .text(sale.customer.name, 350, cTop + 20)
          .text(sale.customer.phone || '', 350, cTop + 35)
          .text(sale.customer.address || '', 350, cTop + 50, { width: 185 });
      }

      // ── Items table ───────────────────────────────────────
      const tableTop = 240;
      const cols = { desc: 50, qty: 280, price: 350, disc: 420, total: 480 };

      // Table header
      doc.rect(50, tableTop, W, 22).fill(colors.primary);
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
      doc.text('DÉSIGNATION', cols.desc + 5, tableTop + 7);
      doc.text('QTÉ', cols.qty, tableTop + 7);
      doc.text('P.U.', cols.price, tableTop + 7);
      doc.text('REMISE', cols.disc - 5, tableTop + 7);
      doc.text('TOTAL', cols.total, tableTop + 7);

      let y = tableTop + 22;
      let rowAlt = false;
      for (const item of sale.items) {
        if (y > 700) { doc.addPage(); y = 50; }
        if (rowAlt) doc.rect(50, y, W, 20).fill(colors.light);
        doc.fillColor(colors.secondary).fontSize(9).font('Helvetica');
        doc.text(item.product.name, cols.desc + 5, y + 6, { width: 220, ellipsis: true });
        doc.text(`${item.quantity} ${item.product.unit}`, cols.qty, y + 6);
        doc.text(this.formatCurrency(item.unitPrice), cols.price, y + 6);
        doc.text(item.discount ? `${item.discount}%` : '-', cols.disc, y + 6);
        doc.text(this.formatCurrency(item.total), cols.total, y + 6);
        doc.moveTo(50, y + 20).lineTo(50 + W, y + 20).strokeColor(colors.border).lineWidth(0.5).stroke();
        y += 20;
        rowAlt = !rowAlt;
      }

      // ── Totals ───────────────────────────────────────────
      y += 15;
      const totalsX = 360;
      const totalsW = 185;

      const addTotalRow = (label: string, value: string, bold = false, color = colors.secondary) => {
        if (bold) {
          doc.rect(totalsX - 5, y - 3, totalsW + 15, 22).fill(colors.primary);
          doc.fillColor('white').font('Helvetica-Bold').fontSize(11);
        } else {
          doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
        }
        doc.text(label, totalsX, y);
        doc.text(value, totalsX, y, { width: totalsW, align: 'right' });
        y += bold ? 22 : 18;
      };

      addTotalRow('Sous-total :', this.formatCurrency(sale.subtotal));
      if (sale.taxRate > 0) addTotalRow(`TVA (${sale.taxRate}%) :`, this.formatCurrency(sale.taxAmount));
      if (sale.discount > 0) addTotalRow('Remise :', `-${this.formatCurrency(sale.discount)}`, false, colors.accent);
      y += 5;
      addTotalRow('TOTAL :', this.formatCurrency(sale.total), true);
      y += 10;
      addTotalRow('Montant payé :', this.formatCurrency(sale.amountPaid), false, colors.accent);
      if (sale.amountDue > 0) addTotalRow('Reste à payer :', this.formatCurrency(sale.amountDue), false, '#dc2626');

      // ── Status badge ─────────────────────────────────────
      const statusColors: Record<string, string> = { PAID: '#059669', PARTIAL: '#d97706', PENDING: '#6b7280', CANCELLED: '#dc2626' };
      const sc = statusColors[sale.status] || '#6b7280';
      const statusLabels: Record<string, string> = { PAID: 'PAYÉ', PARTIAL: 'PARTIEL', PENDING: 'EN ATTENTE', CANCELLED: 'ANNULÉ' };
      y += 10;
      doc.rect(50, y, 100, 24).fill(sc).fillColor('white').fontSize(11).font('Helvetica-Bold')
        .text(statusLabels[sale.status] || sale.status, 55, y + 7, { width: 90, align: 'center' });

      // ── Footer ───────────────────────────────────────────
      const pageHeight = 842;
      doc.rect(0, pageHeight - 50, 595, 50).fill(colors.primary);
      doc.fillColor('white').fontSize(9).font('Helvetica')
        .text('Merci pour votre confiance !', 50, pageHeight - 35, { align: 'center', width: 495 });

      doc.end();
    });
  }

  async generatePurchaseOrder(purchaseId: string): Promise<Buffer> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        supplier: true,
        items: { include: { product: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!purchase) throw new Error('Achat non trouvé');

    const settings = await this.prisma.setting.findMany({ where: { group: 'company' } });
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primary = '#1a56db';
      const W = 595 - 100;

      doc.rect(0, 0, 595, 120).fill(primary);
      doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text(settingsMap.company_name || 'QUINCAILLERIE', 50, 35);
      doc.fontSize(10).font('Helvetica').text(settingsMap.company_address || '', 50, 68).text(settingsMap.company_phone || '', 50, 83);
      doc.rect(400, 30, 145, 60).fill('white').fillColor(primary).fontSize(14).font('Helvetica-Bold').text('BON DE COMMANDE', 408, 42, { width: 130 });

      doc.fillColor('#374151').fontSize(10).font('Helvetica');
      doc.text(`Référence :`, 50, 140).font('Helvetica-Bold').text(purchase.reference, 160, 140);
      doc.font('Helvetica').text(`Date :`, 50, 158).font('Helvetica-Bold').text(this.formatDate(purchase.createdAt), 160, 158);

      doc.rect(340, 135, 205, 60).fill('#f9fafb').stroke('#e5e7eb');
      doc.fillColor(primary).font('Helvetica-Bold').text('FOURNISSEUR', 350, 145);
      doc.fillColor('#374151').font('Helvetica').text(purchase.supplier.name, 350, 160).text(purchase.supplier.phone || '', 350, 175);

      const tTop = 230;
      doc.rect(50, tTop, W, 22).fill(primary);
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
      doc.text('PRODUIT', 55, tTop + 7).text('QTÉ', 300, tTop + 7).text('P.U.', 370, tTop + 7).text('TOTAL', 470, tTop + 7);

      let y = tTop + 22;
      for (const item of purchase.items) {
        doc.fillColor('#374151').fontSize(9).font('Helvetica');
        doc.text(item.product.name, 55, y + 6, { width: 235 });
        doc.text(`${item.quantity}`, 300, y + 6);
        doc.text(this.formatCurrency(item.unitPrice), 370, y + 6);
        doc.text(this.formatCurrency(item.total), 470, y + 6);
        doc.moveTo(50, y + 20).lineTo(50 + W, y + 20).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        y += 20;
      }

      y += 15;
      doc.rect(360, y, 185, 22).fill(primary);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(11)
        .text('TOTAL :', 365, y + 6).text(this.formatCurrency(purchase.total), 365, y + 6, { width: 175, align: 'right' });

      doc.rect(0, 792, 595, 50).fill(primary);
      doc.fillColor('white').fontSize(9).font('Helvetica')
        .text('Bon de commande généré automatiquement', 50, 807, { align: 'center', width: 495 });

      doc.end();
    });
  }
}
