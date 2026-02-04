import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/assets/logo/nexus-q-logo.png";

type SplashGateProps = {
  children: React.ReactNode;
  ready: boolean; // ← controlled by Supabase load
};

export function SplashGate({ children, ready }: SplashGateProps) {
  return (
    <>
      <AnimatePresence>
        {!ready && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="relative flex flex-col items-center gap-6">
              
              {/* Glow pulse */}
              <motion.div
                className="absolute h-72 w-72 rounded-full bg-primary/20 blur-3xl"
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Logo */}
              <motion.img
                src={Logo}
                alt="Nexus Q"
                className="relative h-64 w-auto select-none"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              />

              {/* Loading bar */}
              <div className="h-1 w-16 rounded-full bg-muted-foreground/30 overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              {/* Demo mode label */}
              <div className="absolute bottom-[-48px] text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Demo Mode
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {ready && children}
    </>
  );
}
