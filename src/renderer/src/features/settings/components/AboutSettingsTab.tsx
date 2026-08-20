import React, { useState } from "react";
import { motion } from "framer-motion";
import { Shield, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { UpdaterCard } from "../../updater";
import PrivacyPolicyModal from "../../../components/Modals/PrivacyPolicyModal";
import { BentoCard, SectionDivider, PageHeader } from "./SharedComponents";

export const AboutSettingsTab: React.FC = () => {
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  const handleLogout = async () => {
    if (
      !confirm(
        "Are you sure you want to logout? This will clear all local configuration data.",
      )
    )
      return;
    try {
      const res = await (window.api as any).logout();
      if (res && res.success) {
        try {
          localStorage.removeItem("onboarding-storage-v3");
          localStorage.removeItem("onboarding-storage");
        } catch {}
        window.location.reload();
      } else {
        alert("Logout failed: " + (res?.message || "Unknown error"));
      }
    } catch (err) {
      alert(
        "Logout error: " + (err instanceof Error ? err.message : String(err)),
      );
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="pb-10"
      >
        <div className="grid grid-cols-2 gap-4">
          <PageHeader
            title="About Sentra"
            description="System information, updates, and credits."
          />

          <SectionDivider label="Application" />

          <BentoCard
            colSpan={2}
            icon={<RefreshCw size={16} />}
            title="Updates"
            description="Check for and install the latest version of Sentra."
          >
            <UpdaterCard />
          </BentoCard>

          <SectionDivider label="Legal & Data" />

          <BentoCard
            colSpan={1}
            icon={<Shield size={16} />}
            title="Privacy Policy"
            description="Read about how we handle your data."
          >
            <button
              onClick={() => setIsPrivacyModalOpen(true)}
              className="w-full py-2 px-4 rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-muted)] text-sm font-medium text-[var(--color-text-primary)] transition-colors border border-[var(--color-border)] flex items-center justify-center gap-2"
            >
              <ExternalLink size={14} />
              View Privacy Policy
            </button>
          </BentoCard>

          <BentoCard
            colSpan={1}
            icon={<AlertTriangle size={16} />}
            title="Clear Local Data"
            description="Erase all config and return to login. This cannot be undone."
            accent="danger"
          >
            <button
              onClick={handleLogout}
              className="w-full py-2 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors border border-red-500/30 flex items-center justify-center gap-2"
            >
              <AlertTriangle size={14} />
              Clear Data & Logout
            </button>
          </BentoCard>
        </div>
      </motion.div>

      <PrivacyPolicyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />
    </>
  );
};
