export interface MacroEvent {
  type: "mouse" | "keyboard";
  action: string;
  timestamp: number;
  x?: number;
  y?: number;
  key?: string;
  modifiers?: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
}

export interface Macro {
  id: string;
  name: string;
  description?: string;
  events: MacroEvent[];
  duration: number;
  createdAt: number;
  updatedAt: number;
  targetWindow?: string;
  loopCount?: number;
  metadata?: Record<string, unknown>;
}

export interface MacroRecorderConfig {
  captureMouseMovement: boolean;
  captureMouseClicks: boolean;
  captureKeyboard: boolean;
  mouseMoveThrottleMs?: number;
  ignoreKeys?: string[];
}

export interface MacroPlaybackConfig {
  targetWindow?: string;
  speedMultiplier?: number;
  loopCount?: number;
  stopOnError?: boolean;
  eventDelayMs?: number;
}

export interface MacroRecordingState {
  isRecording: boolean;
  startTime: number;
  events: MacroEvent[];
  lastTimestamp: number;
}

export interface MacroPlaybackState {
  isPlaying: boolean;
  currentEventIndex: number;
  currentLoop: number;
  startTime: number;
  pausedTime?: number;
}

export type MacroRecordingCallback = (
  state: MacroRecordingState,
  event: MacroEvent,
) => void;
export type MacroPlaybackCallback = (
  state: MacroPlaybackState,
  event: MacroEvent,
) => void;

export interface MacroPlaybackResult {
  success: boolean;
  totalEvents: number;
  eventsPlayed: number;
  duration: number;
  error?: Error;
}
