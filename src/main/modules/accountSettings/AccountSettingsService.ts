import {
  accountSettingsJsonSchema,
  userSettingsAndOptionsSchema,
  descriptionResponseSchema,
  genderResponseSchema,
  birthdateResponseSchema,
  promotionChannelsResponseSchema,
  type AccountSettingsJson,
  type UserSettingsAndOptions,
  type PrivacyLevel,
  type TradePrivacy,
  type TradeValue,
  type ContentRestrictionLevel,
  type RedeemPromoCodeResponse,
  type DescriptionResponse,
  type GenderResponse,
  type BirthdateResponse,
  type PromotionChannelsResponse,
  type OnlineStatusPrivacy,
  accountStandingResponseSchema,
  type AccountStandingResponse,
} from "@shared/ipc-schemas/accountSettings";

const ACCOUNT_SETTINGS_API_URL = "https://accountsettings.roblox.com/v1";
const ACCOUNT_INFO_API_URL = "https://accountinformation.roblox.com/v1";
const ROBLOX_BASE_URL = "https://www.roblox.com";
const USER_SETTINGS_API_URL =
  "https://apis.roblox.com/user-settings-api/v1/user-settings";
const BILLING_API_URL = "https://billing.roblox.com/v1";

async function getCsrfToken(cookie: string, maxAttempts = 3): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let response: Response;
    try {
      response = await fetch("https://auth.roblox.com/v2/login", {
        method: "POST",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
      continue;
    }

    const token = response.headers.get("x-csrf-token");
    if (token) {
      return token;
    }

    if (response.status === 401) {
      throw new Error(
        "Roblox rejected the session cookie (401) while fetching a CSRF token; the account may need to be re-authenticated",
      );
    }

    lastError = new Error(
      `No x-csrf-token header returned (status ${response.status})`,
    );
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError);
  console.error(
    "[AccountSettingsService] Failed to fetch CSRF token:",
    lastError,
  );
  throw new Error(`Unable to obtain a CSRF token: ${detail}`);
}

