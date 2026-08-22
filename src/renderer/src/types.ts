export type TabId =
  | "Accounts"
  | "Profile"
  | "Friends"
  | "Groups"
  | "Games"
  | "Catalog"
  | "Inventory"
  | "Transactions"
  | "Logs"
  | "Settings"
  | "Avatar"
  | "Install"
  | "AccountSettings"
  | "Watcher"
  | "Macro"
  | "Sniper"
  | "Generator";

export enum AccountStatus {
  Online = "Online",
  Offline = "Offline",
  InGame = "In-Game",
  InStudio = "In Studio",
  Banned = "Banned",
}

export interface Account {
  id: string;
  displayName: string;
  username: string;
  userId: string;
  cookie?: string;
  password?: string;
  status: AccountStatus;
  notes: string;
  importedVia?: "browser" | "cookie" | "cookielist";
  avatarUrl: string;
  lastActive: string;
  robuxBalance: number;
  friendCount: number;
  followerCount: number;
  followingCount: number;
  isPremium?: boolean;
  isAdmin?: boolean;
  joinDate?: string;
  age?: number;
  placeVisits?: number;
  totalFavorites?: number;
  concurrentPlayers?: number;
  cookieInvalid?: boolean;
  groupMemberCount?: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface Friend {
  id: string;
  accountId: string;
  displayName: string;
  username: string;
  userId: string;
  avatarUrl: string;
  status: AccountStatus;
  description: string;
  gameActivity?: {
    name: string;
    placeId: string;
    jobId?: string;
  };
}

export enum JoinMethod {
  Username = "Username",
  PlaceId = "Place ID",
  JobId = "Job ID",
  Friend = "Friend",
  PrivateServer = "Private Server",
}

export interface JoinConfig {
  method: JoinMethod;
  target: string;
}

export interface Game {
  id: string;
  universeId: string;
  placeId: string;
  name: string;
  creatorName: string;
  creatorId: string;
  creatorType?: string;
  playing: number;
  visits: number;
  maxPlayers: number;
  genre: string;
  description: string;
  likes: number;
  dislikes: number;
  thumbnailUrl: string;
  created: string;
  updated: string;
  creatorHasVerifiedBadge: boolean;
  userVote?: boolean | null;

  ageRating?: string | null;
  supportedDevices?: string[];
  supportsVoiceChat?: boolean | null;
  lastServerJobId?: string | null;
  friendsPlayingCount?: number | null;
}

export interface GameServer {
  id: string;
  placeId: string;
  playing: number;
  maxPlayers: number;
  ping: number;
  fps: number;
  region: string;
}

export const DEFAULT_ACCENT_COLOR = "#e05c1a";

export type TintPreference =
  | "neutral"
  | "cool"
  | "warm"
  | "forest"
  | "twilight";

export type ThemePreference = "system" | "dark" | "light";

export interface Settings {
  primaryAccountId: string | null;
  allowMultipleInstances: boolean;
  multiInstanceMethod: "mutex" | "handle64";
  defaultInstallationPath?: string | null;
  accentColor: string;
  /** A named palette from the launcher's theme set; null uses the built-in theme. */
  themePreset: string | null;
  useDynamicAccentColor: boolean;
  tint: TintPreference;
  customTheme?: string;
  showSidebarProfileCard: boolean;
  privacyMode: boolean;
  sidebarTabOrder: TabId[];
  sidebarHiddenTabs: TabId[];
  pinCode: string | null;

  browserWindowWidth?: number | null;
  browserWindowHeight?: number | null;

  showReturnPageButton?: boolean;
  userAgentSettings?: {
    currentUserAgentIndex: number;
    autoSwapUserAgent: boolean;
    autoSwapIntervalMinutes: number;
  };

  antiAfkEnabled?: boolean;
  renameWindowsEnabled?: boolean;
  framerateCapEnabled?: boolean;
  framerateCapValue?: number;
  optimizeRamEnabled?: boolean;
  ramOptimization?: number;
  cpuOptimization?: number;

  defaultPhysicsEngine?: "Terrain" | "Legacy";
  enableOptimizations?: boolean;
  memoryLimit?: number;
  useDirectX12?: boolean;
  lowEndGraphics?: boolean;
  disableDualChannelAudio?: boolean;
  headlessModeEnabled?: boolean;
  timeoutRelaunchEnabled?: boolean;
  timeoutRelaunchSeconds?: number;

  windowLayoutEnabled?: boolean;
  windowLayoutPattern?: "grid" | "rows" | "columns" | "cascade";
  windowLayoutSpacing?: number;
  windowLayoutColumns?: number;
  windowLayoutWidth?: number;
  windowLayoutHeight?: number;

  catalogViewMode?: "default" | "compact";
  inventoryViewMode?: "default" | "compact";
  contentRadius?: "sharp" | "rounded" | "pill";
  navBorderStyle?: "solid" | "subtle" | "none";
  uiDensity?: "compact" | "default" | "relaxed";
  blurIntensity?: "light" | "medium" | "heavy";
  iconWeight?: "light" | "regular" | "bold";
  motionSpeed?: "none" | "fast" | "default" | "slow";
  fontWeight?: "light" | "regular" | "medium";

  isSidebarCollapsed?: boolean;
  navLayout?: "sidebar" | "topbar";
}

export type AccessoryType =
  | "Hat"
  | "Hair"
  | "Face"
  | "Neck"
  | "Shoulder"
  | "Front"
  | "Back"
  | "Waist"
  | "Gear";

export interface CatalogItem {
  id: string;
  name: string;
  type: AccessoryType;
  imageUrl: string;
  price?: number;
  creatorName?: string;
}

export enum BinaryType {
  WindowsPlayer = "WindowsPlayer",
  WindowsStudio = "WindowsStudio",
  MacPlayer = "MacPlayer",
  MacStudio = "MacStudio",
}

export interface RobloxInstallation {
  id: string;
  name: string;
  binaryType: BinaryType;
  version: string;
  channel: string;
  path: string;
  lastUpdated: string;
  status: "Ready" | "Updating" | "Error";
}

export interface CollectionItem {
  id: number;
  assetSeoUrl: string;
  thumbnail: {
    final: boolean;
    url: string;
    retryUrl: string | null;
    userId: number;
    endpointType: string;
  };
  name: string;
  formatName: string | null;
  description: string;
  assetRestrictionIcon: {
    tooltipText: string;
    cssTag: string;
    loadAssetRestrictionIconCss: boolean;
    hasTooltip: boolean;
  };
  hasPremiumBenefit: boolean;
  assetAttribution: any | null;
}
