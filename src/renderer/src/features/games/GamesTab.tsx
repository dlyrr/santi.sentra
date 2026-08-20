import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  CSSProperties,
  memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Star,
  Gamepad2,
  ThumbsUp,
  Play,
  X,
  SlidersHorizontal,
  Check,
  ChevronDown,
} from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { Game } from "@renderer/types";
import GameContextMenu from "./UI/GameContextMenu";
import { useNotification } from "@renderer/features/system/stores/useSnackbarStore";
import { Button } from "@renderer/components/UI/buttons/Button";
import { SearchInput } from "@renderer/components/UI/inputs/SearchInput";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@renderer/components/UI/display/Tooltip";
import CustomDropdown, {
  DropdownOption,
} from "@renderer/components/UI/menus/CustomDropdown";
import { HorizontalCarousel } from "@renderer/components/UI/navigation/HorizontalCarousel";
import { SkeletonGameGrid } from "@renderer/components/UI/display/SkeletonGrid";
import FavoriteParticles from "@renderer/components/UI/specialized/FavoriteParticles";
import { EmptyState } from "@renderer/components/UI/feedback/EmptyState";
import VerifiedIcon from "@renderer/components/UI/icons/VerifiedIcon";
import { formatNumber } from "@renderer/utils/numberUtils";
import {
  useGameSorts,
  useGamesInSort,
  useSearchGames,
  useGamesByPlaceIds,
  useFavoriteGames,
  useRecentlyPlayedGames,
  useAddFavoriteGame,
  useRemoveFavoriteGame,
} from "@renderer/hooks/queries";
import { useOpenModal } from "@renderer/stores/useUIStore";
import { useSelectedIds } from "@renderer/stores/useSelectionStore";

interface GamesTabProps {
  onGameSelect: (game: Game) => void;
}

const gridStyle: CSSProperties = {
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
};

const TruncatedTitle = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  const textRef = useRef<HTMLHeadingElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const check = () => setIsTruncated(el.scrollWidth > el.clientWidth);
    check();

    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  const titleElement = (
    <h3 ref={textRef} className={className}>
      {text}
    </h3>
  );

  if (isTruncated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{titleElement}</TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    );
  }

  return titleElement;
};

interface GameCardProps {
  game: Game;
  onGameSelect: (game: Game) => void;
  onContextMenu: (e: React.MouseEvent, game: Game) => void;
  formatPlayerCount: (num: number) => string;
  isFavorite: boolean;
  favoriteBurst: boolean;
}

