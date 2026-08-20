import { ipcMain } from "electron";
import { macroService, Macro } from "./MacroService";

export function registerMacroHandlers(): void {
  console.log("[MacroController] Registering handlers...");

  ipcMain.handle("macro:start-recording", () => {
    console.log("[MacroController] start-recording called");
    macroService.startRecording();
    return { success: true };
  });

  ipcMain.handle("macro:stop-recording", () => {
    const events = macroService.stopRecording();
    return { success: true, events };
  });

  ipcMain.handle("macro:record-mouse-move", (_event, x: number, y: number) => {
    macroService.recordMouseMove(x, y);
    return { success: true };
  });

  ipcMain.handle("macro:record-click", (_event, button?: string) => {
    macroService.recordClick((button || "left") as any);
    return { success: true };
  });

  ipcMain.handle("macro:record-keypress", (_event, key: string) => {
    macroService.recordKeyPress(key);
    return { success: true };
  });

  ipcMain.handle(
    "macro:save",
    (_event, name: string, events: any[], description?: string) => {
      const macro = macroService.saveMacro(name, events, description);
      return { success: true, macro };
    },
  );

  ipcMain.handle("macro:load", (_event, macroId: string) => {
    const macro = macroService.loadMacro(macroId);
    return macro
      ? { success: true, macro }
      : { success: false, error: "Macro not found" };
  });

  ipcMain.handle("macro:list", () => {
    const macros = macroService.listMacros();
    return { success: true, macros };
  });

  ipcMain.handle("macro:delete", (_event, macroId: string) => {
    const success = macroService.deleteMacro(macroId);
    return { success };
  });

  ipcMain.handle("macro:play", (_event, macroId: string, speed?: number) => {
    const macro = macroService.loadMacro(macroId);
    if (!macro) {
      return { success: false, error: "Macro not found" };
    }

    macroService.playMacro(macro, undefined, speed || 1.0).catch((err) => {
      console.error("[Macro] Playback error:", err);
    });

    return { success: true };
  });

  ipcMain.handle("macro:is-recording", () => {
    return { isRecording: macroService.isCurrentlyRecording() };
  });

  ipcMain.handle("macro:get-recording-progress", () => {
    return macroService.getRecordingProgress();
  });

  console.log("[MacroController] All handlers registered successfully");
}
