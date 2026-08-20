import React, { useState, useEffect } from "react";
import useTwoFactorStore from "@renderer/stores/useTwoFactorStore";
import { Dialog } from "@renderer/components/UI/dialogs/Dialog";

const TwoFactorModal: React.FC = () => {
  const { isOpen, accountId, message, close } = useTwoFactorStore();
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!isOpen) setCode("");
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen} onClose={() => close(null)}>
      <div className="w-[420px] max-w-full p-6">
        <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">
          {message ??
            "Enter the verification code from your authenticator or email."}
        </p>

        {accountId && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-2">
            Account: {accountId}
          </p>
        )}

        <div className="mt-4">
          <input
            autoFocus
            className="w-full p-2 rounded bg-[var(--color-bg-muted)] border border-[var(--color-border)]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") close(code.trim() || null);
              if (e.key === "Escape") close(null);
            }}
            placeholder="123456"
            inputMode="numeric"
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => close(null)}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => close(code.trim() || null)}
          >
            Submit
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default TwoFactorModal;
