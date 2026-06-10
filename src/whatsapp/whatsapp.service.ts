import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../invoices/pdf.service';
import axios from 'axios';

export interface WhatsAppTextMessage {
  to: string;
  message: string;
  recipientId?: string;
  recipientType?: 'customer' | 'supplier';
  invoiceId?: string;
}

export interface WhatsAppDocumentMessage {
  to: string;
  documentBuffer: Buffer;
  filename: string;
  caption?: string;
  recipientId?: string;
  recipientType?: 'customer' | 'supplier';
  invoiceId?: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiUrl: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {
    this.apiUrl = this.configService.get('WHATSAPP_API_URL', 'https://graph.facebook.com/v17.0');
    this.phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID', '');
    this.accessToken = this.configService.get('WHATSAPP_ACCESS_TOKEN', '');
  }

  private normalizePhone(phone: string): string {
    // Remove spaces, dashes, parentheses; ensure it starts with country code
    let normalized = phone.replace(/[\s\-\(\)]/g, '');
    if (normalized.startsWith('0')) normalized = '221' + normalized.slice(1);
    if (!normalized.startsWith('+')) normalized = '+' + normalized;
    return normalized.replace('+', '');
  }

  async sendTextMessage(params: WhatsAppTextMessage): Promise<void> {
    const { to, message, recipientId, recipientType, invoiceId } = params;
    const phone = this.normalizePhone(to);

    // Log the attempt
    const logEntry = await this.prisma.whatsappMessage.create({
      data: {
        recipient: phone,
        messageType: 'TEXT',
        content: message,
        customerId: recipientType === 'customer' ? recipientId : undefined,
        supplierId: recipientType === 'supplier' ? recipientId : undefined,
        invoiceId,
        status: 'PENDING',
      },
    });

    try {
      if (!this.phoneNumberId || !this.accessToken) {
        this.logger.warn('WhatsApp API not configured — message logged only');
        await this.prisma.whatsappMessage.update({ where: { id: logEntry.id }, data: { status: 'SENT', sentAt: new Date() } });
        return;
      }

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: { preview_url: false, body: message },
        },
        { headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' } },
      );

      await this.prisma.whatsappMessage.update({
        where: { id: logEntry.id },
        data: { status: 'SENT', sentAt: new Date(), messageId: response.data?.messages?.[0]?.id },
      });

      this.logger.log(`WhatsApp sent to ${phone}`);
    } catch (error) {
      const errMsg = error?.response?.data?.error?.message || error.message;
      this.logger.error(`WhatsApp error for ${phone}: ${errMsg}`);
      await this.prisma.whatsappMessage.update({
        where: { id: logEntry.id },
        data: { status: 'FAILED', errorMessage: errMsg },
      });
    }
  }

  async sendSaleInvoice(saleId: string): Promise<void> {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { customer: true, invoices: true },
    });
    if (!sale?.customer?.whatsapp) {
      this.logger.warn(`Sale ${saleId}: no customer WhatsApp`);
      return;
    }

    const settings = await this.prisma.setting.findMany({ where: { group: 'company' } });
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
    const invoice = sale.invoices[0];
    const invoiceNumber = invoice?.number || sale.reference;

    const message =
      `Bonjour ${sale.customer.name},\n\n` +
      `Merci pour votre achat chez *${settingsMap.company_name || 'Quincaillerie'}* !\n\n` +
      `📋 *Facture N° :* ${invoiceNumber}\n` +
      `💰 *Montant total :* ${new Intl.NumberFormat('fr-FR').format(sale.total)} FCFA\n` +
      `✅ *Payé :* ${new Intl.NumberFormat('fr-FR').format(sale.amountPaid)} FCFA\n` +
      (sale.amountDue > 0 ? `⏳ *Reste dû :* ${new Intl.NumberFormat('fr-FR').format(sale.amountDue)} FCFA\n` : '') +
      `\nMerci de votre confiance ! 🙏`;

    await this.sendTextMessage({
      to: sale.customer.whatsapp,
      message,
      recipientId: sale.customerId,
      recipientType: 'customer',
      invoiceId: invoice?.id,
    });
  }

  async sendPurchaseOrder(purchaseId: string): Promise<void> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { supplier: true },
    });
    if (!purchase?.supplier?.whatsapp) {
      this.logger.warn(`Purchase ${purchaseId}: no supplier WhatsApp`);
      return;
    }

    const settings = await this.prisma.setting.findMany({ where: { group: 'company' } });
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    const message =
      `Bonjour *${purchase.supplier.name}*,\n\n` +
      `Veuillez trouver ci-après notre bon de commande.\n\n` +
      `📦 *Référence :* ${purchase.reference}\n` +
      `💰 *Montant total :* ${new Intl.NumberFormat('fr-FR').format(purchase.total)} FCFA\n` +
      `📅 *Date :* ${new Date(purchase.createdAt).toLocaleDateString('fr-FR')}\n\n` +
      `Cordialement,\n*${settingsMap.company_name || 'Quincaillerie'}*`;

    await this.sendTextMessage({
      to: purchase.supplier.whatsapp,
      message,
      recipientId: purchase.supplierId,
      recipientType: 'supplier',
    });
  }

  async sendPaymentReceipt(saleId: string): Promise<void> {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { customer: true },
    });
    if (!sale?.customer?.whatsapp) return;

    const settings = await this.prisma.setting.findMany({ where: { group: 'company' } });
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    const message =
      `Bonjour ${sale.customer.name},\n\n` +
      `✅ Votre paiement a bien été enregistré chez *${settingsMap.company_name || 'Quincaillerie'}*.\n\n` +
      `🧾 *Référence :* ${sale.reference}\n` +
      `💵 *Montant payé :* ${new Intl.NumberFormat('fr-FR').format(sale.amountPaid)} FCFA\n` +
      (sale.amountDue > 0 ? `⏳ *Reste dû :* ${new Intl.NumberFormat('fr-FR').format(sale.amountDue)} FCFA\n` : '🎉 *Compte soldé*\n') +
      `\nMerci pour votre confiance !`;

    await this.sendTextMessage({
      to: sale.customer.whatsapp,
      message,
      recipientId: sale.customerId,
      recipientType: 'customer',
    });
  }

  async sendCreditReminder(customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer?.whatsapp || customer.balance <= 0) return;

    const settings = await this.prisma.setting.findMany({ where: { group: 'company' } });
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    const message =
      `Bonjour *${customer.name}*,\n\n` +
      `📢 Nous vous rappelons que vous avez un solde impayé chez *${settingsMap.company_name || 'Quincaillerie'}*.\n\n` +
      `💳 *Solde dû :* ${new Intl.NumberFormat('fr-FR').format(customer.balance)} FCFA\n\n` +
      `Merci de régulariser votre situation. Pour tout renseignement, contactez-nous.\n\n` +
      `Cordialement.`;

    await this.sendTextMessage({ to: customer.whatsapp, message, recipientId: customerId, recipientType: 'customer' });
  }

  async getHistory(query: any) {
    const { customerId, supplierId, status, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.whatsappMessage.findMany({
        where, skip, take: Number(limit),
        include: { customer: { select: { name: true } }, supplier: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.whatsappMessage.count({ where }),
    ]);

    return { data, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
  }

  async sendCustomMessage(to: string, message: string, recipientId?: string, recipientType?: 'customer' | 'supplier') {
    return this.sendTextMessage({ to, message, recipientId, recipientType });
  }
}
