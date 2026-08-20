import { net } from "electron";
import { z } from "zod";
import { hbaManager } from "./hbaManager";

interface RequestOptions {
  method?: string;
  url: string;
  cookie?: string;
  body?: any;
  headers?: Record<string, string>;
  returnHeaders?: boolean;
}

export class RequestError extends Error {
  statusCode?: number;
  headers?: Record<string, string | string[]>;
  body?: string;

  constructor(
    message: string,
    statusCode?: number,
    headers?: Record<string, string | string[]>,
    body?: string,
  ) {
    super(message);
    this.name = "RequestError";
    this.statusCode = statusCode;
    this.headers = headers;
    this.body = body;
  }
}

const ALLOWED_HOST_SUFFIXES = [".roblox.com", ".rbxcdn.com", ".roblox.games"];

export function isAllowedRobloxHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "roblox.com" || ALLOWED_HOST_SUFFIXES.some((s) => h.endsWith(s));
}

const FETCH_TIMEOUT_MS = 30000;
const MAX_TEXT_BYTES = 64 * 1024 * 1024;
const MAX_BUFFER_BYTES = 256 * 1024 * 1024;

export const safeRequest = <T>(options: RequestOptions): Promise<T> => {
  return new Promise((resolve, reject) => {
    const method = options.method || "GET";

    const request = net.request({
      method,
      url: options.url,
    });

    const credentialHeaderNames: string[] = [];
    let currentHost = "";
    try {
      currentHost = new URL(options.url).host;
    } catch {}

    const timeout = setTimeout(() => {
      request.abort();
      reject(new RequestError("Request timed out", 408));
    }, 30000);

    const clearTimeoutSafely = () => {
      clearTimeout(timeout);
    };

    request.on("redirect", (_status, _method, redirectUrl) => {
      let target: URL;
      try {
        target = new URL(redirectUrl);
      } catch {
        clearTimeoutSafely();
        request.abort();
        reject(new RequestError(`Invalid redirect target: ${redirectUrl}`));
        return;
      }

      if (target.protocol !== "https:" || !isAllowedRobloxHost(target.host)) {
        clearTimeoutSafely();
        request.abort();
        reject(
          new RequestError(
            `Blocked redirect to disallowed host: ${target.host}`,
          ),
        );
        return;
      }

      if (target.host !== currentHost) {
        for (const name of credentialHeaderNames) {
          try {
            request.removeHeader(name);
          } catch {}
        }
        credentialHeaderNames.length = 0;
        currentHost = target.host;
      }

      request.followRedirect();
    });

    request.on("response", (response) => {
      let data = "";
      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        clearTimeoutSafely();
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            const result = data ? JSON.parse(data) : {};

            if (options.returnHeaders) {
              resolve({
                data: result,
                headers: response.headers,
              } as unknown as T);
            } else {
              resolve(result);
            }
          } catch {
            reject(
              new RequestError(
                `Failed to parse response from ${options.url}`,
                response.statusCode,
              ),
            );
          }
        } else {
          reject(
            new RequestError(
              `Request failed with status code ${response.statusCode}`,
              response.statusCode,
              response.headers,
              data || undefined,
            ),
          );
        }
      });

      response.on("error", (error) => {
        clearTimeoutSafely();
        reject(error);
      });
    });

    request.on("error", (error) => {
      clearTimeoutSafely();
      reject(error);
    });

    const send = async () => {
      if (options.cookie) {
        request.setHeader("Cookie", `.ROBLOSECURITY=${options.cookie}`);
        credentialHeaderNames.push("Cookie");
        try {
          const hbaHeaders = await hbaManager.getHeaders(
            options.cookie,
            options.url,
            method,
          );
          Object.entries(hbaHeaders).forEach(([key, value]) => {
            request.setHeader(key, value);
            credentialHeaderNames.push(key);
          });
        } catch (error) {
          console.error("Failed to generate HBA headers:", error);
        }
      }

      request.setHeader("Content-Type", "application/json");
      request.setHeader(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );

      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          request.setHeader(key, value);
        });
      }

      if (options.body) {
        request.write(JSON.stringify(options.body));
      }

      request.end();
    };

    void send().catch((error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
};

export const safeFetchText = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: "GET",
      url,
    });

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn();
    };

    const timeout = setTimeout(() => {
      request.abort();
      finish(() => reject(new RequestError("Request timed out", 408)));
    }, FETCH_TIMEOUT_MS);

    request.on("response", (response) => {
      let data = "";
      let bytes = 0;

      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_TEXT_BYTES) {
          request.abort();
          finish(() =>
            reject(
              new RequestError(
                `Response exceeded ${MAX_TEXT_BYTES} byte limit`,
              ),
            ),
          );
          return;
        }
        data += chunk;
      });

      response.on("end", () => {
        finish(() => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(data);
          } else {
            reject(
              new RequestError(
                `Request failed with status code ${response.statusCode}`,
                response.statusCode,
                response.headers,
                data,
              ),
            );
          }
        });
      });

      response.on("error", (error) => {
        finish(() => reject(error));
      });
    });

    request.on("error", (error) => {
      finish(() => reject(error));
    });

    request.end();
  });
};

export const safeFetchBuffer = (url: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: "GET",
      url,
    });

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn();
    };

    const timeout = setTimeout(() => {
      request.abort();
      finish(() => reject(new RequestError("Request timed out", 408)));
    }, FETCH_TIMEOUT_MS);

    request.on("response", (response) => {
      const chunks: Buffer[] = [];
      let bytes = 0;

      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BUFFER_BYTES) {
          request.abort();
          finish(() =>
            reject(
              new RequestError(
                `Response exceeded ${MAX_BUFFER_BYTES} byte limit`,
              ),
            ),
          );
          return;
        }
        chunks.push(chunk);
      });

      response.on("end", () => {
        finish(() => {
          const buffer = Buffer.concat(chunks);
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(buffer);
          } else {
            reject(
              new RequestError(
                `Request failed with status code ${response.statusCode}`,
                response.statusCode,
                response.headers,
                buffer.toString("utf-8"),
              ),
            );
          }
        });
      });

      response.on("error", (error) => {
        finish(() => reject(error));
      });
    });

    request.on("error", (error) => {
      finish(() => reject(error));
    });

    request.end();
  });
};

export const request = async <T>(
  schema: z.ZodType<T>,
  options: RequestOptions,
): Promise<T> => {
  const data = await safeRequest<unknown>(options);
  return schema.parse(data);
};

export const requestWithCsrf = async <T>(
  schema: z.ZodType<T>,
  options: RequestOptions,
): Promise<T> => {
  try {
    const data = await safeRequest<unknown>(options);
    return schema.parse(data);
  } catch (error) {
    if (
      error instanceof RequestError &&
      error.statusCode === 403 &&
      error.headers
    ) {
      const token = error.headers["x-csrf-token"];
      if (token) {
        const csrfToken = Array.isArray(token) ? token[0] : (token as string);
        const data = await safeRequest<unknown>({
          ...options,
          headers: {
            ...options.headers,
            "x-csrf-token": csrfToken,
          },
        });
        return schema.parse(data);
      }
    }
    throw error;
  }
};
