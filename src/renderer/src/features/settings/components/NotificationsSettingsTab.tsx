import React from "react";
import { motion } from "framer-motion";
import { Bell, Users, UserMinus, MapPin } from "lucide-react";
import {
  BentoCard,
  BentoToggle,
  SectionDivider,
  PageHeader,
} from "./SharedComponents";
import {
  useNotifyFriendOnline,
  useNotifyFriendInGame,
  useNotifyFriendRemoved,
  useNotifyServerLocation,
  useNotificationTrayStore,
} from "../../system/stores/useNotificationTrayStore";

export const NotificationsSettingsTab: React.FC = () => {
  const notifyFriendOnline = useNotifyFriendOnline();
  const notifyFriendInGame = useNotifyFriendInGame();
  const notifyFriendRemoved = useNotifyFriendRemoved();
  const notifyServerLocation = useNotifyServerLocation();

  const setNotifyFriendOnline = useNotificationTrayStore(
    (s) => s.setNotifyFriendOnline,
  );
  const setNotifyFriendInGame = useNotificationTrayStore(
    (s) => s.setNotifyFriendInGame,
  );
  const setNotifyFriendRemoved = useNotificationTrayStore(
    (s) => s.setNotifyFriendRemoved,
  );
  const setNotifyServerLocation = useNotificationTrayStore(
    (s) => s.setNotifyServerLocation,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="pb-10"
    >
      <div className="grid grid-cols-2 gap-4">
        <PageHeader
          title="Notifications"
          description="Customize how and when you want to be notified."
        />

        <SectionDivider label="Friend Activity" />

        <BentoCard
          icon={<Users size={16} />}
          title="Friend Online"
          description="Alert when a friend comes online."
        >
          <BentoToggle
            checked={notifyFriendOnline}
            onChange={() => setNotifyFriendOnline(!notifyFriendOnline)}
            label={notifyFriendOnline ? "On" : "Off"}
          />
        </BentoCard>

        <BentoCard
          icon={<Bell size={16} />}
          title="Friend Starts Playing"
          description="Alert when a friend joins a game."
        >
          <BentoToggle
            checked={notifyFriendInGame}
            onChange={() => setNotifyFriendInGame(!notifyFriendInGame)}
            label={notifyFriendInGame ? "On" : "Off"}
          />
        </BentoCard>

        <BentoCard
          icon={<UserMinus size={16} />}
          title="Friend Removed You"
          description="Get notified when someone unfriends you. Useful for keeping track of your friends list."
          colSpan={2}
          accent="warning"
        >
          <BentoToggle
            checked={notifyFriendRemoved}
            onChange={() => setNotifyFriendRemoved(!notifyFriendRemoved)}
            label={notifyFriendRemoved ? "Enabled" : "Disabled"}
          />
        </BentoCard>

        <SectionDivider label="Sessions" />

        <BentoCard
          icon={<MapPin size={16} />}
          title="Server Location"
          description="Display the geographic location of the server when you join a Roblox game."
          colSpan={2}
        >
          <BentoToggle
            checked={notifyServerLocation}
            onChange={() => setNotifyServerLocation(!notifyServerLocation)}
            label={notifyServerLocation ? "Enabled" : "Disabled"}
          />
        </BentoCard>
      </div>
    </motion.div>
  );
};
