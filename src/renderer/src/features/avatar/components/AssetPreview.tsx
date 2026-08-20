import React, { lazy, Suspense } from "react";
import { Image as ImageIcon, Box, Eye, Undo2, Loader2 } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@renderer/components/UI/display/Tooltip";

const Avatar3DThumbnail = lazy(
  () => import("@renderer/components/Avatar/Avatar3DThumbnail"),
);

interface AssetPreviewProps {
  viewMode: "2d" | "3d";
  has3DView: boolean;
  currentAssetId: number | null;
  assetTypeId?: number | null;
  imageUrl: string;
  assetName: string;
  isTryingOn: boolean;
  tryOnImageUrl: string | null;
  tryOnManifestUrl?: string | null;
  tryOnLoading: boolean;
  cookie?: string;
  onViewModeChange: (mode: "2d" | "3d") => void;
  on3DError: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTryOn: () => void;
  onRevertTryOn: () => void;
}

export const AssetPreview: React.FC<AssetPreviewProps> = ({
  viewMode,
  has3DView,
  currentAssetId,
  assetTypeId,
  imageUrl,
  assetName,
  isTryingOn,
  tryOnImageUrl,
  tryOnManifestUrl,
  tryOnLoading,
  cookie,
  onViewModeChange,
  on3DError,
  onContextMenu,
  onTryOn,
  onRevertTryOn,
}) => {
  const [tryOnImageFailed, setTryOnImageFailed] = React.useState(false);

  React.useEffect(() => {
    setTryOnImageFailed(false);
  }, [isTryingOn, tryOnImageUrl]);

  const shouldShowTryOnModel = isTryingOn && !!tryOnManifestUrl;
  const shouldShowTryOnImage =
    isTryingOn && !!tryOnImageUrl && !tryOnImageFailed;

  if (shouldShowTryOnModel) {
  } else if (shouldShowTryOnImage) {
  }

  return (
    <div className="w-full lg:w-1/2 relative flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--color-border)] bg-[var(--color-app-bg)] overflow-hidden group">
      {}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-900 to-neutral-950" />
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent)",
          backgroundSize: "50px 50px",
          transform:
            "perspective(500px) rotateX(60deg) translateY(100px) scale(2)",
        }}
      />

      <div
        className="relative w-full h-full z-10 cursor-context-menu"
        onContextMenu={onContextMenu}
      >
        {shouldShowTryOnModel ? (
          <Suspense fallback={null}>
            <Avatar3DThumbnail
              manifestUrl={tryOnManifestUrl || undefined}
              type="avatar"
              cookie={cookie}
              className="w-full h-full"
              autoRotateSpeed={0.005}
              cameraDistanceFactor={2}
              manualRotationEnabled={true}
              manualZoomEnabled={true}
              manualPanEnabled={false}
              onError={on3DError}
            />
          </Suspense>
        ) : shouldShowTryOnImage ? (
          <div className="w-full h-full flex items-center justify-center p-8">
            <img
              src={tryOnImageUrl}
              alt="Try-on preview"
              className="w-full h-full object-contain drop-shadow-2xl transition-transform duration-300"
              onError={() => {
                console.error(
                  "[AssetPreview] Try-on image failed to load:",
                  tryOnImageUrl,
                );

                setTryOnImageFailed(true);
              }}
            />
          </div>
        ) : viewMode === "2d" ? (
          <div className="w-full h-full flex items-center justify-center p-8">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={assetName}
                className="w-full h-full object-contain drop-shadow-2xl transition-transform duration-300"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-[var(--color-text-muted)]">
                <ImageIcon size={48} strokeWidth={1.5} />
                <span className="text-xs">No preview available</span>
              </div>
            )}
          </div>
        ) : (
          <Suspense fallback={null}>
            <Avatar3DThumbnail
              assetId={currentAssetId}
              assetTypeId={assetTypeId}
              cookie={cookie}
              className="w-full h-full"
              autoRotateSpeed={0.005}
              cameraDistanceFactor={2.5}
              manualRotationEnabled={true}
              manualZoomEnabled={true}
              onError={on3DError}
            />
          </Suspense>
        )}

        {}
        {isTryingOn && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-emerald-500/90 backdrop-blur text-[var(--color-text-primary)] text-xs font-medium rounded-full flex items-center gap-2 shadow-lg z-20">
            <Eye size={14} />
            Trying On
          </div>
        )}

        {}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          {!isTryingOn && has3DView && (
            <div className="flex items-center p-1 bg-[var(--color-app-bg)]/80 backdrop-blur border border-[var(--color-border)] rounded-lg shadow-xl">
              <button
                onClick={() => onViewModeChange("2d")}
                className={cn(
                  "p-2 rounded transition-colors",
                  viewMode === "2d"
                    ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
                )}
              >
                <ImageIcon size={18} />
              </button>
              <button
                onClick={() => onViewModeChange("3d")}
                className={cn(
                  "p-2 rounded transition-colors",
                  viewMode === "3d"
                    ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
                )}
              >
                <Box size={18} />
              </button>
            </div>
          )}

          {}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={isTryingOn ? onRevertTryOn : onTryOn}
                  disabled={tryOnLoading}
                  className={cn(
                    "p-2.5 rounded-lg backdrop-blur border shadow-xl transition-all flex items-center gap-2",
                    isTryingOn
                      ? "bg-amber-500/90 hover:bg-amber-400/90 border-amber-400/50 text-[var(--color-text-primary)]"
                      : "bg-[var(--color-app-bg)]/80 hover:bg-[var(--color-surface)]/80 border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                    tryOnLoading && "opacity-70 cursor-wait",
                  )}
                >
                  {tryOnLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : isTryingOn ? (
                    <Undo2 size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {tryOnLoading
                  ? "Loading..."
                  : isTryingOn
                    ? "Revert to Original"
                    : "Try On Avatar"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};
