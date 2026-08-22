import React, { useState, useEffect } from "react";
import { Sliders, Type, Bell, Shield, Info } from "lucide-react";
import { motion } from "framer-motion";
import { Account, Settings } from "../../types";
import { cn } from "../../lib/utils";

import { GeneralSettingsTab } from "./components/GeneralSettingsTab";
import { AppearanceSettingsTab } from "./components/AppearanceSettingsTab";
import { NotificationsSettingsTab } from "./components/NotificationsSettingsTab";
import { SecuritySettingsTab } from "./components/SecuritySettingsTab";
import { AboutSettingsTab } from "./components/AboutSettingsTab";

interface SettingsTabProps {
  accounts: Account[];
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
  accounts,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<
    "general" | "appearance" | "notifications" | "security" | "about"
  >(() => {
    try {
      const saved = localStorage.getItem("sentra-settings-active-tab");
      if (
        saved &&
        [
          "general",
          "appearance",
          "notifications",
          "security",
          "about",
        ].includes(saved)
      ) {
        return saved as any;
      }
    } catch {}
    return "general";
  });

  useEffect(() => {
    try {
      localStorage.setItem("sentra-settings-active-tab", activeTab);
    } catch {}
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full bg-transparent text-[var(--color-text-secondary)] relative overflow-hidden">
      <div className="shrink-0 h-[72px] bg-transparent flex items-center justify-between px-6 z-20">
        <div className="max-w-3xl mx-auto w-full">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            Settings
          </h2>
        </div>
      </div>

      {}
      <div className="shrink-0 pt-6 px-6 pb-4 z-10 sticky top-0 bg-[var(--color-app-bg)]/85 backdrop-blur-xl border-b border-[var(--color-border)]/30">
        <div className="max-w-3xl mx-auto flex justify-center">
          <div className="flex items-center gap-1.5 p-1.5 bg-[var(--color-surface-strong)]/60 backdrop-blur-md border border-[var(--color-border)]/50 rounded-2xl shadow-xl shadow-black/10">
            {[
              { id: "general", label: "General", icon: Sliders },
              { id: "appearance", label: "Appearance", icon: Type },
              { id: "notifications", label: "Notifications", icon: Bell },
              { id: "security", label: "Security", icon: Shield },
              { id: "about", label: "About", icon: Info },
            ].map((tab) => {
              const Icon = tab.icon as any;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors outline-none",
                    isActive
                      ? "text-[var(--accent-color-foreground)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="settings-active-tab"
                      className="absolute inset-0 bg-[var(--accent-color)] rounded-xl shadow-md shadow-[var(--accent-color)]/20"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-2">
                    <Icon size={16} />
                    {tab.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="max-w-3xl mx-auto pb-8">
          {activeTab === "general" && (
            <GeneralSettingsTab
              accounts={accounts}
              settings={settings}
              onUpdateSettings={onUpdateSettings}
            />
          )}
          {activeTab === "appearance" && <AppearanceSettingsTab />}
          {activeTab === "notifications" && <NotificationsSettingsTab />}
          {activeTab === "security" && (
            <SecuritySettingsTab
              accounts={accounts}
              settings={settings}
              onUpdateSettings={onUpdateSettings}
            />
          )}
          {activeTab === "about" && <AboutSettingsTab />}
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
