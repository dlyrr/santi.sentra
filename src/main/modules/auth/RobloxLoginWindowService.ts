import { hostCall, hostCallWithTimeout } from "../../../sidecar/bridge";
import { UserAgentService } from "./UserAgentService";

/**
 * Roblox browser windows.
 *
 * Under Electron this file built `BrowserWindow` + `BrowserView` trees on named
 * session partitions and watched for a `cookies.on("changed")` event. Tauri has
 * no equivalent of either, so the windows themselves are created on the Rust
 * side (`src-tauri/src/roblox_window.rs`) and this class is now the part that
 * still belongs in Node: choosing the user agent, and deciding which account.
 *
 * The public contract is unchanged, including the `LOGIN_WINDOW_CLOSED` error
 * the renderer already handles, so nothing calling this had to change.
 */
export class RobloxLoginWindowService {
  private static pendingLogin: Promise<string> | null = null;

  /**
   * A login waits on a person: reading email, 2FA, sometimes a captcha. The
   * generic host-call budget is 30s, which cancelled the attempt while the
   * window was still open. Kept below the Rust sidecar call timeout so the
   * window's own timeout is what reports first.
   */
  private static readonly LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

  /**
   * Opens a Roblox login window and resolves with the account's
   * `.ROBLOSECURITY` cookie.
   *
   * Rejects with `LOGIN_WINDOW_CLOSED` if the user closes the window first.
   */
  static async openLoginWindow(): Promise<string> {
    // Single-flight, as before: two windows racing for the same cookie would
    // leave one of them hanging until it timed out.
    if (this.pendingLogin) return this.pendingLogin;

    this.pendingLogin = hostCallWithTimeout<string>(
      "roblox:open-login",
      this.LOGIN_TIMEOUT_MS,
      { userAgent: this.getRealisticUserAgent() },
    ).finally(() => {
      this.pendingLogin = null;
    });

    return this.pendingLogin;
  }

  /**
   * Opens an authenticated Roblox session for an account that is already saved.
   * The cookie is injected before the first navigation, so the window never
   * shows a logged-out frame.
   */
  static async openBrowserWithAccount(
    cookie: string,
    url: string = "https://www.roblox.com/home",
    windowWidth?: number,
    windowHeight?: number,
  ): Promise<void> {
    if (!cookie) {
      throw new Error("Account not found or cookie unavailable");
    }

    await hostCall<null>("roblox:open-browser", {
      cookie,
      url,
      width: windowWidth,
      height: windowHeight,
      userAgent: this.getRealisticUserAgent(),
    });
  }

  /**
   * Not ported.
   *
   * The account generator does not just want a window — it wants the window
   * object, its webContents and its session partition, so it can drive form
   * automation through `executeJavaScript` and read cookies straight off the
   * partition. That is an Electron-object-passing API with no Tauri
   * counterpart; replacing it means redesigning the generator's automation
   * around injected scripts and host calls, which is its own piece of work.
   *
   * See MIGRATION.md, "Account generator signup browser".
   */
  static async openSignupBrowser(
    _windowWidth?: number,
    _windowHeight?: number,
  ): Promise<{
    // The declared shape is kept so GeneratorService still type-checks against
    // the call site it will need again once this is rebuilt.
    browserWindow: unknown;
    pageUrl: string;
    webContents: unknown;
    partition: string;
  }> {
    throw new Error(
      "The automated signup browser is not available in the Tauri shell. " +
        "Account generation needs its automation redesigned; see MIGRATION.md.",
    );
  }

  private static getRealisticUserAgent(): string {
    try {
      return UserAgentService.getCurrentUserAgent();
    } catch (error) {
      // Settings may not be readable yet; a blank UA just means the webview
      // keeps its default, which is still a real browser string.
      console.warn("[RobloxLoginWindow] Could not resolve a user agent:", error);
      return "";
    }
  }
}
