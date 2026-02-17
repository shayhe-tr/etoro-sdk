import { z } from 'zod';

export const configSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  userKey: z.string().min(1, 'User key is required'),
  mode: z.enum(['demo', 'real']).default('demo'),
  baseUrl: z.string().url().default('https://public-api.etoro.com'),
  wsUrl: z.string().default('wss://ws.etoro.com/ws'),
  timeout: z.number().positive().default(30_000),
  retryAttempts: z.number().int().min(0).default(3),
  retryDelay: z.number().positive().default(1_000),
});

export type EToroConfigInput = z.input<typeof configSchema>;
export type EToroConfig = z.output<typeof configSchema>;
