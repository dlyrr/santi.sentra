/**
 * Stand-in for `electron-log`.
 *
 * The sidecar's stdout is the NDJSON wire, so every log line has to go to
 * stderr, where the Rust host picks it up and re-emits it through `log::warn`.
 */

type Args = unknown[];

const write = (level: string, args: Args) => {
  const rendered = args
    .map((arg) =>
      arg instanceof Error
        ? (arg.stack ?? arg.message)
        : typeof arg === "object"
          ? safeStringify(arg)
          : String(arg),
    )
    .join(" ");
  process.stderr.write(`[${level}] ${rendered}\n`);
};

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const log = {
  error: (...args: Args) => write("error", args),
  warn: (...args: Args) => write("warn", args),
  info: (...args: Args) => write("info", args),
  verbose: (...args: Args) => write("verbose", args),
  debug: (...args: Args) => write("debug", args),
  silly: (...args: Args) => write("silly", args),
  log: (...args: Args) => write("info", args),
  transports: {
    file: { level: "info", getFile: () => ({ path: "" }) },
    console: { level: "info" },
  },
  scope: () => log,
};

export default log;
