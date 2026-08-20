import { Logger, ConsoleLogHandler, LogLevel } from "./shared/index";

import { TradingAnalyzerFactory } from "./trading";
import { BrowserAutomationServiceFactory } from "./browser";

const ProxyManagerFactory = {
  create: (_config?: unknown) => null,
};

export function initializeModules(config?: {
  enableLogging?: boolean;
  logLevel?: LogLevel | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  tradingConfig?: any;
  proxyConfig?: any;
}) {
  if (config?.enableLogging !== false) {
    Logger.addHandler(ConsoleLogHandler);
    const level = (config?.logLevel as LogLevel) || LogLevel.INFO;
    Logger.setMinLevel(level);
  }

  const logger = new Logger("ModuleInitializer");
  logger.info("Initializing application modules");

  const modules = {
    trading: TradingAnalyzerFactory.create(config?.tradingConfig || {}),
    browser: BrowserAutomationServiceFactory.create(),
    proxy: ProxyManagerFactory.create(config?.proxyConfig || {}),
  };

  logger.info("All modules initialized successfully");

  return modules;
}

export function getModules() {
  return {
    trading: TradingAnalyzerFactory.create(),
    browser: BrowserAutomationServiceFactory.create(),
    proxy: ProxyManagerFactory.create(),
  };
}

export * from "./trading";
export * from "./browser";
export * from "./shared";
