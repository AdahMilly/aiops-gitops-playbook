type LogLevel = "info" | "success" | "warn" | "error" | "debug";

const isDevelopment = process.env.NODE_ENV !== "production";

const timestamp = (): string =>
  new Date().toISOString().replace("T", " ").replace("Z", "");
const prefix = (level: LogLevel): string => {
  const labels: Record<LogLevel, string> = {
    info: "INFO",
    success: " OK ",
    warn: "WARN",
    error: " ERR ",
    debug: "DEBUG",
  };
  return `[${timestamp()}] [${labels[level]}]`;
};
const write = (level: LogLevel, message: string, ...args: unknown[]): void => {
  const output = `${prefix(level)} ${message}`;
  switch (level) {
    case "error":
      console.error(output, ...args);
      break;
    case "warn":
      console.warn(output, ...args);
      break;
    case "debug":
      if (isDevelopment) {
        console.debug(output, ...args);
      }
      break;
    default:
      console.info(output, ...args);
  }
};
const divider = (character = "─", length = 72): string =>
  character.repeat(length);
export const logger = {
  info(message: string, ...args: unknown[]): void {
    write("info", message, ...args);
  },
  success(message: string, ...args: unknown[]): void {
    write("success", message, ...args);
  },
  warn(message: string, ...args: unknown[]): void {
    write("warn", message, ...args);
  },
  error(message: string, ...args: unknown[]): void {
    write("error", message, ...args);
  },
  debug(message: string, ...args: unknown[]): void {
    write("debug", message, ...args);
  },
  section(title: string): void {
    console.info("");
    console.info(divider());
    console.info(`  ${title.toUpperCase()}`);
    console.info(divider());
  },
  subsection(title: string): void {
    console.info("");
    console.info(`  ${title}`);
    console.info(divider("─", 48));
  },
  item(message: string): void {
    console.info(`  • ${message}`);
  },
  step(message: string): void {
    console.info(`  → ${message}`);
  },
  table(data: unknown): void {
    console.table(data);
  },
  data(data: unknown): void {
    console.dir(data, { depth: null });
  },
  blank(): void {
    console.info("");
  },
};
