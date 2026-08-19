import React, { useCallback, memo } from "react";
import { Info, Clock, Star } from "lucide-react";
import { Account } from "@renderer/types";
import CustomCheckbox from "@renderer/components/UI/buttons/CustomCheckbox";
import StatusBadge from "@renderer/components/UI/display/StatusBadge";
import {
  getStatusBorderColor,
  getStatusColor,
} from "@renderer/utils/statusUtils";
import { timeAgo } from "@renderer/utils/timeUtils";
import { Card } from "@renderer/components/UI/display/Card";
import { Button } from "@renderer/components/UI/buttons/Button";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@renderer/components/UI/display/Avatar";
import { RobuxIcon } from "@renderer/components/UI/icons/RobuxIcon";
import { formatNumber } from "@renderer/utils/numberUtils";

interface AccountGridViewProps {
  accounts: Account[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onMenuOpen: (e: React.MouseEvent, id: string) => void;
  onInfoOpen: (e: React.MouseEvent, account: Account) => void;
  onMoveAccount?: (fromId: string, toId: string) => void;
  voiceBanInfo?: Record<string, { message: string; endsAt?: number }>;
  privacyMode?: boolean;
}

interface AccountGridCardProps {
  account: Account;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onMenuOpen: (e: React.MouseEvent, id: string) => void;
  onInfoOpen: (e: React.MouseEvent, account: Account) => void;
  draggable: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  voiceBanInfo?: { message: string; endsAt?: number };
  privacyMode?: boolean;
}

const AccountGridCard = memo(
  ({
    account,
    isSelected,
    onToggleSelect,
    onMenuOpen,
    onInfoOpen,
    draggable,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    voiceBanInfo,
    privacyMode,
  }: AccountGridCardProps) => {
    const age = account.age;
    return (
      <Card
        selected={isSelected}
        variant="account"
        draggable={draggable}
        onDragStart={(e) => onDragStart(e, account.id)}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, account.id)}
        onClick={() => onToggleSelect(account.id)}
        onContextMenu={(e) => onMenuOpen(e, account.id)}
        className={[
          "relative group cursor-pointer flex flex-col h-[230px]",
          "transition-[transform,box-shadow,border-color,background-color] duration-150",
          "hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:-translate-y-0.5",
          "[&[data-dragging]]:opacity-50 [&[data-dragging]]:scale-95",
        ].join(" ")}
      >
        {}
        {isSelected && (
          <div className="absolute inset-0 bg-[var(--accent-color-faint)] pointer-events-none z-0" />
        )}

        {}
        {account.cookieInvalid && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 z-30" />
        )}

        {}
        <div className="relative h-24 w-full bg-[var(--color-surface-hover)] border-b border-[var(--color-border-subtle)] shrink-0 overflow-hidden">
          <img
            src={account.avatarUrl}
            alt=""
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
            style={
              privacyMode
                ? { filter: "blur(16px)" }
                : { objectPosition: "center 20%" }
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface)] via-transparent to-transparent opacity-90" />

          {}
          <div
            className="absolute top-2 right-2 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <CustomCheckbox
              checked={isSelected}
              onChange={() => onToggleSelect(account.id)}
            />
          </div>

          <Button
            variant="ghost"
            size="iconSm"
            onClick={(e) => {
              e.stopPropagation();
              onInfoOpen(e, account);
            }}
            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg h-7 w-7 bg-black/40 hover:bg-black/60 z-20 text-white backdrop-blur-sm"
          >
            <Info size={14} />
          </Button>

          {}
          <span
            className={[
              "absolute bottom-2 right-2 w-3.5 h-3.5 border-[2.5px] rounded-full z-20",
              getStatusBorderColor(account.status),
              getStatusColor(account.status),
              account.status === "Online" ||
              account.status === "In-Game" ||
              account.status === "In Studio"
                ? "status-dot-pulse"
                : "",
            ].join(" ")}
            style={{ borderColor: "var(--color-surface)" }}
          />
        </div>

        {}
        <div className="relative z-10 flex flex-col flex-1 px-3 pt-2 pb-3">
          <div className="flex items-center gap-1 mb-0.5 w-full">
            <h3
              className="text-[13px] font-bold truncate text-[var(--color-text-primary)] tracking-tight"
              title={account.displayName}
            >
              {account.displayName}
            </h3>
            {account.isPremium && (
              <span className="shrink-0 inline-flex items-center justify-center rounded-[4px] border border-amber-400/25 bg-amber-500/10 px-0.5 py-[1px]">
                <Star
                  size={10}
                  className="text-amber-300 shrink-0 select-none fill-current"
                />
              </span>
            )}
            {age && (
              <span
                className="shrink-0 text-[9px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-muted)] border border-[var(--color-border-subtle)] rounded px-1 ml-auto leading-4"
                title={`${age} years old`}
              >
                {age}y
              </span>
            )}
          </div>

          <p
            className="text-[11px] text-[var(--color-text-muted)] mb-2 truncate w-full"
            style={privacyMode ? { filter: "blur(16px)" } : undefined}
          >
            @{account.username}
          </p>

          <div className="mt-auto">
            {account.cookieInvalid && (
              <span className="text-[10px] font-bold text-red-500 flex items-center gap-1 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />{" "}
                Invalid Cookie
              </span>
            )}

            <div className="mb-2.5">
              <StatusBadge status={account.status} />
              {voiceBanInfo && (
                <span className="text-[9px] text-red-400 block mt-1 leading-tight">
                  {voiceBanInfo.message}
                </span>
              )}
            </div>

            {}
            <div className="w-full pt-2.5 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px]">
              {account.robuxBalance > 0 ? (
                <div className="flex items-center gap-1">
                  <RobuxIcon className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span
                    className="font-semibold text-[var(--color-text-primary)]"
                    style={privacyMode ? { filter: "blur(16px)" } : undefined}
                  >
                    {formatNumber(account.robuxBalance)}
                  </span>
                </div>
              ) : (
                <span
                  className="text-[var(--color-text-muted)] font-mono truncate max-w-[60px]"
                  style={privacyMode ? { filter: "blur(16px)" } : undefined}
                >
                  {account.userId}
                </span>
              )}
              <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                <Clock size={10} strokeWidth={2} />
                <span>{timeAgo(account.lastActive)}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  },
);

const AccountGridView = ({
  accounts,
  selectedIds,
  onToggleSelect,
  onMenuOpen,
  onInfoOpen,
  onMoveAccount,
  voiceBanInfo,
  privacyMode,
}: AccountGridViewProps) => {
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).setAttribute("data-dragging", "true");
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).removeAttribute("data-dragging");
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (onMoveAccount) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }
    },
    [onMoveAccount],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      if (!onMoveAccount) return;
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain");
      if (sourceId && sourceId !== targetId) {
        onMoveAccount(sourceId, targetId);
      }
    },
    [onMoveAccount],
  );

  const isIdSelected = (id: string): boolean => selectedIds.has(id);

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 pb-4">
        {accounts.map((account) => (
          <AccountGridCard
            key={account.id}
            account={account}
            isSelected={isIdSelected(account.id)}
            onToggleSelect={onToggleSelect}
            onMenuOpen={onMenuOpen}
            onInfoOpen={onInfoOpen}
            draggable={!!onMoveAccount}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            voiceBanInfo={voiceBanInfo?.[account.id]}
            privacyMode={privacyMode}
          />
        ))}
      </div>
    </div>
  );
};

export default AccountGridView;
