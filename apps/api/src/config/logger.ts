import pino from 'pino';
import type { Logger } from 'pino';

export function createLogger(level: string): Logger {
  return pino({
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.currentPassword',
        'req.body.newPassword',
        'req.body.token',
        'req.body.cardNumber',
        'req.body.cvc',
        'res.headers.set-cookie',
      ],
      censor: '[Redacted]',
    },
  });
}
