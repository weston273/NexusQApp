import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";

export default function RouteProgress() {
  const location = useLocation();
  const [visible, setVisible] = React.useState(false);
  const [key, setKey] = React.useState(0);

  React.useEffect(() => {
    setKey((k) => k + 1);
    setVisible(true);

    const t = setTimeout(() => setVisible(false), 550);
    return () => clearTimeout(t);
  }, [location.pathname]);

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
