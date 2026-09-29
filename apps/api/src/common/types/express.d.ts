import 'express';
import type { Role } from '@commerceos/shared';

declare global {
  namespace Express {
    interface Request {
      validated: Record<string, unknown>;
      auth?: { userId: string; role: Role };
    }
  }
}
