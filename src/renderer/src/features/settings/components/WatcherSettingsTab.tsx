import React, { useEffect, useState } from "react";
import { Activity, Shield, RotateCw, Monitor, Cpu } from "lucide-react";
import { motion } from "framer-motion";
import {
  BentoCard,
  BentoToggle,
  SectionDivider,
  PageHeader,
} from "./SharedComponents";

interface WatcherConfig {
  autoRestart?: boolean;
  enableRAMLimiter?: boolean;
  ramLimitMB?: number;
  enableClientTimeout?: boolean;
  clientTimeoutSeconds?: number;
  enableCPULimiter?: boolean;
  cpuLimitPercent?: number;
}

function NumericInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      className="w-24 px-2 py-1 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--accent-color)] transition-colors"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value) || value)}
    />
  );
}

export const WatcherSettingsTab: React.FC = () => {
  const [config, setConfig] = useState<WatcherConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api.watcher
      ?.getConfig()
      .then((c: WatcherConfig) => {
        setConfig(c);
        setLoading(false);
      })
      .catch((e: any) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const updateConfig = (patch: Partial<WatcherConfig>) => {
    if (!config) return;
    const newConfig = { ...config, ...patch };
    setConfig(newConfig);
    window.api.watcher?.setConfig(newConfig).catch(console.error);
  };

  if (loading || !config) {
    return (
      <div className="p-6 text-sm text-[var(--color-text-muted)] flex items-center gap-2">
        <div className="w-4 h-4 rounded-full border-2 border-[var(--accent-color)] border-t-transparent animate-spin" />
        Loading Watcher settings…
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="pb-10"
    >
      <div className="grid grid-cols-2 gap-4">
        <PageHeader
          title="Watcher"
          description="Configure automation and resource limits for Watcher sessions."
        />

        <SectionDivider label="Automation" />

        {}
        <BentoCard
          icon={<RotateCw size={16} />}
          title="Auto Restart"
          description="Automatically restart crashed sessions."
        >
          <BentoToggle
            checked={!!config.autoRestart}
            onChange={() => updateConfig({ autoRestart: !config.autoRestart })}
            label={config.autoRestart ? "Enabled" : "Disabled"}
          />
        </BentoCard>

        {}
        <BentoCard
          icon={<Activity size={16} />}
          title="Client Timeout"
          description="Kill and restart sessions that run too long."
        >
          <BentoToggle
            checked={!!config.enableClientTimeout}
            onChange={() =>
              updateConfig({ enableClientTimeout: !config.enableClientTimeout })
            }
            label={config.enableClientTimeout ? "Enabled" : "Disabled"}
          />
          {config.enableClientTimeout && (
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--color-border)]">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                Timeout (seconds)
              </span>
              <NumericInput
                value={config.clientTimeoutSeconds || 3600}
                min={60}
                onChange={(v) => updateConfig({ clientTimeoutSeconds: v })}
              />
            </div>
          )}
        </BentoCard>

        <SectionDivider label="Resource Limits" />

        {}
        <BentoCard
          icon={<Monitor size={16} />}
          title="RAM Limiter"
          description="Restrict memory usage for Watcher clients."
        >
          <BentoToggle
            checked={!!config.enableRAMLimiter}
            onChange={() =>
              updateConfig({ enableRAMLimiter: !config.enableRAMLimiter })
            }
            label={config.enableRAMLimiter ? "Enabled" : "Disabled"}
          />
          {config.enableRAMLimiter && (
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--color-border)]">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                Limit (MB)
              </span>
              <NumericInput
                value={config.ramLimitMB || 800}
                min={100}
                onChange={(v) => updateConfig({ ramLimitMB: v })}
              />
            </div>
          )}
        </BentoCard>

        {}
        <BentoCard
          icon={<Cpu size={16} />}
          title="CPU Limiter"
          description="Restrict CPU usage for Watcher clients."
        >
          <BentoToggle
            checked={!!config.enableCPULimiter}
            onChange={() =>
              updateConfig({ enableCPULimiter: !config.enableCPULimiter })
            }
            label={config.enableCPULimiter ? "Enabled" : "Disabled"}
          />
          {config.enableCPULimiter && (
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--color-border)]">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                Limit (%)
              </span>
              <NumericInput
                value={config.cpuLimitPercent || 80}
                min={5}
                max={100}
                onChange={(v) => updateConfig({ cpuLimitPercent: v })}
              />
            </div>
          )}
        </BentoCard>
      </div>
    </motion.div>
  );
};
