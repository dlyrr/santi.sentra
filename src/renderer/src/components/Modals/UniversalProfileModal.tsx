import React, { useState, useEffect, lazy, Suspense } from "react";
import type { Account, AccountStatus } from "@renderer/types";
import {
  Sheet,
  SheetContent,
  SheetHandle,
  SheetBody,
} from "@renderer/components/UI/dialogs/Sheet";

const UserProfileView = lazy(
  () => import("@renderer/features/profile/UserProfileView"),
);

interface UniversalProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | number | null;
  selectedAccount: Account | null; // Context for making API calls (needs a cookie)
  privacyMode?: boolean;
  initialData?: Partial<ExtendedProfile> | null; // Optional immediate data
  onJoinGame?: (
    placeId: number | string,
    jobId?: string,
    userId?: number | string,
  ) => void;
}

export interface ExtendedProfile {
  id: number;
  name: string; // username
  displayName: string;
  description: string;
  created: string;
  isBanned: boolean;
  externalAppDisplayName: string | null;

  // Stats
  followerCount: number;
  followingCount: number;
  friendCount: number;

  // Extended
  isPremium: boolean;
  isAdmin: boolean;
  avatarImageUrl: string | null; // Full body render
  headshotUrl: string | null;

  // Status
  status?: AccountStatus;
  lastLocation?: string;
}

const UniversalProfileModal: React.FC<UniversalProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  selectedAccount,
  privacyMode,
  initialData,
  onJoinGame,
}) => {
  const [activeUserId, setActiveUserId] = useState<string | number | null>(
    userId,
  );

  useEffect(() => {
    if (isOpen) {
      setActiveUserId(userId); // Reset/Update active user when modal opens or userId prop changes
    }
  }, [isOpen, userId]);

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <SheetContent className="h-full">
        <SheetHandle />
        <SheetBody>
          {activeUserId && selectedAccount?.cookie ? (
            <div
              key={activeUserId?.toString()}
              className="h-full w-full animate-profile-swap"
            >
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
                    Loading profile...
                  </div>
                }
              >
                <UserProfileView
                  userId={activeUserId}
                  requestCookie={selectedAccount.cookie}
                  accountUserId={selectedAccount.userId}
                  isOwnAccount={String(activeUserId) === selectedAccount.userId}
                  privacyMode={!!privacyMode}
                  onClose={onClose}
                  showCloseButton={false}
                  onSelectProfile={(id) => setActiveUserId(id)}
                  onJoinGame={onJoinGame}
                  initialData={
                    activeUserId === userId && initialData
                      ? {
                          displayName: initialData.displayName,
                          username: initialData.name,
                          avatarUrl: initialData.headshotUrl || undefined,
                          status: initialData.status,
                          joinDate: initialData.created,
                          friendCount: initialData.friendCount,
                          followerCount: initialData.followerCount,
                          followingCount: initialData.followingCount,
                          isPremium: initialData.isPremium,
                          isAdmin: initialData.isAdmin,
                        }
                      : undefined
                  }
                />
              </Suspense>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
              {selectedAccount?.cookie
                ? "No User Selected"
                : "Please select an account to view profiles"}
            </div>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
};

export default UniversalProfileModal;
