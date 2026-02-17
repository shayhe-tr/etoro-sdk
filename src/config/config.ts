import { configSchema, type EToroConfig, type EToroConfigInput } from './config.schema';
import { EToroValidationError } from '../errors/validation-error';
import type { Logger } from '../utils/logger';

export type { EToroConfig } from './config.schema';

export interface EToroConfigWithLogger extends EToroConfig {
  logger?: Logger;
}

export function createConfig(overrides?: Partial<EToroConfigInput> & { logger?: Logger }): EToroConfigWithLogger {
  const raw = {
    apiKey: overrides?.apiKey ?? process.env.ETORO_API_KEY ?? '',
    userKey: overrides?.userKey ?? process.env.ETORO_USER_KEY ?? '',
    mode: overrides?.mode ?? (process.env.ETORO_MODE as 'demo' | 'real' | undefined) ?? 'demo',
    baseUrl: overrides?.baseUrl ?? process.env.ETORO_BASE_URL ?? 'https://public-api.etoro.com',
    wsUrl: overrides?.wsUrl ?? process.env.ETORO_WS_URL ?? 'wss://ws.etoro.com/ws',
    timeout: overrides?.timeout ?? 30_000,
    retryAttempts: overrides?.retryAttempts ?? 3,
    retryDelay: overrides?.retryDelay ?? 1_000,
  };

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new EToroValidationError(`Invalid configuration: ${issues}`);
  }

  return {
    ...result.data,
    logger: overrides?.logger,
  };
}
