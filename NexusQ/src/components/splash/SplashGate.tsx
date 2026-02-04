import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/assets/logo/nexus-q-logo.png";

export function SplashGate({ children }: { children: React.ReactNode }) {
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDone(true), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <AnimatePresence>
        {!done && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center gap-4"
            >
              <img
                src={Logo}
                alt="Nexus Q"
                className="h-64 w-auto select-none"
              />

              {/* optional subtle loading hint */}
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30 overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {done && children}
    </>
  );
}
