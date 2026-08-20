import { EventEmitter } from "events";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { getDataFile } from "../../utils/paths";

export type MacroEvent = {
  type: "mousemove" | "click" | "keypress";
  x?: number;
  y?: number;
  button?: "left" | "right" | "middle";
  key?: string;
  delay?: number;
};

export type Macro = {
  id: string;
  name: string;
  description?: string;
  events: MacroEvent[];
  createdAt: number;
  updatedAt: number;
  timing: {
    totalDuration: number;
    eventCount: number;
  };
};

export class MacroService extends EventEmitter {
  private isRecording = false;
  private currentEvents: MacroEvent[] = [];
  private recordingStartTime = 0;
  private lastEventTime = 0;
  private macrosDir = getDataFile("macros");
  private builtInMacrosInitialized = false;

  constructor() {
    super();
    this.ensureMacrosDir();
  }

  private ensureMacrosDir() {
    const fs = require("fs");
    if (!fs.existsSync(this.macrosDir)) {
      fs.mkdirSync(this.macrosDir, { recursive: true });
    }
  }

  private static readonly BUILT_IN_MACROS = [
    {
      name: "Jump",
      description: "Press spacebar to jump",
      events: [
        { type: "keypress" as const, key: "space", delay: 50 },
        { type: "keypress" as const, key: "space", delay: 0 },
      ],
    },
    {
      name: "Move Forward",
      description: "Press W to move forward",
      events: [
        { type: "keypress" as const, key: "w", delay: 100 },
        { type: "keypress" as const, key: "w", delay: 0 },
      ],
    },
    {
      name: "Move Back",
      description: "Press S to move back",
      events: [
        { type: "keypress" as const, key: "s", delay: 100 },
        { type: "keypress" as const, key: "s", delay: 0 },
      ],
    },
    {
      name: "Move Left",
      description: "Press A to move left",
      events: [
        { type: "keypress" as const, key: "a", delay: 100 },
        { type: "keypress" as const, key: "a", delay: 0 },
      ],
    },
    {
      name: "Move Right",
      description: "Press D to move right",
      events: [
        { type: "keypress" as const, key: "d", delay: 100 },
        { type: "keypress" as const, key: "d", delay: 0 },
      ],
    },
    {
      name: "Sprint",
      description: "Hold Shift for sprint",
      events: [
        { type: "keypress" as const, key: "shift", delay: 500 },
        { type: "keypress" as const, key: "shift", delay: 0 },
      ],
    },
    {
      name: "Crouch",
      description: "Press C to crouch",
      events: [
        { type: "keypress" as const, key: "c", delay: 100 },
        { type: "keypress" as const, key: "c", delay: 0 },
      ],
    },
    {
      name: "Emote Dance 1",
      description: "Press E for first emote",
      events: [
        { type: "keypress" as const, key: "e", delay: 100 },
        { type: "keypress" as const, key: "e", delay: 0 },
      ],
    },
  ];

  private ensureBuiltInMacros(): void {
    if (this.builtInMacrosInitialized) {
      return;
    }

    const fs = require("fs");
    const existingNames = new Set<string>();

    if (fs.existsSync(this.macrosDir)) {
      try {
        const files = fs.readdirSync(this.macrosDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            try {
              const data = readFileSync(join(this.macrosDir, file), "utf-8");
              const macro = JSON.parse(data) as Macro;
              existingNames.add(macro.name);
            } catch (err) {}
          }
        }
      } catch (err) {
        console.warn("[Macro] Error reading macros directory:", err);
      }
    }

    for (const builtIn of MacroService.BUILT_IN_MACROS) {
      if (!existingNames.has(builtIn.name)) {
        console.log(`[Macro] Creating built-in macro: ${builtIn.name}`);
        this.saveMacro(builtIn.name, builtIn.events, builtIn.description);
      }
    }