const GameCard = memo(
  ({
    game,
    onGameSelect,
    onContextMenu,
    formatPlayerCount,
    isFavorite,
    favoriteBurst,
  }: GameCardProps) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const mediaRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const isHoveredRef = useRef(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [hasImageError, setHasImageError] = useState(false);

    const targetTransform = useRef({ x: 0, y: 0, scale: 1 });
    const currentTransform = useRef({ x: 0, y: 0, scale: 1 });

    const PARALLAX_INTENSITY = 0.01;
    const HOVER_SCALE = 1.05;
    const SMOOTHING = 0.12;
    const EPSILON = 0.001;

    const applyTransform = () => {
      if (!mediaRef.current) return;
      const { x, y, scale } = currentTransform.current;
      const transform = `translate(${x * 100}%, ${y * 100}%) scale(${scale})`;
      if (mediaRef.current) {
        mediaRef.current.style.transform = transform;
      }
    };

    const animate = () => {
      if (!imageRef.current) {
        rafRef.current = null;
        return;
      }

      const {
        x: targetX,
        y: targetY,
        scale: targetScale,
      } = targetTransform.current;
      const { x, y, scale } = currentTransform.current;

      const nextX = x + (targetX - x) * SMOOTHING;
      const nextY = y + (targetY - y) * SMOOTHING;
      const nextScale = scale + (targetScale - scale) * SMOOTHING;

      currentTransform.current = { x: nextX, y: nextY, scale: nextScale };
      applyTransform();

      const isSettled =
        Math.abs(nextX - targetX) < EPSILON &&
        Math.abs(nextY - targetY) < EPSILON &&
        Math.abs(nextScale - targetScale) < EPSILON;

      if (!isSettled) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      currentTransform.current = { ...targetTransform.current };
      applyTransform();
      rafRef.current = null;
    };

    const startAnimation = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current || !imageRef.current || !isHoveredRef.current)
        return;

      const rect = cardRef.current.getBoundingClientRect();
      const relativeX = Math.min(
        Math.max((e.clientX - rect.left) / rect.width, 0),
        1,
      );
      const relativeY = Math.min(
        Math.max((e.clientY - rect.top) / rect.height, 0),
        1,
      );

      targetTransform.current.x = (relativeX - 0.5) * 2 * PARALLAX_INTENSITY;
      targetTransform.current.y = (relativeY - 0.5) * 2 * PARALLAX_INTENSITY;

      startAnimation();
    };

    const handleMouseEnter = () => {
      isHoveredRef.current = true;
      targetTransform.current = {
        ...targetTransform.current,
        scale: HOVER_SCALE,
        x: 0,
        y: 0,
      };
      startAnimation();
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
      targetTransform.current = { x: 0, y: 0, scale: 1 };
      startAnimation();
    };

    useEffect(() => {
      return () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
      };
    }, []);

    useEffect(() => {
      setImageLoaded(false);
      setHasImageError(false);

      const img = imageRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        setImageLoaded(true);
      }
    }, [game.thumbnailUrl]);

    const likeRatio =
      game.likes + game.dislikes > 0
        ? (game.likes / (game.likes + game.dislikes)) * 100
        : 0;
    const ratingColor =
      likeRatio >= 80 ? "#4ade80" : likeRatio >= 50 ? "#facc15" : "#f87171";

    return (
      <div
        ref={cardRef}
        onClick={() => onGameSelect(game)}
        onContextMenu={(e) => onContextMenu(e, game)}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 animate-in fade-in duration-150"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}
      >
        {}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 0 1px rgba(var(--accent-color-rgb), 0.5), 0 0 30px rgba(var(--accent-color-rgb), 0.12)`,
          }}
        />

        {}
        <div
          className="relative overflow-hidden bg-black transform-gpu"
          style={{ aspectRatio: "16/9" }}
        >
          {isFavorite && (
            <div className="absolute top-3 left-3 z-10 pointer-events-none">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-400/95 to-amber-600/95 flex items-center justify-center shadow-lg shadow-yellow-500/30 border border-yellow-300/30 relative overflow-visible">
                <Star
                  size={13}
                  className="fill-current text-white"
                  style={{ strokeWidth: 0 }}
                />
                <FavoriteParticles
                  active={favoriteBurst}
                  color={[251, 191, 36]}
                />
              </div>
            </div>
          )}
          {}
          <div className="absolute top-3 right-3 z-10">
            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-bold text-white">
                {formatPlayerCount(game.playing)}
              </span>
            </div>
          </div>

          {game.thumbnailUrl && !hasImageError ? (
            <div
              ref={mediaRef}
              className="absolute inset-0 will-change-transform"
            >
              {!imageLoaded && (
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                </div>
              )}
              <img
                ref={imageRef}
                src={game.thumbnailUrl}
                alt={game.name}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  setHasImageError(true);
                  setImageLoaded(true);
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  opacity: imageLoaded ? 1 : 0,
                  transition: "opacity 0.35s ease-out",
                }}
                className="absolute inset-0"
                loading="lazy"
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.85) 100%)",
                }}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
              <Gamepad2 size={36} strokeWidth={1.5} />
            </div>
          )}
        </div>

        {}
        <div className="px-3.5 pt-3 pb-2">
          <TruncatedTitle
            text={game.name}
            className="font-bold text-[13px] text-[var(--color-text-primary)] truncate leading-snug mb-0.5"
          />
          <p
            className={`text-[11px] truncate flex items-center gap-1 ${game.creatorHasVerifiedBadge ? "text-[#5b9cf6]" : "text-[var(--color-text-muted)]"}`}
          >
            {game.creatorName}
            {game.creatorHasVerifiedBadge && (
              <VerifiedIcon width={11} height={11} className="shrink-0" />
            )}
          </p>
        </div>

        {}
        <div className="px-3.5 pb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: ratingColor }}
                  >
                    {likeRatio.toFixed(0)}% liked
                  </span>
                  <ThumbsUp size={10} style={{ color: ratingColor }} />
                </div>
                <div className="h-1 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${likeRatio}%`,
                      background: ratingColor,
                      opacity: 0.85,
                    }}
                  />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <div className="font-semibold">
                  {game.likes.toLocaleString()} likes
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  {game.dislikes.toLocaleString()} dislikes
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  },
);

