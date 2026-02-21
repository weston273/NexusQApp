import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { onProgress } from "@/lib/progressBus";

export default function RouteProgress() {
  const location = useLocation();
  const [visible, setVisible] = React.useState(false);
  const [key, setKey] = React.useState(0);

  const timeoutRef = React.useRef<number | null>(null);

  const run = React.useCallback((ms = 550) => {
    // clear previous timer
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    setKey((k) => k + 1);
    setVisible(true);

    timeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      timeoutRef.current = null;
    }, ms);
  }, []);

  // cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  // 1) Route transitions
  React.useEffect(() => {
    run(550);
  }, [location.pathname, run]);

  // 2) Manual triggers (Supabase fetch/realtime)
 // 2) Manual triggers (Supabase fetch/realtime)
React.useEffect(() => {
  const off = onProgress((ms) => run(ms ?? 550));
  return () => {
    off(); // ✅ unsubscribe
  };
}, [run]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={key}
          className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: "95%" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