    this.builtInMacrosInitialized = true;
  }

  startRecording(): void {
    if (this.isRecording) {
      console.warn("[Macro] Already recording");
      return;
    }

    this.isRecording = true;
    this.currentEvents = [];
    this.recordingStartTime = Date.now();
    this.lastEventTime = this.recordingStartTime;

    console.log("[Macro] Recording started");
    this.emit("recording-started");
  }

  stopRecording(): MacroEvent[] {
    if (!this.isRecording) {
      console.warn("[Macro] Not recording");
      return [];
    }

    this.isRecording = false;
    const events = [...this.currentEvents];
    this.currentEvents = [];

    console.log(`[Macro] Recording stopped with ${events.length} events`);
    this.emit("recording-stopped", events);

    return events;
  }

  recordMouseMove(x: number, y: number): void {
    if (!this.isRecording) return;

    const now = Date.now();
    const delay = Math.max(0, now - this.lastEventTime);
    this.lastEventTime = now;

    this.currentEvents.push({
      type: "mousemove",
      x,
      y,
      delay,
    });
  }

  recordClick(button: "left" | "right" | "middle" = "left"): void {
    if (!this.isRecording) return;

    const now = Date.now();
    const delay = Math.max(0, now - this.lastEventTime);
    this.lastEventTime = now;

    this.currentEvents.push({
      type: "click",
      button,
      delay,
    });
  }

  recordKeyPress(key: string): void {
    if (!this.isRecording) return;

    const now = Date.now();
    const delay = Math.max(0, now - this.lastEventTime);
    this.lastEventTime = now;

    this.currentEvents.push({
      type: "keypress",
      key,
      delay,
    });
  }

  saveMacro(name: string, events: MacroEvent[], description?: string): Macro {
    const id = `macro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const totalDuration = events.reduce(
      (sum, evt) => sum + (evt.delay || 0),
      0,
    );

    const macro: Macro = {
      id,
      name,
      description,
      events,
      createdAt: now,
      updatedAt: now,
      timing: {
        totalDuration,
        eventCount: events.length,
      },
    };

    const filePath = join(this.macrosDir, `${id}.json`);
    writeFileSync(filePath, JSON.stringify(macro, null, 2));

    console.log(
      `[Macro] Saved macro "${name}" (${events.length} events, ${totalDuration}ms)`,
    );
    this.emit("macro-saved", macro);

    return macro;
  }

  loadMacro(macroId: string): Macro | null {
    const filePath = join(this.macrosDir, `${macroId}.json`);

    if (!existsSync(filePath)) {
      console.warn(`[Macro] Macro not found: ${macroId}`);
      return null;
    }

    try {
      const data = readFileSync(filePath, "utf-8");
      const macro = JSON.parse(data) as Macro;
      console.log(`[Macro] Loaded macro "${macro.name}"`);
      return macro;
    } catch (err) {
      console.error(`[Macro] Failed to load macro:`, err);
      return null;
    }
  }

  listMacros(): Macro[] {
    this.ensureBuiltInMacros();

    const fs = require("fs");

    if (!fs.existsSync(this.macrosDir)) {
      return [];
    }

    const files = fs.readdirSync(this.macrosDir);
    const macros: Macro[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const data = readFileSync(join(this.macrosDir, file), "utf-8");
          const macro = JSON.parse(data) as Macro;
          macros.push(macro);
        } catch (err) {
          console.error(`[Macro] Failed to parse ${file}:`, err);
        }
      }
    }

    return macros;
  }

  deleteMacro(macroId: string): boolean {
    const fs = require("fs");
    const filePath = join(this.macrosDir, `${macroId}.json`);

    if (!fs.existsSync(filePath)) {
      console.warn(`[Macro] Macro not found: ${macroId}`);
      return false;
    }

    try {
      fs.unlinkSync(filePath);
      console.log(`[Macro] Deleted macro: ${macroId}`);
      this.emit("macro-deleted", macroId);
      return true;
    } catch (err) {
      console.error(`[Macro] Failed to delete macro:`, err);
      return false;
    }
  }

  async playMacro(
    macro: Macro,
    targetWindowIds?: number[],
    speed: number = 1.0,
  ): Promise<void> {
    console.log(
      `[Macro] Starting playback: "${macro.name}" at ${speed}x speed`,
    );
    this.emit("macro-started", macro.id);

    try {
      for (const event of macro.events) {
        const delayMs = Math.max(0, Math.round((event.delay || 0) / speed));

        await this.simulateInput(event);

        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      console.log(`[Macro] Completed playback: "${macro.name}"`);
      this.emit("macro-completed", macro.id);
    } catch (err) {
      console.error(`[Macro] Playback error:`, err);
      this.emit("macro-error", { macroId: macro.id, error: String(err) });
    }
  }

  private async simulateInput(event: MacroEvent): Promise<void> {
    try {
      console.log(`[Macro] Would simulate: ${JSON.stringify(event)}`);
      console.log(
        `[Macro] Note: Install robotjs and uncomment simulateInput() to enable actual input`,
      );
    } catch (err) {
      console.error(`[Macro] Input simulation error:`, err);
      console.warn(
        `[Macro] Install robotjs to enable input simulation: npm install robotjs`,
      );
    }
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  getRecordingProgress(): { eventCount: number; duration: number } {
    return {
      eventCount: this.currentEvents.length,
      duration: Date.now() - this.recordingStartTime,
    };
  }
}

export const macroService = new MacroService();
