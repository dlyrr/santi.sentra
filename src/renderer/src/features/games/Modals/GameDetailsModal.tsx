import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  User,
  Users,
  Play,
  ThumbsUp,
  ThumbsDown,
  Globe,
  Info,
  Calendar,
  Clock,
  Gamepad2,
  Star,
  Twitter,
  Youtube,
  Twitch,
  Facebook,
  MessageCircle,
  ShoppingBag,
  Check,
  Server,
  Loader2,
  Lock,
  Shield,
  MonitorSmartphone,
  Link2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Account, Game, JoinMethod } from "@renderer/types";
import { RobuxIcon } from "@renderer/components/UI/icons/RobuxIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@renderer/components/UI/display/Tooltip";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@renderer/components/UI/dialogs/Dialog";

import { Button } from "@renderer/components/UI/buttons/Button";
import { SlidingNumber } from "@renderer/components/UI/specialized/SlidingNumber";
import { Tabs } from "@renderer/components/UI/navigation/Tabs";
import { formatNumber } from "@renderer/utils/numberUtils";
import { linkify } from "@renderer/utils/linkify";
import { cn } from "@renderer/lib/utils";
import ServersList from "../ServersView";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SocialLink, VoteResponse, GamePass } from "@shared/ipc-schemas/games";
import { useNotification } from "@renderer/features/system/stores/useSnackbarStore";
import FavoriteParticles from "@renderer/components/UI/specialized/FavoriteParticles";
import {
  useFavoriteGames,
  useAddFavoriteGame,
  useRemoveFavoriteGame,
} from "@renderer/hooks/queries";
import {
  PurchaseErrorDialog,
  PurchaseSuccessDialog,
} from "@renderer/features/avatar/components/AssetPricing";
import GameImageContextMenu from "./GameImageContextMenu";
import VerifiedIcon from "@renderer/components/UI/icons/VerifiedIcon";
import UniversalProfileModal from "@renderer/components/Modals/UniversalProfileModal";
import { GroupDetailsModal } from "@renderer/features/groups/Modals/GroupDetailsModal";

interface GameDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: (config: { method: JoinMethod; target: string }) => void;
  game: Game | null;
  account?: Account | null;
  onViewServers?: (placeId: string) => void;
}

const CAROUSEL_INTERVAL = 5000;

const getSocialIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case "twitter":
      return <Twitter size={20} className="text-[#1DA1F2]" />;
    case "youtube":
      return <Youtube size={20} className="text-[#FF0000]" />;
    case "twitch":
      return <Twitch size={20} className="text-[#9146FF]" />;
    case "facebook":
      return <Facebook size={20} className="text-[#1877F2]" />;
    case "discord":
      return <MessageCircle size={20} className="text-[#5865F2]" />;
    default:
      return <Globe size={20} className="text-[var(--color-text-secondary)]" />;
  }
};

