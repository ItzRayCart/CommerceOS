import { z } from 'zod';

export const echoQuerySchema = z.strictObject({ message: z.string().trim().min(1).max(100) });
export type EchoQuery = z.infer<typeof echoQuerySchema>;