const GameCardSkeleton = () => (
  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden animate-pulse shrink-0 w-[240px]">
    <div
      className="w-full bg-[var(--color-surface-hover)]"
      style={{ aspectRatio: "16/9" }}
    />
    <div className="px-3.5 pt-3 pb-3 space-y-2">
      <div className="h-3.5 w-3/4 bg-[var(--color-surface-hover)] rounded-md" />
      <div className="h-2.5 w-1/2 bg-[var(--color-surface-hover)] rounded-md" />
      <div className="h-1.5 w-full bg-[var(--color-surface-hover)] rounded-full mt-3" />
    </div>
  </div>
);

const GamesTab = ({ onGameSelect }: GamesTabProps) => {
  const { showNotification } = useNotification();
  const openModal = useOpenModal();
  const selectedIds = useSelectedIds();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const [selectedSortId, setSelectedSortId] = useState<string | null>(null);

  const [favoriteGameBurstKeys, setFavoriteGameBurstKeys] = useState<
    Record<string, number>
  >({});
  const favoriteGameBurstTimeouts = useRef<Map<string, number>>(new Map());
  const [activeContextMenu, setActiveContextMenu] = useState<{
    id: string;
    placeId?: string;
    universeId?: string;
    isFavorite: boolean;
    x: number;
    y: number;
  } | null>(null);

  const [sessionId] = useState(() => self.crypto.randomUUID());

  const { data: sorts = [] } = useGameSorts(sessionId);
  const { data: favorites = [] } = useFavoriteGames();

  const addFavoriteMutation = useAddFavoriteGame();
  const removeFavoriteMutation = useRemoveFavoriteGame();

  const isSearchMode = debouncedSearchQuery.trim().length > 0;

  const { data: sortGames = [], isLoading: isSortLoading } = useGamesInSort(
    !isSearchMode ? selectedSortId : null,
    sessionId,
  );

  const { data: searchGames = [], isLoading: isSearchLoading } = useSearchGames(
    debouncedSearchQuery,
    sessionId,
  );

  const { data: favoriteGames = [], isLoading: isFavoritesLoading } =
    useGamesByPlaceIds(favorites);

  const { data: recentlyPlayedGames = [], isLoading: isRecentLoading } =
    useRecentlyPlayedGames(sessionId);

  const games = useMemo(() => {
    if (isSearchMode) {
      return searchGames;
    }
    return sortGames;
  }, [isSearchMode, searchGames, sortGames]);

  const isRecommendedLoading = isSearchMode ? isSearchLoading : isSortLoading;

  const sortOptions: DropdownOption[] = useMemo(() => {
    return sorts.map((sort) => ({
      value: sort.token,
      label: sort.displayName || sort.name,
    }));
  }, [sorts]);

  useEffect(() => {
    if (sorts.length > 0 && !selectedSortId && !searchQuery) {
      const popularSort = sorts.find(
        (s) =>
          s.name.toLowerCase().includes("popular") ||
          s.name.toLowerCase().includes("trending") ||
          s.token.toLowerCase().includes("popular") ||
          s.token.toLowerCase().includes("trending"),
      );
      setSelectedSortId(popularSort ? popularSort.token : sorts[0].token);
    }
  }, [sorts, selectedSortId, searchQuery]);

  const triggerGameFavoriteBurst = (placeId: string) => {
    setFavoriteGameBurstKeys((prev) => ({
      ...prev,
      [placeId]: (prev[placeId] ?? 0) + 1,
    }));

    const existingTimeout = favoriteGameBurstTimeouts.current.get(placeId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeoutId = window.setTimeout(() => {
      setFavoriteGameBurstKeys((prev) => {
        const { [placeId]: _, ...rest } = prev;
        return rest;
      });
      favoriteGameBurstTimeouts.current.delete(placeId);
    }, 900);

    favoriteGameBurstTimeouts.current.set(placeId, timeoutId);
  };

  useEffect(() => {
    const timeouts = favoriteGameBurstTimeouts.current;
    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, []);

  const handleFavorite = async (placeId: string) => {
    try {
      if (favorites.includes(placeId)) {
        await removeFavoriteMutation.mutateAsync(placeId);
        showNotification("Removed from favorites", "success");
      } else {
        await addFavoriteMutation.mutateAsync(placeId);
        triggerGameFavoriteBurst(placeId);
        showNotification("Added to favorites", "success");
      }
    } catch (error) {
      console.error("Failed to update favorites:", error);
      showNotification("Failed to update favorites", "error");
    }
  };

  const handleCopyPlaceId = (placeId: string) => {
    navigator.clipboard.writeText(placeId);
    showNotification("Place ID copied to clipboard", "success");
  };

  const handleCopyUniverseId = (universeId: string) => {
    navigator.clipboard.writeText(universeId);
    showNotification("Universe ID copied to clipboard", "success");
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, currentGame: Game) => {
      e.preventDefault();
      setActiveContextMenu({
        id: currentGame.id,
        placeId: currentGame.placeId,
        universeId: currentGame.universeId,
        isFavorite: Boolean(
          currentGame.placeId && favorites.includes(currentGame.placeId),
        ),
        x: e.clientX,
        y: e.clientY,
      });
    },
    [favorites],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
  }, []);

  const formatPlayerCount = useCallback((num: number) => formatNumber(num), []);

  return (
    <TooltipProvider>
      <div
        className="flex flex-col h-full"
        style={{ background: "var(--color-app-bg)" }}
      >
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-[var(--color-border)] bg-[var(--color-surface-strong)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold text-[var(--color-text-primary)] leading-none">
                  Games
                </h1>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {isRecommendedLoading
                    ? "Loading..."
                    : `${games.length.toLocaleString()} results`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
              {selectedIds.size > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="default"
                      onClick={() => openModal("join")}
                      className="gap-2 shrink-0 bg-[rgba(var(--accent-color-rgb),0.95)] hover:bg-[var(--accent-color-muted)] text-[var(--accent-color-foreground)] border-[var(--accent-color-border)]"
                    >
                      <Play size={15} fill="currentColor" />
                      Launch {selectedIds.size}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Launch with {selectedIds.size} account
                    {selectedIds.size !== 1 ? "s" : ""}
                  </TooltipContent>
                </Tooltip>
              )}

              {sorts.length > 0 && (
                <div className="relative">
                  <Button
                    variant="outline"
                    className={cn(
                      "gap-2 border-[var(--color-border)] shadow-sm transition-all",
                      filterOpen ||
                        selectedSortId !==
                          (sorts[0]?.token || sortOptions[0]?.value)
                        ? "bg-[rgba(var(--accent-color-rgb),0.1)] border-[rgba(var(--accent-color-rgb),0.3)] text-[var(--accent-color)]"
                        : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]",
                    )}
                    onClick={() => setFilterOpen(!filterOpen)}
                  >
                    <SlidersHorizontal
                      size={14}
                      className={
                        selectedSortId !==
                        (sorts[0]?.token || sortOptions[0]?.value)
                          ? "text-[var(--accent-color)]"
                          : "text-[var(--color-text-secondary)]"
                      }
                    />
                    <span className="font-semibold text-sm">
                      {sortOptions.find((o) => o.value === selectedSortId)
                        ?.label || "Sort"}
                    </span>
                    <ChevronDown
                      size={14}
                      className={cn(
                        "text-[var(--color-text-muted)] transition-transform duration-200",
                        filterOpen && "rotate-180",
                      )}
                    />
                  </Button>

                  <AnimatePresence>
                    {filterOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 top-full mt-3 w-[360px] bg-[var(--color-surface)]/90 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] z-50 overflow-hidden ring-1 ring-[var(--color-border-subtle)]"
                      >
                        <div className="p-4 border-b border-[var(--color-border)]/50 flex items-center justify-between bg-gradient-to-br from-[var(--color-surface-hover)]/30 to-transparent">
                          <div>
                            <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-none mb-1">
                              Categories
                            </h3>
                            <p className="text-[11px] text-[var(--color-text-muted)]">
                              Select a category to explore games
                            </p>
                          </div>
                          <button
                            onClick={() => setFilterOpen(false)}
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1.5 rounded-lg hover:bg-[var(--color-surface-strong)] transition-colors border border-transparent hover:border-[var(--color-border)]"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div className="p-3 max-h-[450px] overflow-y-auto scrollbar-thin grid grid-cols-1 gap-1.5">
                          {sortOptions.map((opt) => {
                            const isSelected = selectedSortId === opt.value;

                            const cleanLabel = opt.label
                              .replace(
                                /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu,
                                "",
                              )
                              .trim();

                            return (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  setSelectedSortId(opt.value);
                                  setFilterOpen(false);
                                }}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group duration-300",
                                  isSelected
                                    ? "bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 text-[var(--color-text-primary)]"
                                    : "hover:bg-[var(--color-surface-hover)] border border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                                )}
                              >
                                <div
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                    isSelected
                                      ? "bg-[var(--accent-color)] shadow-[0_0_8px_var(--accent-color)]"
                                      : "bg-[var(--color-border-strong)] group-hover:bg-[var(--color-text-muted)]",
                                  )}
                                />
                                <span
                                  className={cn(
                                    "text-sm truncate flex-1",
                                    isSelected ? "font-bold" : "font-medium",
                                  )}
                                >
                                  {cleanLabel}
                                </span>
                                {isSelected && (
                                  <Check
                                    size={16}
                                    className="shrink-0 text-[var(--accent-color)] drop-shadow-[0_0_5px_rgba(var(--accent-color-rgb),0.5)]"
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search games…"
                containerClassName="w-56 shrink-0"
              />
            </div>
          </div>

          <AnimatePresence>
            {isSearchMode && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Search:
                  </span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(var(--accent-color-rgb),0.1)] border border-[rgba(var(--accent-color-rgb),0.25)] text-xs text-[var(--accent-color)]">
                    <span className="font-medium">
                      "{debouncedSearchQuery}"
                    </span>
                    <button
                      onClick={handleClearSearch}
                      className="p-0.5 rounded-full hover:bg-[rgba(var(--accent-color-rgb),0.2)] ml-1"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="flex flex-col gap-10">
            {(isFavoritesLoading || favoriteGames.length > 0) && (
              <>
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-500/80 to-amber-600/80 flex items-center justify-center shadow border border-yellow-400/30">
                      <Star
                        size={13}
                        className="fill-current text-white"
                        style={{ strokeWidth: 0 }}
                      />
                    </div>
                    <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                      Favorites
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                      {favoriteGames.length}
                    </span>
                  </div>
                  {isFavoritesLoading ? (
                    <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <GameCardSkeleton key={`fav-skel-${idx}`} />
                      ))}
                    </div>
                  ) : (
                    <HorizontalCarousel title="" titleExtra={null}>
                      {favoriteGames.map((game, index) => (
                        <div
                          key={
                            game.id && game.id !== "null"
                              ? `fav-${game.id}`
                              : `fav-idx-${index}`
                          }
                          className="w-[240px] shrink-0"
                        >
                          <GameCard
                            game={game}
                            onGameSelect={onGameSelect}
                            onContextMenu={handleContextMenu}
                            formatPlayerCount={formatPlayerCount}
                            isFavorite={true}
                            favoriteBurst={Boolean(
                              game.placeId &&
                              favoriteGameBurstKeys[game.placeId],
                            )}
                          />
                        </div>
                      ))}
                    </HorizontalCarousel>
                  )}
                </section>
                <div className="h-px bg-[var(--color-border)]" />
              </>
            )}

            {(isRecentLoading || recentlyPlayedGames.length > 0) && (
              <>
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                      <Play
                        size={12}
                        className="text-[var(--color-text-secondary)]"
                        fill="currentColor"
                      />
                    </div>
                    <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                      Recently Played
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                      {recentlyPlayedGames.length}
                    </span>
                  </div>
                  {isRecentLoading ? (
                    <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <GameCardSkeleton key={`recent-skel-${idx}`} />
                      ))}
                    </div>
                  ) : (
                    <HorizontalCarousel title="" titleExtra={null}>
                      {recentlyPlayedGames.map((game, index) => (
                        <div
                          key={
                            game.id && game.id !== "null"
                              ? `recent-${game.id}`
                              : `recent-idx-${index}`
                          }
                          className="w-[240px] shrink-0"
                        >
                          <GameCard
                            game={game}
                            onGameSelect={onGameSelect}
                            onContextMenu={handleContextMenu}
                            formatPlayerCount={formatPlayerCount}
                            isFavorite={Boolean(
                              game.placeId && favorites.includes(game.placeId),
                            )}
                            favoriteBurst={Boolean(
                              game.placeId &&
                              favoriteGameBurstKeys[game.placeId],
                            )}
                          />
                        </div>
                      ))}
                    </HorizontalCarousel>
                  )}
                </section>
                <div className="h-px bg-[var(--color-border)]" />
              </>
            )}

            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                  <Gamepad2
                    size={13}
                    className="text-[var(--color-text-secondary)]"
                  />
                </div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                  {isSearchMode ? "Search Results" : "Recommended"}
                </h2>
                {!isRecommendedLoading && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                    {games.length}
                  </span>
                )}
              </div>

              <AnimatePresence mode="wait">
                {isRecommendedLoading ? (
                  <SkeletonGameGrid count={15} gridStyle={gridStyle} />
                ) : games.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center py-20"
                  >
                    <EmptyState
                      icon={Gamepad2}
                      title="No games found"
                      description={
                        searchQuery
                          ? "Try adjusting your search terms"
                          : undefined
                      }
                      variant="minimal"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="games"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="grid gap-4"
                    style={gridStyle}
                  >
                    {games.map((game, index) => (
                      <GameCard
                        key={
                          game.id && game.id !== "null"
                            ? game.id
                            : `game-idx-${index}`
                        }
                        game={game}
                        onGameSelect={onGameSelect}
                        onContextMenu={handleContextMenu}
                        formatPlayerCount={formatPlayerCount}
                        isFavorite={Boolean(
                          game.placeId && favorites.includes(game.placeId),
                        )}
                        favoriteBurst={Boolean(
                          game.placeId && favoriteGameBurstKeys[game.placeId],
                        )}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>
        </div>

        <GameContextMenu
          activeMenu={activeContextMenu}
          onClose={() => setActiveContextMenu(null)}
          onFavorite={handleFavorite}
          onCopyPlaceId={handleCopyPlaceId}
          onCopyUniverseId={handleCopyUniverseId}
        />
      </div>
    </TooltipProvider>
  );
};

export default GamesTab;
