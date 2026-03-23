import React from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { loadAppSettings, SETTINGS_CHANGED_EVENT } from "@/lib/userSettings";

const Dashboard = React.lazy(() => import("@/pages/dashboard").then((m) => ({ default: m.Dashboard })));
const Pipeline = React.lazy(() => import("@/pages/pipeline").then((m) => ({ default: m.Pipeline })));
const LeadIntake = React.lazy(() => import("@/pages/intake").then((m) => ({ default: m.LeadIntake })));
const Health = React.lazy(() => import("@/pages/health").then((m) => ({ default: m.Health })));
const NotificationsPage = React.lazy(() => import("@/pages/notifications").then((m) => ({ default: m.NotificationsPage })));
const SettingsPage = React.lazy(() => import("@/pages/settings").then((m) => ({ default: m.SettingsPage })));
const AboutPage = React.lazy(() => import("@/pages/about").then((m) => ({ default: m.AboutPage })));

const pageVariants = {
  initial: { opacity: 0, y: 10, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -10, filter: "blur(4px)" },
};

function RouteFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const [homePath, setHomePath] = React.useState(() => loadAppSettings().defaultLandingPage);

  React.useEffect(() => {
    const onSettingsChanged = () => setHomePath(loadAppSettings().defaultLandingPage);
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as EventListener);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as EventListener);
  }, []);

  return (
    <React.Suspense fallback={<RouteFallback />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeOut" }}>
                {homePath !== "/" ? <Navigate to={homePath} replace /> : <Dashboard />}
              </motion.div>
            }
          />
          <Route
            path="/pipeline"
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeOut" }}>
                <Pipeline />
              </motion.div>
            }
          />
          <Route
            path="/intake"
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeOut" }}>
                <LeadIntake />
              </motion.div>
            }
          />
          <Route
            path="/health"
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeOut" }}>
                <Health />
              </motion.div>
            }
          />
          <Route
            path="/notifications"
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeOut" }}>
                <NotificationsPage />
              </motion.div>
            }
          />
          <Route
            path="/settings"
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeOut" }}>
                <SettingsPage />
              </motion.div>
            }
          />
          <Route
            path="/about"
            element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeOut" }}>
                <AboutPage />
              </motion.div>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </React.Suspense>
  );
}

export default AnimatedRoutes;
