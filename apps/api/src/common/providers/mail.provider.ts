import type { Logger } from 'pino';
import nodemailer from 'nodemailer';
import type { Env } from '@api/config/env.js';

export interface MailProvider {
  sendPasswordReset(to: string, url: string): Promise<void>;
  sendOrderConfirmation(to: string, orderNumber: string, url: string): Promise<void>;
  sendOrderShipped(
    to: string,
    orderNumber: string,
    carrier: string,
    tracking: string,
  ): Promise<void>;
}

export function createMailProvider(config: Env, logger: Logger): MailProvider {
  if (config.MAIL_TRANSPORT === 'console') {
    return {
      sendOrderShipped(to, orderNumber, carrier, tracking) {
        logger.info({ to, orderNumber, carrier, tracking }, 'Order shipped email');
        return Promise.resolve();
      },
      sendOrderConfirmation(to, orderNumber, url) {
        logger.info({ to, orderNumber, orderUrl: url }, 'Order confirmation email');
        return Promise.resolve();
      },
      sendPasswordReset(to, url) {
        logger.info({ to, resetUrl: url }, 'Password reset email');
        return Promise.resolve();
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });
  return {
    async sendOrderShipped(to, orderNumber, carrier, tracking) {
      await transport.sendMail({
        from: config.SMTP_USER ?? 'noreply@commerceos.local',
        to,
        subject: `Order ${orderNumber} shipped`,
        text: `Your order ${orderNumber} shipped with ${carrier}. Tracking number: ${tracking}.`,
      });
    },
    async sendOrderConfirmation(to, orderNumber, url) {
      await transport.sendMail({
        from: config.SMTP_USER ?? 'noreply@commerceos.local',
        to,
        subject: `Order ${orderNumber} confirmed`,
        text: `Your order ${orderNumber} has been received. View your items, shipping and payment details: ${url}`,
      });
    },
    async sendPasswordReset(to, url) {
      await transport.sendMail({
        from: config.SMTP_USER ?? 'noreply@commerceos.local',
        to,
        subject: 'Reset your password',
        text: `Use this link within one hour to reset your password: ${url}`,
      });
    },
  };
}
