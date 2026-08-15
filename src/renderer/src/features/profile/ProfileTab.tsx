import React, { useState, memo } from "react";
import { Account } from "@renderer/types";
import UserProfileView from "./UserProfileView";
import UniversalProfileModal from "@renderer/components/Modals/UniversalProfileModal";

interface ProfileTabProps {
  account: Account;
  privacyMode: boolean;
  onJoinGame?: (
    placeId: number | string,
    jobId?: string,
    userId?: number | string,
  ) => void;
}

const ProfileTab: React.FC<ProfileTabProps> = memo(
  ({ account, privacyMode, onJoinGame }) => {
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

    if (!account.userId || !account.cookie) {
      return (
        <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] bg-[var(--color-surface)]">
          Account data missing
        </div>
      );
    }

    return (
      <div className="absolute inset-0 flex flex-col w-full h-full bg-[var(--color-app-bg)] relative overflow-hidden font-sans text-[var(--color-text-secondary)]">
        {/* Compact Toolbar */}
        <div className="shrink-0 h-[72px] bg-[var(--color-surface-strong)] border-b border-[var(--color-border)] z-20 flex items-center px-6">
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">My Profile</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden">
            <UserProfileView
              userId={account.userId}
              requestCookie={account.cookie}
              accountUserId={account.userId}
              isOwnAccount={true}
              privacyMode={privacyMode}
              onSelectProfile={(id) => setSelectedUserId(id)}
              initialData={{
                displayName: account.displayName,
                username: account.username,
                avatarUrl: account.avatarUrl,
                status: account.status,
                notes: account.notes,
                joinDate: account.joinDate,
                placeVisits: account.placeVisits,
                friendCount: account.friendCount,
                followerCount: account.followerCount,
                followingCount: account.followingCount,
                isPremium: account.isPremium,
                isAdmin: account.isAdmin,
                totalFavorites: account.totalFavorites,
                concurrentPlayers: account.concurrentPlayers,
                groupMemberCount: account.groupMemberCount,
              }}
              onJoinGame={onJoinGame}
            />
          </div>
        </div>

        <UniversalProfileModal
          isOpen={!!selectedUserId}
          onClose={() => setSelectedUserId(null)}
          userId={selectedUserId}
          selectedAccount={account}
          onJoinGame={onJoinGame}
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if the account ID or cookie changed
    return (
      prevProps.account.id === nextProps.account.id &&
      prevProps.account.cookie === nextProps.account.cookie &&
      prevProps.onJoinGame === nextProps.onJoinGame &&
      prevProps.privacyMode === nextProps.privacyMode
    );
  },
);

export default ProfileTab;
