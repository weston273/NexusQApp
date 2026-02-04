import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { Dashboard } from "@/pages/dashboard";
import { Pipeline } from "@/pages/pipeline";
import { LeadIntake } from "@/pages/intake";
import { Health } from "@/pages/health";

const pageVariants = {
  initial: { opacity: 0, y: 10, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -10, filter: "blur(4px)" },
};

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeOut" }}>
              <Dashboard />
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
          path="/settings"
          element={
            <motion.div
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="p-8 text-center text-muted-foreground"
            >
              Settings module under development.
            </motion.div>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

export default AnimatedRoutes;
