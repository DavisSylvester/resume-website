import winston from 'winston';
import type { Logger } from 'winston';

export const createLogger = (level: string): Logger =>
  winston.createLogger({
    level,
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    defaultMeta: { service: 'activity-api' },
    transports: [new winston.transports.Console()],
  });
