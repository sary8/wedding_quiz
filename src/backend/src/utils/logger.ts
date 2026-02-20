const LogLevel = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
} as const;

type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

function formatMessage(
  level: LogLevel,
  message: string,
  ctx?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}][${level}] ${message}`;
  if (ctx && Object.keys(ctx).length > 0) {
    return `${base} ${JSON.stringify(ctx)}`;
  }
  return base;
}

export const logger = {
  info(message: string, ctx?: Record<string, unknown>): void {
    console.log(formatMessage(LogLevel.INFO, message, ctx));
  },
  warn(message: string, ctx?: Record<string, unknown>): void {
    console.log(formatMessage(LogLevel.WARN, message, ctx));
  },
  error(message: string, ctx?: Record<string, unknown>): void {
    console.error(formatMessage(LogLevel.ERROR, message, ctx));
  },
};