export class AccountSettingsService {
  static async getAccountSettingsJson(
    cookie: string,
  ): Promise<AccountSettingsJson> {
    const response = await fetch(`${ROBLOX_BASE_URL}/my/settings/json`, {
      method: "GET",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch account settings: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return accountSettingsJsonSchema.parse(data);
  }

  static async getUserSettingsAndOptions(
    cookie: string,
  ): Promise<UserSettingsAndOptions> {
    const response = await fetch(
      `${USER_SETTINGS_API_URL}/settings-and-options`,
      {
        method: "GET",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch user settings: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return userSettingsAndOptionsSchema.parse(data);
  }

  static async getCombinedSettings(cookie: string): Promise<{
    accountSettings: AccountSettingsJson;
    userSettings: UserSettingsAndOptions;
  }> {
    const [accountSettings, userSettings] = await Promise.all([
      this.getAccountSettingsJson(cookie),
      this.getUserSettingsAndOptions(cookie),
    ]);

    return { accountSettings, userSettings };
  }

  static async updateInventoryPrivacy(
    cookie: string,
    inventoryPrivacy: PrivacyLevel,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(
      `${ACCOUNT_SETTINGS_API_URL}/inventory-privacy`,
      {
        method: "POST",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
        },
        body: JSON.stringify({ inventoryPrivacy }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async updateTradePrivacy(
    cookie: string,
    tradePrivacy: TradePrivacy,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(`${ACCOUNT_SETTINGS_API_URL}/trade-privacy`, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({ tradePrivacy }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async updateTradeValue(
    cookie: string,
    tradeValue: TradeValue,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(`${ACCOUNT_SETTINGS_API_URL}/trade-value`, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({ tradeValue }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async updateAppChatPrivacy(
    cookie: string,
    appChatPrivacy: PrivacyLevel,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(
      `${ACCOUNT_SETTINGS_API_URL}/app-chat-privacy`,
      {
        method: "POST",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
        },
        body: JSON.stringify({ appChatPrivacy }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async updateGameChatPrivacy(
    cookie: string,
    gameChatPrivacy: PrivacyLevel,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(
      `${ACCOUNT_SETTINGS_API_URL}/game-chat-privacy`,
      {
        method: "POST",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
        },
        body: JSON.stringify({ gameChatPrivacy }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async updatePrivacy(
    cookie: string,
    phoneDiscovery: PrivacyLevel,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(`${ACCOUNT_SETTINGS_API_URL}/privacy`, {
      method: "PATCH",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({ phoneDiscovery }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async updateTheme(
    cookie: string,
    userId: number,
    themeType: string,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(
      `${ACCOUNT_SETTINGS_API_URL}/themes/User/${userId}`,
      {
        method: "PATCH",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
        },
        body: JSON.stringify({ themeType }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async updateContentRestriction(
    cookie: string,
    contentRestrictionLevel: ContentRestrictionLevel,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(
      `${ACCOUNT_SETTINGS_API_URL}/content-restriction`,
      {
        method: "POST",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
        },
        body: JSON.stringify({ contentRestrictionLevel }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async updateOnlineStatusPrivacy(
    cookie: string,
    whoCanSeeMyOnlineStatus: OnlineStatusPrivacy,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(`${USER_SETTINGS_API_URL}?_rosealRequest=`, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({ whoCanSeeMyOnlineStatus }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async updateWhoCanJoinMeInExperiences(
    cookie: string,
    whoCanJoinMeInExperiences: PrivacyLevel,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(`${USER_SETTINGS_API_URL}?_rosealRequest=`, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({ whoCanJoinMeInExperiences }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async sendVerificationEmail(
    cookie: string,
    freeItem = false,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(`${ACCOUNT_SETTINGS_API_URL}/email/verify`, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({ freeItem }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async updateEmail(
    cookie: string,
    email: string,
    challengeMetadata?: string,
    challengeId?: string,
    challengeType?: string,
  ): Promise<{ success: boolean; error?: string; challenge?: any }> {
    const csrfToken = await getCsrfToken(cookie);
    try {
      const headers: Record<string, string> = {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      };

      if (challengeMetadata && challengeId && challengeType) {
        headers["rblx-challenge-id"] = challengeId;
        headers["rblx-challenge-type"] = challengeType;
        headers["rblx-challenge-metadata"] = challengeMetadata;
      }

      const response = await fetch(`${ACCOUNT_SETTINGS_API_URL}/email`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ emailAddress: email, password: "" }),
      });

      if (!response.ok) {
        const resChallengeId = response.headers.get("rblx-challenge-id");
        const resChallengeType = response.headers.get("rblx-challenge-type");
        const resChallengeMetadata = response.headers.get(
          "rblx-challenge-metadata",
        );

        if (resChallengeId && resChallengeType) {
          return {
            success: false,
            challenge: {
              id: resChallengeId,
              type: resChallengeType,
              metadata: resChallengeMetadata,
            },
          };
        }

        const err = await response.json().catch(() => ({}));
        return {
          success: false,
          error: err.errors?.[0]?.message || response.statusText,
        };
      }

      return { success: true };
    } catch (error) {
      console.error("[AccountSettingsService] Failed to update email:", error);
      return {
        success: false,
        error: (error as Error).message || String(error),
      };
    }
  }

  static async updateUsername(
    cookie: string,
    userId: number,
    newUsername: string,
    challengeMetadata?: string,
    challengeId?: string,
    challengeType?: string,
  ): Promise<{ success: boolean; error?: string; challenge?: any }> {
    const csrfToken = await getCsrfToken(cookie);
    try {
      const headers: Record<string, string> = {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      };

      if (challengeMetadata && challengeId && challengeType) {
        headers["rblx-challenge-id"] = challengeId;
        headers["rblx-challenge-type"] = challengeType;
        headers["rblx-challenge-metadata"] = challengeMetadata;
      }

      const response = await fetch(
        `https://users.roblox.com/v1/users/${userId}/username`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ newUsername, password: "" }),
        },
      );

      if (!response.ok) {
        const resChallengeId = response.headers.get("rblx-challenge-id");
        const resChallengeType = response.headers.get("rblx-challenge-type");
        const resChallengeMetadata = response.headers.get(
          "rblx-challenge-metadata",
        );

        if (resChallengeId && resChallengeType) {
          return {
            success: false,
            challenge: {
              id: resChallengeId,
              type: resChallengeType,
              metadata: resChallengeMetadata,
            },
          };
        }

        const err = await response.json().catch(() => ({}));
        return {
          success: false,
          error: err.errors?.[0]?.message || response.statusText,
        };
      }

      return { success: true };
    } catch (error) {
      console.error(
        "[AccountSettingsService] Failed to update username:",
        error,
      );
      return {
        success: false,
        error: (error as Error).message || String(error),
      };
    }
  }

  static async toggleTwoStep(
    cookie: string,
    userId: number,
    enable: boolean,
    challengeMetadata?: string,
    challengeId?: string,
    challengeType?: string,
  ): Promise<{ success: boolean; error?: string; challenge?: any }> {
    const csrfToken = await getCsrfToken(cookie);
    try {
      const headers: Record<string, string> = {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      };

      if (challengeMetadata && challengeId && challengeType) {
        headers["rblx-challenge-id"] = challengeId;
        headers["rblx-challenge-type"] = challengeType;
        headers["rblx-challenge-metadata"] = challengeMetadata;
      }

      const response = await fetch(
        `https://twostepverification.roblox.com/v1/users/${userId}/challenges/authenticator/toggle`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ action: enable ? "Enable" : "Disable" }),
        },
      );

      if (!response.ok) {
        const resChallengeId = response.headers.get("rblx-challenge-id");
        const resChallengeType = response.headers.get("rblx-challenge-type");
        const resChallengeMetadata = response.headers.get(
          "rblx-challenge-metadata",
        );

        if (resChallengeId && resChallengeType) {
          return {
            success: false,
            challenge: {
              id: resChallengeId,
              type: resChallengeType,
              metadata: resChallengeMetadata,
            },
          };
        }

        const err = await response.json().catch(() => ({}));
        return {
          success: false,
          error: err.errors?.[0]?.message || response.statusText,
        };
      }

      return { success: true };
    } catch (error) {
      console.error(
        "[AccountSettingsService] Failed to toggle twostep:",
        error,
      );
      return {
        success: false,
        error: (error as Error).message || String(error),
      };
    }
  }

  static async verifyChallenge(
    cookie: string,
    challengeId: string,
    challengeType: string,
    metadata: string,
    code: string,
  ): Promise<{ success: boolean; verificationToken?: string; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    try {
      let decodedMetadata;
      try {
        decodedMetadata = JSON.parse(
          Buffer.from(metadata, "base64").toString("utf8"),
        );
      } catch (e) {
        decodedMetadata = {};
      }

      if (challengeType === "twostepverification") {
        const actionType = decodedMetadata.actionType || "Generic";
        const userId = decodedMetadata.userId || "0";

        let response = await fetch(
          `https://twostepverification.roblox.com/v1/users/${userId}/challenges/authenticator/verify`,
          {
            method: "POST",
            headers: {
              Cookie: `.ROBLOSECURITY=${cookie}`,
              "Content-Type": "application/json",
              "X-CSRF-TOKEN": csrfToken,
            },
            body: JSON.stringify({ challengeId, actionType, code }),
          },
        );

        let resData = await response.json().catch(() => ({}));
        if (!response.ok) {
          response = await fetch(
            `https://challenges.roblox.com/v1/twostepverification/verify`,
            {
              method: "POST",
              headers: {
                Cookie: `.ROBLOSECURITY=${cookie}`,
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": csrfToken,
              },
              body: JSON.stringify({ challengeId, actionType, code }),
            },
          );
          resData = await response.json().catch(() => ({}));
          if (!response.ok) {
            return {
              success: false,
              error: resData.errors?.[0]?.message || "Invalid code.",
            };
          }
        }

        return {
          success: true,
          verificationToken: resData.verificationToken || metadata,
        };
      }

      const response = await fetch(
        "https://challenges.roblox.com/v1/twostepverification/verify",
        {
          method: "POST",
          headers: {
            Cookie: `.ROBLOSECURITY=${cookie}`,
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": csrfToken,
          },
          body: JSON.stringify({ challengeId, actionType: "Generic", code }),
        },
      );
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: true, verificationToken: data.verificationToken };
      }
      return { success: false, error: "Failed to verify challenge" };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  static async getThemeTypes(cookie: string): Promise<string[]> {
    const response = await fetch(`${ACCOUNT_SETTINGS_API_URL}/themes/types`, {
      method: "GET",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch theme types: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.data || [];
  }

  static async redeemPromoCode(
    cookie: string,
    code: string,
  ): Promise<RedeemPromoCodeResponse> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(`${BILLING_API_URL}/promocodes/redeem`, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({ code }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        errorMsg:
          data.errorMsg ||
          data.message ||
          `Error ${response.status}: ${response.statusText}`,
      };
    }

    return {
      success: data.success ?? true,
      successMsg: data.successMsg,
      errorMsg: data.errorMsg,
    };
  }

  static async getDescription(cookie: string): Promise<DescriptionResponse> {
    const response = await fetch(`${ACCOUNT_INFO_API_URL}/description`, {
      method: "GET",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch description: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return descriptionResponseSchema.parse(data);
  }

  static async updateDescription(
    cookie: string,
    description: string,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(`${ACCOUNT_INFO_API_URL}/description`, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async getGender(cookie: string): Promise<GenderResponse> {
    const response = await fetch(`${ACCOUNT_INFO_API_URL}/gender`, {
      method: "GET",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch gender: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return genderResponseSchema.parse(data);
  }

  static async updateGender(
    cookie: string,
    gender: string,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(`${ACCOUNT_INFO_API_URL}/gender`, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({ gender }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async getBirthdate(cookie: string): Promise<BirthdateResponse> {
    const response = await fetch(`${ACCOUNT_INFO_API_URL}/birthdate`, {
      method: "GET",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch birthdate: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return birthdateResponseSchema.parse(data);
  }

  static async updateBirthdate(
    cookie: string,
    birthMonth: number,
    birthDay: number,
    birthYear: number,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(`${ACCOUNT_INFO_API_URL}/birthdate`, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({ birthMonth, birthDay, birthYear }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async getPromotionChannels(
    cookie: string,
  ): Promise<PromotionChannelsResponse> {
    const response = await fetch(`${ACCOUNT_INFO_API_URL}/promotion-channels`, {
      method: "GET",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch promotion channels: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return promotionChannelsResponseSchema.parse(data);
  }

  static async updatePromotionChannels(
    cookie: string,
    channels: {
      facebook?: string;
      twitter?: string;
      youtube?: string;
      twitch?: string;
      promotionChannelsVisibilityPrivacy?: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(`${ACCOUNT_INFO_API_URL}/promotion-channels`, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify(channels),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async getAccountStanding(
    cookie: string,
  ): Promise<AccountStandingResponse> {
    const response = await fetch(
      "https://usermoderation.roblox.com/v1/account-standing",
      {
        method: "GET",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch account standing: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return accountStandingResponseSchema.parse(data);
  }

  static async updateUserSetting(
    cookie: string,
    key: string,
    value: string,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const body: Record<string, any> = {};
    body[key] = value;

    const response = await fetch(`${USER_SETTINGS_API_URL}?_rosealRequest=`, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async updateDisplayName(
    cookie: string,
    userId: number,
    newDisplayName: string,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const response = await fetch(
      `https://users.roblox.com/v1/users/${userId}/display-names`,
      {
        method: "PATCH",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
        },
        body: JSON.stringify({ newDisplayName }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async signOutAllSessions(
    cookie: string,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);

    const response = await fetch(
      "https://auth.roblox.com/v1/authentication-ticket",
      {
        method: "POST",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrfToken,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async setPinEnabled(
    cookie: string,
    action: "lock" | "unlock",
    pin?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const csrfToken = await getCsrfToken(cookie);
    const url =
      action === "lock"
        ? "https://accountinformation.roblox.com/v1/users/authenticated/account-pin/lock"
        : "https://accountinformation.roblox.com/v1/users/authenticated/account-pin/unlock";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify({ pin }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.errors?.[0]?.message || response.statusText,
      };
    }
    return { success: true };
  }

  static async updateSuperSafePrivacyMode(
    cookie: string,
    enabled: boolean,
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateUserSetting(
      cookie,
      "UseSuperSafePrivacyMode",
      enabled.toString(),
    );
  }
}
