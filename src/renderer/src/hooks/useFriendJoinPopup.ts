import { useEffect, useRef } from "react";
import { useShowNotification } from "@renderer/features/system/stores/useSnackbarStore";
import { useNotificationTrayStore } from "@renderer/stores/useNotificationTrayStore";
import { useFavoriteFriends } from "@renderer/stores/useFriendsStore";

export function useFriendJoinPopup() {
  const showNotification = useShowNotification();
  const notifications = useNotificationTrayStore(
    (state) => state.notifications,
  );
  const favorites = useFavoriteFriends();
  const lastNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (notifications.length > 0) {
      const latestNotification = notifications[0];

      if (
        latestNotification.type === "friend_ingame" &&
        latestNotification.id !== lastNotificationIdRef.current &&
        latestNotification.userId
      ) {
        const isFavorite = favorites.includes(latestNotification.userId);

        if (isFavorite) {
          lastNotificationIdRef.current = latestNotification.id;

          const message = `${latestNotification.title} ${latestNotification.gameInfo?.name ? `— ${latestNotification.gameInfo.name}` : ""}`;
          showNotification(message, "info", 4000);
        }
      }
    }
  }, [notifications, showNotification, favorites]);
}
