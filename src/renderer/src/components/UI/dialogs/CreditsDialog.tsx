import React from "react";
import { Heart, Github, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogBody,
} from "./Dialog";

interface Credit {
  name: string;
  role: string;
  link?: string;
}

interface CreditsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const credits: Credit[] = [
  {
    name: "experimentid",
    role: "Lead developer",
    link: "https://github.com/ex9d",
  },
];

const CreditsDialog: React.FC<CreditsDialogProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pl-0">
            <Heart size={20} className="text-red-400" />
            Credits
          </DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogBody className="p-4">
          {credits.length > 0 ? (
            <div className="space-y-3">
              {credits.map((credit, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--color-text-primary)] text-sm truncate">
                      {credit.name}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] truncate">
                      {credit.role}
                    </div>
                  </div>
                  {credit.link && (
                    <a
                      href={credit.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors ml-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {credit.link.includes("github") ? (
                        <Github size={16} />
                      ) : (
                        <ExternalLink size={16} />
                      )}
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Heart
                size={32}
                className="mx-auto text-[var(--color-text-muted)] mb-3"
              />
              <p className="text-[var(--color-text-secondary)] text-sm">
                No credits added yet.
              </p>
              <p className="text-[var(--color-text-muted)] text-xs mt-1">
                Edit CreditsDialog.tsx to add contributors.
              </p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <p className="text-center text-xs text-[var(--color-text-muted)]">
              Currently solo project by experimentid.{" "}
              <span role="img" aria-label="heart">
                ❤️
              </span>
            </p>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default CreditsDialog;
