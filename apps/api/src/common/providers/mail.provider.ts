import type { Logger } from 'pino';
import nodemailer from 'nodemailer';
import type { Env } from '@api/config/env.js';

export interface MailProvider {
  sendPasswordReset(to: string, url: string): Promise<void>;
}

export function createMailProvider(config: Env, logger: Logger): MailProvider {
  if (config.MAIL_TRANSPORT === 'console') {
    return {
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
