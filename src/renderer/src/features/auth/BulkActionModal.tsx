import React, { useState, useEffect } from "react";
import { UserPlus, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/UI/dialogs/Dialog";
import { Button } from "../../components/UI/buttons/Button";

interface BulkActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: "addFriend" | "joinGroup";
  onSubmit: (targetId: number) => void;
  isProcessing: boolean;
  selectedCount: number;
}

const BulkActionModal: React.FC<BulkActionModalProps> = ({
  isOpen,
  onClose,
  actionType,
  onSubmit,
  isProcessing,
  selectedCount,
}) => {
  const [targetIdStr, setTargetIdStr] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTargetIdStr("");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(targetIdStr, 10);
    if (isNaN(id) || id <= 0) return;
    onSubmit(id);
  };

  const isFriend = actionType === "addFriend";
  const Icon = isFriend ? UserPlus : Users;
  const title = isFriend ? "Bulk Add Friend" : "Bulk Join Group";
  const placeholder = isFriend
    ? "Enter target User ID..."
    : "Enter target Group ID...";

  return (
    <Dialog isOpen={isOpen} onClose={isProcessing ? () => {} : onClose}>
      <DialogContent className="max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${isFriend ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"}`}
            >
              <Icon size={24} />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-[var(--color-text-primary)]">
                {title}
              </DialogTitle>
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                Execute this action for {selectedCount} selected account
                {selectedCount === 1 ? "" : "s"}.
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              {isFriend ? "User ID" : "Group ID"}
            </label>
            <input
              type="number"
              min="1"
              value={targetIdStr}
              onChange={(e) => setTargetIdStr(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2.5 bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-strong)] focus:border-[var(--color-border-strong)]"
              autoFocus
              disabled={isProcessing}
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
              className="px-5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isProcessing || !targetIdStr.trim()}
              className={`px-5 ${isFriend ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"} text-[var(--color-text-primary)] border-transparent`}
            >
              {isProcessing
                ? "Processing..."
                : isFriend
                  ? "Add Friend"
                  : "Join Group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkActionModal;
