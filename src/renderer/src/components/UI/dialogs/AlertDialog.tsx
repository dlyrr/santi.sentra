import React from "react";
import {
  AlertCircle,
  CheckCircle,
  InfoIcon,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "./Dialog";
import { Button } from "@renderer/components/UI/buttons/Button";
import { cn } from "../../../lib/utils";

export interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "info" | "success" | "error" | "warning" | "confirm";
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  isDangerous?: boolean;
}

const typeConfig = {
  success: {
    icon: <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
    bannerClass: "bg-emerald-500/10 border-emerald-500/20",
  },
  error: {
    icon: <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
    bannerClass: "bg-red-500/10 border-red-500/20",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
    bannerClass: "bg-amber-500/10 border-amber-500/20",
  },
  info: {
    icon: (
      <InfoIcon className="w-5 h-5 text-[var(--accent-color)] flex-shrink-0" />
    ),
    bannerClass:
      "bg-[rgba(var(--accent-color-rgb),0.08)] border-[var(--accent-color-border)]",
  },
  confirm: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
    bannerClass: "bg-amber-500/10 border-amber-500/20",
  },
};

const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
  confirmText,
  cancelText = "Cancel",
  onConfirm,
  isDangerous = false,
}) => {
  const isConfirm = type === "confirm";
  const config = typeConfig[type];

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {config.icon}
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogClose />
        </DialogHeader>
        <DialogBody className="space-y-6">
          <div
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border",
              config.bannerClass,
            )}
          >
            <p className="text-sm text-[var(--color-text-secondary)]">
              {message}
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            {isConfirm && (
              <Button
                variant="secondary"
                onClick={onClose}
                className="flex-1 h-10"
              >
                {cancelText}
              </Button>
            )}
            <Button
              variant={isDangerous ? "destructive" : "default"}
              onClick={() => {
                onConfirm?.();
                onClose();
              }}
              className="flex-1 h-10"
            >
              {confirmText || (isConfirm ? "Confirm" : "OK")}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default AlertDialog;
