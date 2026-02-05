import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/assets/logo/nexus-q-logo.png";

export function SplashGate({
  children,
  ready,
}: {
  children: React.ReactNode;
  ready: boolean;
}) {
  const [visible, setVisible] = React.useState(true);

  // Ensure splash respects saved theme immediately
  React.useLayoutEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Hide splash only when app is ready
  React.useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setVisible(false), 500);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex flex-col items-center gap-6">
              {/* Logo with glow pulse */}
              <motion.img
                src={Logo}
                alt="Nexus Q"
                className="h-28 w-auto select-none"
                animate={{
                  scale: [1, 1.04, 1],
                  filter: [
                    "drop-shadow(0 0 0px transparent)",
                    "drop-shadow(0 0 18px hsl(var(--primary)))",
                    "drop-shadow(0 0 0px transparent)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Loading bar */}
              <div className="h-1 w-14 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>

              {/* Footer note */}
              <div className="absolute bottom-6 text-[10px] tracking-widest uppercase text-muted-foreground">
                Demo Mode
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!visible && children}
    </>
  );
}