const getPlatformName = (type: string): string => {
  const normalized = type.toLowerCase();
  if (normalized === "pc" || normalized === "desktop") return "PC";
  if (normalized === "mobile" || normalized === "phone") return "Mobile";
  if (normalized === "console") return "Console";
  if (normalized === "tablet") return "Tablet";
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

const GameDetailsModal: React.FC<GameDetailsModalProps> = ({
  isOpen,
  onClose,
  onLaunch,
  game,
  account,
}) => {
  const [displayedGame, setDisplayedGame] = useState<Game | null>(game);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<
    "info" | "servers" | "private" | "store"
  >("info");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedCreatorId, setSelectedCreatorId] = useState<
    string | number | null
  >(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const dragOffsetRef = useRef(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const { showNotification } = useNotification();

  const handleCreatorClick = () => {
    if (!displayedGame) return;

    if (displayedGame.creatorType === "Group") {
      setSelectedCreatorId(parseInt(displayedGame.creatorId, 10));
      setIsGroupModalOpen(true);
    } else {
      setSelectedCreatorId(displayedGame.creatorId);
      setIsProfileModalOpen(true);
    }
  };

  const queryClient = useQueryClient();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    imageUrl: string;
    gameName: string;
  } | null>(null);
  const [privateServerTarget, setPrivateServerTarget] = useState("");

  const { data: favorites = [] } = useFavoriteGames();
  const addFavoriteMutation = useAddFavoriteGame();
  const removeFavoriteMutation = useRemoveFavoriteGame();
  const [favoriteBurst, setFavoriteBurst] = useState(false);

  const isFavorite = displayedGame
    ? favorites.includes(displayedGame.placeId || displayedGame.id.toString())
    : false;

  const handleFavorite = async () => {
    if (!displayedGame) return;
    const placeId = displayedGame.placeId || displayedGame.id.toString();

    try {
      if (isFavorite) {
        await removeFavoriteMutation.mutateAsync(placeId);
        showNotification("Removed from favorites", "success");
      } else {
        setFavoriteBurst(true);
        await addFavoriteMutation.mutateAsync(placeId);
        showNotification("Added to favorites", "success");
        setTimeout(() => setFavoriteBurst(false), 1000);
      }
    } catch (error) {
      console.error("Failed to update favorites:", error);
      showNotification("Failed to update favorites", "error");
    }
  };

  const handleImageContextMenu = useCallback(
    (e: React.MouseEvent, imageUrl: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!displayedGame) return;
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        imageUrl,
        gameName: displayedGame.name,
      });
    },
    [displayedGame],
  );

  const handleSaveImage = useCallback(
    async (imageUrl: string, gameName: string) => {
      try {
        const result = await window.api.saveGameImage(imageUrl, gameName);
        if (result.success) {
          showNotification("Image saved successfully", "success");
        } else if (result.canceled) {
        } else {
          showNotification("Failed to save image", "error");
        }
      } catch (error) {
        console.error("Failed to save image:", error);
        showNotification("Failed to save image", "error");
      }
    },
    [showNotification],
  );

  const handleCopyLink = useCallback(async () => {
    if (!displayedGame) return;
    const link = `https://www.roblox.com/games/${displayedGame.placeId || displayedGame.id}`;

    try {
      await navigator.clipboard.writeText(link);
      showNotification("Game link copied to clipboard", "success");
    } catch (err) {
      console.error("Failed to copy link", err);
      showNotification("Failed to copy link", "error");
    }
  }, [displayedGame, showNotification]);

  const targetPlaceId = displayedGame?.placeId || displayedGame?.id;
  const lastServerJobId = displayedGame?.lastServerJobId ?? null;
  const hasFriendsPlaying = (displayedGame?.friendsPlayingCount ?? 0) > 0;

  const handleRejoinLastServer = useCallback(() => {
    if (!displayedGame || !targetPlaceId) return;
    if (!lastServerJobId) {
      showNotification("No recent server to rejoin", "info");
      return;
    }

    onLaunch({
      method: JoinMethod.JobId,
      target: `${targetPlaceId}:${lastServerJobId}`,
    });
    onClose();
  }, [
    displayedGame,
    lastServerJobId,
    onClose,
    onLaunch,
    showNotification,
    targetPlaceId,
  ]);

  const handleJoinFriends = useCallback(() => {
    if (!hasFriendsPlaying) {
      showNotification("No friends playing this game right now", "info");
      return;
    }

    setActiveTab("servers");
    showNotification("Jumped to Servers — look for friends online", "info");
  }, [hasFriendsPlaying, showNotification]);

  const { data: socialLinks } = useQuery({
    queryKey: ["gameSocialLinks", game?.universeId],
    queryFn: async () => {
      if (!game?.universeId) return [];
      return window.api.getGameSocialLinks(Number(game.universeId));
    },
    enabled: !!game?.universeId && isOpen,
  });

  const { data: gamePassesData, isLoading: _isLoadingPasses } = useQuery({
    queryKey: ["gamePasses", game?.universeId],
    queryFn: async () => {
      if (!game?.universeId) return { gamePasses: [], nextPageToken: null };
      return window.api.getGamePasses(Number(game.universeId));
    },
    enabled: !!game?.universeId && isOpen,
  });

  const gamePassesForSale =
    gamePassesData?.gamePasses?.filter(
      (p: GamePass) => p.isForSale && p.productId !== null,
    ) || [];
  const hasGamePasses = gamePassesForSale.length > 0;

  const voteMutation = useMutation({
    mutationFn: async ({ vote }: { vote: boolean }) => {
      if (!game?.universeId) throw new Error("No universe ID");
      return window.api.voteOnGame(Number(game.universeId), vote);
    },
    onSuccess: (data: VoteResponse) => {
      if (data.success) {
        showNotification(
          `Successfully ${data.model?.userVote ? "liked" : "disliked"} the game!`,
          "success",
        );

        if (data.model) {
          setDisplayedGame((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              likes: data.model?.upVotes ?? prev.likes,
              dislikes: data.model?.downVotes ?? prev.dislikes,
              userVote: data.model?.userVote,
            };
          });
        }

        queryClient.invalidateQueries({
          queryKey: ["gameDetails", game?.universeId],
        });
      } else if (data.modalType === "PlayGame") {
        showNotification("You must play the game before you can vote", "error");
      } else {
        showNotification(data.message || "Failed to vote on game", "error");
      }
    },
    onError: (error: any) => {
      console.error("Vote error:", error);
      showNotification("Failed to vote on game", "error");
    },
  });

  const startCarousel = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % Math.max(thumbnails.length, 1));
    }, CAROUSEL_INTERVAL);
  }, [thumbnails.length]);

  const showCarouselControls = thumbnails.length > 1;
  const canCarouselLeft = showCarouselControls && carouselIndex > 0;
  const canCarouselRight =
    showCarouselControls && carouselIndex < thumbnails.length - 1;

  const handleCarouselLeft = useCallback(() => {
    if (!showCarouselControls) return;
    setCarouselIndex((prev) => Math.max(prev - 1, 0));
    startCarousel();
  }, [showCarouselControls, startCarousel]);

  const handleCarouselRight = useCallback(() => {
    if (!showCarouselControls) return;
    setCarouselIndex((prev) => Math.min(prev + 1, thumbnails.length - 1));
    startCarousel();
  }, [showCarouselControls, startCarousel, thumbnails.length]);

  useEffect(() => {
    if (isOpen && thumbnails.length > 1) {
      startCarousel();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, thumbnails.length, startCarousel]);

  const finishDrag = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 100;
    const finalOffset = dragOffsetRef.current;
    let nextIndex = carouselIndex;

    if (finalOffset > threshold && carouselIndex > 0) {
      nextIndex = carouselIndex - 1;
    } else if (
      finalOffset < -threshold &&
      carouselIndex < thumbnails.length - 1
    ) {
      nextIndex = carouselIndex + 1;
    }

    dragOffsetRef.current = 0;

    if (carouselRef.current) {
      carouselRef.current.style.transition =
        "transform 500ms cubic-bezier(0.4, 0, 0.2, 1)";
      carouselRef.current.style.transform = `translateX(calc(-${nextIndex * 100}%))`;
    }

    setCarouselIndex(nextIndex);
    startCarousel();
  }, [carouselIndex, isDragging, startCarousel, thumbnails.length]);

  useEffect(() => {
    if (!isDragging && carouselRef.current) {
      carouselRef.current.style.transform = `translateX(calc(-${carouselIndex * 100}%))`;
    }
  }, [carouselIndex, isDragging]);

  useEffect(() => {
    if (!isOpen || !game?.universeId) return;

    const fetchStats = async () => {
      try {
        const games = await window.api.getGamesByUniverseIds([
          Number(game.universeId),
        ]);
        if (games && games.length > 0) {
          const details = games[0];
          setDisplayedGame((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              playing: details.playing ?? prev.playing,
              visits: details.visits ?? prev.visits,
            };
          });
        }
      } catch (error) {
        console.error("Failed to refresh game stats", error);
      }
    };

    const statsInterval = setInterval(fetchStats, 10000);
    return () => clearInterval(statsInterval);
  }, [isOpen, game]);

  useEffect(() => {
    if (game) {
      setDisplayedGame(game);
      setCarouselIndex(0);
      setActiveTab("info");

      setThumbnails(game.thumbnailUrl ? [game.thumbnailUrl] : []);

      if (game.universeId) {
        window.api
          .getGameThumbnail16x9(Number(game.universeId))
          .then((urls) => {
            if (urls && urls.length > 0) {
              setThumbnails(urls);
            }
          })
          .catch((err) => {
            console.error("Failed to fetch high-res thumbnails", err);
          });
      }
    }
  }, [game]);

  const totalVotes = displayedGame
    ? displayedGame.likes + displayedGame.dislikes
    : 0;
  const likePercentage =
    displayedGame && totalVotes > 0
      ? Math.round((displayedGame.likes / totalVotes) * 100)
      : 0;
  if (!displayedGame) return null;

  const ageRating = displayedGame.ageRating || "Not rated";
  const deviceNames =
    displayedGame.supportedDevices && displayedGame.supportedDevices.length > 0
      ? displayedGame.supportedDevices
          .map((device) => getPlatformName(device))
          .join(" / ")
      : "Unknown devices";

  return (
    <>
      <Dialog isOpen={isOpen} onClose={onClose}>
        <DialogContent className="flex flex-col w-full max-w-4xl p-0 bg-[var(--color-app-bg)] overflow-hidden max-h-[90vh]">
          {}
          <div className="relative w-full h-[320px] shrink-0 bg-black overflow-hidden group">
            {}
            <div
              className="absolute inset-0 flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
            >
              {thumbnails.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={displayedGame.name}
                  className="w-full h-full object-cover shrink-0 opacity-80"
                  onContextMenu={(e) => handleImageContextMenu(e, url)}
                  draggable={false}
                />
              ))}
            </div>

            {}
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/80 to-transparent z-10" />

            <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[var(--color-app-bg)] via-[var(--color-app-bg)]/80 to-transparent z-10" />

            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <button
                onClick={handleFavorite}
                className="w-8 h-8 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-black/60 transition-colors group/fav"
              >
                <Star
                  size={16}
                  className={cn(
                    "transition-all",
                    isFavorite
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-white group-hover/fav:text-yellow-400",
                  )}
                />
                <FavoriteParticles active={favoriteBurst} />
              </button>
              <DialogClose className="relative static w-8 h-8 rounded-full bg-black/40 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-black/60 transition-colors" />
            </div>

            {}
            {showCarouselControls && (
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={handleCarouselLeft}
                  className={cn(
                    "w-10 h-10 rounded-full bg-black/50 backdrop-blur border border-white/10 flex items-center justify-center text-white transition-colors hover:bg-black/80",
                    !canCarouselLeft && "invisible",
                  )}
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={handleCarouselRight}
                  className={cn(
                    "w-10 h-10 rounded-full bg-black/50 backdrop-blur border border-white/10 flex items-center justify-center text-white transition-colors hover:bg-black/80",
                    !canCarouselRight && "invisible",
                  )}
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            )}

            {}
            {thumbnails.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {thumbnails.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCarouselIndex(idx);
                      startCarousel();
                    }}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      idx === carouselIndex
                        ? "w-6 bg-white"
                        : "w-1.5 bg-white/40 hover:bg-white/60",
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {}
          <div className="flex-1 overflow-y-auto scrollbar-thin z-20 -mt-16 relative">
            <div className="px-6 sm:px-8 pb-8 max-w-4xl mx-auto space-y-6">
              {}
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end justify-between">
                <div className="space-y-2 flex-1">
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md leading-tight">
                    {displayedGame.name}
                  </h1>
                  <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                    <span className="text-sm font-medium flex items-center gap-1">
                      by{" "}
                      <button
                        onClick={handleCreatorClick}
                        className={cn(
                          "hover:underline focus:outline-none transition-colors",
                          displayedGame.creatorHasVerifiedBadge
                            ? "text-[#5b9cf6] flex items-center gap-1"
                            : "text-white",
                        )}
                      >
                        {displayedGame.creatorName}
                        {displayedGame.creatorHasVerifiedBadge && (
                          <VerifiedIcon width={14} height={14} />
                        )}
                      </button>
                    </span>
                    <span className="text-white/30">•</span>
                    <span className="flex items-center gap-1 text-sm text-emerald-400 font-semibold drop-shadow-md">
                      <ThumbsUp size={14} /> {likePercentage}%
                    </span>
                    <span className="text-white/30">•</span>
                    <span className="flex items-center gap-1 text-sm text-[var(--color-text-primary)] font-medium drop-shadow-md">
                      <Users size={14} /> {formatNumber(displayedGame.playing)}{" "}
                      playing
                    </span>
                  </div>
                </div>

                {}
                <button
                  onClick={() => {
                    const targetId = displayedGame.placeId || displayedGame.id;
                    onLaunch({ method: JoinMethod.PlaceId, target: targetId });
                    onClose();
                  }}
                  className="w-full sm:w-auto shrink-0 bg-[rgba(var(--accent-color-rgb),0.95)] hover:bg-[var(--accent-color-muted)] text-[var(--accent-color-foreground)] font-bold text-lg py-3.5 px-8 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_var(--accent-color-shadow)] border border-[var(--accent-color-border)] hover:-translate-y-1"
                >
                  <Play fill="currentColor" size={20} />
                  <span>Play</span>
                </button>
              </div>

              {}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={handleJoinFriends}
                  className={cn(
                    "px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all",
                    hasFriendsPlaying
                      ? "bg-[rgba(var(--accent-color-rgb),0.1)] border-[rgba(var(--accent-color-rgb),0.3)] text-[var(--accent-color)] hover:bg-[rgba(var(--accent-color-rgb),0.15)]"
                      : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed",
                  )}
                >
                  <Users size={16} />
                  <span className="hidden sm:inline">
                    {hasFriendsPlaying ? "Join friends" : "No friends playing"}
                  </span>
                  <span className="sm:hidden">Friends</span>
                </button>
                <button
                  onClick={handleRejoinLastServer}
                  className={cn(
                    "px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all",
                    lastServerJobId
                      ? "bg-[var(--color-surface-hover)] border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-strong)]"
                      : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed",
                  )}
                >
                  <Clock size={16} />
                  <span className="hidden sm:inline">
                    {lastServerJobId
                      ? "Rejoin last server"
                      : "No recent server"}
                  </span>
                  <span className="sm:hidden">Rejoin</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Link2 size={16} />
                  <span className="hidden sm:inline">Copy link</span>
                  <span className="sm:hidden">Share</span>
                </button>
              </div>

              {}
              <div className="mt-8">
                <Tabs
                  tabs={[
                    { id: "info", label: "Overview", icon: Info },
                    { id: "servers", label: "Servers", icon: Server },
                    { id: "private", label: "Private", icon: Lock },
                    {
                      id: "store",
                      label: "Store",
                      icon: ShoppingBag,
                      hidden: !hasGamePasses,
                    },
                  ]}
                  activeTab={activeTab}
                  onTabChange={(tabId) =>
                    setActiveTab(
                      tabId as "info" | "servers" | "private" | "store",
                    )
                  }
                  layoutId="gameDetailsTabIndicator"
                />

                <div className="mt-6">
                  {activeTab === "info" ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col items-center justify-center text-center">
                          <Globe
                            size={18}
                            className="text-[var(--color-text-secondary)] mb-2"
                          />
                          <span className="text-xl font-bold text-[var(--color-text-primary)]">
                            <SlidingNumber
                              number={displayedGame.visits}
                              formatter={(n) => formatNumber(n)}
                            />
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mt-1">
                            Visits
                          </span>
                        </div>
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col items-center justify-center text-center">
                          <Users
                            size={18}
                            className="text-[var(--color-text-secondary)] mb-2"
                          />
                          <span className="text-xl font-bold text-[var(--color-text-primary)]">
                            <SlidingNumber
                              number={displayedGame.playing}
                              formatter={(n) => formatNumber(n)}
                            />
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mt-1">
                            Active
                          </span>
                        </div>
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col items-center justify-center text-center">
                          <Calendar
                            size={18}
                            className="text-[var(--color-text-secondary)] mb-2"
                          />
                          <span className="text-xl font-bold text-[var(--color-text-primary)]">
                            {displayedGame.created
                              ? new Date(displayedGame.created).getFullYear()
                              : "-"}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mt-1">
                            Created
                          </span>
                        </div>
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col justify-center">
                          <div className="flex justify-between items-end mb-2">
                            <button
                              onClick={() =>
                                voteMutation.mutate({ vote: true })
                              }
                              disabled={voteMutation.isPending}
                              className={cn(
                                "flex items-center gap-1.5 transition-colors group",
                                displayedGame.userVote === true
                                  ? "text-emerald-400"
                                  : "text-[var(--color-text-secondary)] hover:text-emerald-400",
                              )}
                            >
                              <ThumbsUp
                                size={16}
                                className={
                                  displayedGame.userVote === true
                                    ? "fill-current"
                                    : "group-hover:fill-current"
                                }
                              />
                              <span className="text-sm font-bold">
                                <SlidingNumber
                                  number={displayedGame.likes}
                                  formatter={(n) => formatNumber(n)}
                                />
                              </span>
                            </button>
                            <button
                              onClick={() =>
                                voteMutation.mutate({ vote: false })
                              }
                              disabled={voteMutation.isPending}
                              className={cn(
                                "flex items-center gap-1.5 transition-colors group",
                                displayedGame.userVote === false
                                  ? "text-red-400"
                                  : "text-[var(--color-text-secondary)] hover:text-red-400",
                              )}
                            >
                              <span className="text-sm font-bold">
                                <SlidingNumber
                                  number={displayedGame.dislikes}
                                  formatter={(n) => formatNumber(n)}
                                />
                              </span>
                              <ThumbsDown
                                size={16}
                                className={
                                  displayedGame.userVote === false
                                    ? "fill-current"
                                    : "group-hover:fill-current"
                                }
                              />
                            </button>
                          </div>
                          <div className="h-1.5 w-full bg-red-500/20 rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-500"
                              style={{ width: `${likePercentage}%` }}
                            />
                            <div className="h-full bg-red-500 transition-all duration-500 flex-1" />
                          </div>
                          <span className="text-[10px] text-[var(--color-text-muted)] text-center mt-2 uppercase tracking-wider font-semibold">
                            {likePercentage}% Rating
                          </span>
                        </div>
                      </div>

                      {}
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-text-primary)] border border-[var(--color-border)]">
                          <Gamepad2
                            size={13}
                            className="text-[var(--color-text-secondary)]"
                          />
                          {displayedGame.genre}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-text-primary)] border border-[var(--color-border)]">
                          <Shield
                            size={13}
                            className="text-[var(--color-text-secondary)]"
                          />
                          {ageRating}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-text-primary)] border border-[var(--color-border)]">
                          <MonitorSmartphone
                            size={13}
                            className="text-[var(--color-text-secondary)]"
                          />
                          {deviceNames}
                        </span>
                      </div>

                      {}
                      <div className="bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider mb-4">
                          About
                        </h3>
                        <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed whitespace-pre-wrap">
                          {linkify(displayedGame.description)}
                        </p>
                      </div>

                      {}
                      {socialLinks && socialLinks.length > 0 && (
                        <div className="bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-2xl p-6">
                          <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider mb-4">
                            Community
                          </h3>
                          <div className="flex flex-wrap gap-3">
                            {socialLinks.map((link: SocialLink) => (
                              <Tooltip key={link.id}>
                                <TooltipTrigger asChild>
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] rounded-xl transition-all text-sm font-medium text-[var(--color-text-primary)] hover:-translate-y-0.5"
                                  >
                                    {getSocialIcon(link.type)}
                                    <span>{link.title}</span>
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {getPlatformName(link.type)}
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : activeTab === "servers" ? (
                    <div className="h-[600px] bg-[var(--color-surface)]/30 rounded-2xl border border-[var(--color-border)] overflow-hidden">
                      <ServersList
                        placeId={
                          displayedGame.placeId || displayedGame.id.toString()
                        }
                        onJoin={(jobId) => {
                          const targetId =
                            displayedGame.placeId ||
                            displayedGame.id.toString();
                          onLaunch({
                            method: JoinMethod.JobId,
                            target: `${targetId}:${jobId}`,
                          });
                          onClose();
                        }}
                      />
                    </div>
                  ) : activeTab === "private" ? (
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-5 space-y-4">
                      <div className="flex items-center gap-2 text-[var(--color-text-primary)] font-semibold">
                        <Lock size={16} />
                        Private Server Join
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Paste a private server link or use the format
                        PlaceID:ServerCode.
                      </p>
                      <input
                        value={privateServerTarget}
                        onChange={(e) => setPrivateServerTarget(e.target.value)}
                        placeholder="https://www.roblox.com/games/1818?privateServerLinkCode=..."
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                      />
                      <Button
                        variant="default"
                        className="w-full"
                        disabled={!privateServerTarget.trim()}
                        onClick={() => {
                          const targetId =
                            displayedGame.placeId ||
                            displayedGame.id.toString();
                          const raw = privateServerTarget.trim();
                          const target = /^https?:\/\//i.test(raw)
                            ? raw
                            : `${targetId}:${raw}`;
                          onLaunch({
                            method: JoinMethod.PrivateServer,
                            target,
                          });
                          onClose();
                        }}
                      >
                        Join Private Server
                      </Button>
                    </div>
                  ) : activeTab === "store" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {gamePassesForSale.map((pass: GamePass) => (
                        <GamePassCard
                          key={pass.id}
                          pass={pass}
                          account={account}
                          showNotification={showNotification}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <GameImageContextMenu
        activeMenu={contextMenu}
        onClose={() => setContextMenu(null)}
        onSaveImage={handleSaveImage}
      />

      <UniversalProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userId={selectedCreatorId}
        selectedAccount={account || null}
        onJoinGame={(placeId, jobId, userId) => {
          if (!placeId) return;
          const placeTarget =
            typeof placeId === "number" ? placeId.toString() : placeId;

          if (jobId) {
            onLaunch({
              method: JoinMethod.JobId,
              target: `${placeTarget}:${jobId}`,
            });
            return;
          }

          if (userId) {
            onLaunch({
              method: JoinMethod.Friend,
              target: `${userId}:${placeTarget}`,
            });
            return;
          }

          onLaunch({ method: JoinMethod.PlaceId, target: placeTarget });
        }}
      />

      <GroupDetailsModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        groupId={
          typeof selectedCreatorId === "number" ? selectedCreatorId : null
        }
        selectedAccount={account || null}
      />
    </>
  );
};

const GamePassCard: React.FC<{
  pass: GamePass;
  account?: Account | null;
  showNotification: (
    message: string,
    type: "success" | "error" | "warning" | "info",
  ) => void;
}> = ({ pass, account, showNotification }) => {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isOwned, setIsOwned] = useState(pass.isOwned);
  const [showConfirm, setShowConfirm] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{
    name: string;
    creator: string;
    price: number | string;
    thumbnailUrl: string;
  } | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    if (pass.displayIconImageAssetId) {
      fetch(
        `https://thumbnails.roblox.com/v1/game-passes?gamePassIds=${pass.displayIconImageAssetId}&size=150x150&format=Png&isCircular=false`,
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.data && data.data.length > 0 && data.data[0].imageUrl) {
            setImageUrl(data.data[0].imageUrl);
          }
        })
        .catch(() => {
          console.error("Failed to load game pass thumbnail");
        });
    }
  }, [pass.displayIconImageAssetId]);

  const handleOpenConfirm = () => {
    if (isOwned) return;
    if (pass.productId === null) {
      showNotification(
        "This game pass is unavailable for purchase right now",
        "warning",
      );
      return;
    }
    if (pass.price === null) {
      showNotification("This game pass is not currently for sale", "warning");
      return;
    }
    if (!account?.cookie) {
      showNotification(
        "Select an account with a valid cookie to purchase",
        "error",
      );
      return;
    }
    setPurchaseError(null);
    setShowConfirm(true);
  };

  const handleConfirmPurchase = async () => {
    if (!account?.cookie || pass.price === null || pass.productId === null)
      return;

    setIsPurchasing(true);
    setPurchaseError(null);

    const sellerId = pass.creator?.creatorId;
    if (!sellerId) {
      const message = "Unable to determine seller for this game pass";
      setPurchaseError(message);
      showNotification(message, "error");
      setIsPurchasing(false);
      setShowConfirm(false);
      return;
    }
    const idempotencyKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : undefined;

    try {
      const result = await window.api.purchaseGamePass(
        account.cookie,
        pass.productId,
        pass.price,
        sellerId,
        account.userId,
        idempotencyKey,
      );

      if (result?.purchased) {
        setIsOwned(true);
        setPurchaseSuccess({
          name: pass.displayName || pass.name,
          creator: pass.creator?.name || "Unknown Creator",
          price: pass.price,
          thumbnailUrl: imageUrl,
        });
        showNotification("Game pass purchased successfully", "success");
      } else {
        const message =
          result?.reason ||
          result?.errorMessage ||
          result?.shortMessage ||
          result?.purchaseResult ||
          "Failed to purchase game pass";
        setPurchaseError(message);
        showNotification(message, "error");
      }
    } catch (error: any) {
      const message = error?.message || "Failed to purchase game pass";
      setPurchaseError(message);
      showNotification(message, "error");
    } finally {
      setIsPurchasing(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="bg-[var(--color-surface)]/50 border border-[var(--color-border)]/50 rounded-lg p-3 flex gap-3 hover:bg-[var(--color-surface)] transition-colors">
      <div className="w-16 h-16 rounded-lg bg-[var(--color-surface-hover)] overflow-hidden flex-shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={pass.displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag size={24} className="text-[var(--color-text-muted)]" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
          {pass.displayName}
        </h4>
        {pass.displayDescription && (
          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mt-0.5">
            {pass.displayDescription}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end justify-center gap-1 flex-shrink-0">
        {isOwned ? (
          <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400">
            <Check size={14} />
            <span className="text-xs font-medium">Owned</span>
          </div>
        ) : pass.price !== null ? (
          <button
            onClick={handleOpenConfirm}
            disabled={isPurchasing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(var(--accent-color-rgb),0.15)] hover:bg-[rgba(var(--accent-color-rgb),0.25)] border border-[var(--accent-color-border)] rounded-lg text-[var(--accent-color)] transition-colors disabled:opacity-50"
          >
            <RobuxIcon className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {pass.price.toLocaleString()}
            </span>
          </button>
        ) : (
          <span className="text-xs text-[var(--color-text-muted)]">
            Not for sale
          </span>
        )}
      </div>

      <Dialog
        isOpen={showConfirm}
        onClose={() => !isPurchasing && setShowConfirm(false)}
      >
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={pass.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ShoppingBag
                    size={24}
                    className="text-[var(--color-text-muted)]"
                  />
                )}
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Confirm Purchase
                </p>
                <p className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                  {pass.displayName}
                </p>
              </div>
            </div>

            <div className="text-sm text-[var(--color-text-secondary)]">
              Buy this game pass for{" "}
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                {pass.price?.toLocaleString()}
                <RobuxIcon className="w-4 h-4" />
              </span>
              ?
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={isPurchasing}
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={isPurchasing}
                onClick={handleConfirmPurchase}
              >
                {isPurchasing && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                {isPurchasing ? "Purchasing..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {purchaseSuccess && (
        <PurchaseSuccessDialog
          isOpen={!!purchaseSuccess}
          onClose={() => setPurchaseSuccess(null)}
          assetName={purchaseSuccess.name}
          creatorName={purchaseSuccess.creator}
          price={purchaseSuccess.price}
          thumbnailUrl={purchaseSuccess.thumbnailUrl}
        />
      )}

      <PurchaseErrorDialog
        isOpen={!!purchaseError}
        onClose={() => setPurchaseError(null)}
        errorMessage={purchaseError || ""}
      />
    </div>
  );
};

export default GameDetailsModal;
