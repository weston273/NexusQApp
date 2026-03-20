import * as React from "react";
import { useNotificationCenter } from "@/features/notifications/useNotificationCenter";

type NotificationCenterValue = ReturnType<typeof useNotificationCenter>;

const NotificationCenterContext = React.createContext<NotificationCenterValue | undefined>(undefined);

export function NotificationCenterProvider({ children }: { children: React.ReactNode }) {
  const value = useNotificationCenter(60);
  return <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>;
}

export function useNotificationCenterContext() {
  const context = React.useContext(NotificationCenterContext);
  if (!context) {
    throw new Error("useNotificationCenterContext must be used within NotificationCenterProvider.");
  }
  return context;
}
