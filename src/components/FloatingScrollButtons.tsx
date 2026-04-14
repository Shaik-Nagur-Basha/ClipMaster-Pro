import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconArrowUp, IconArrowDown } from "./Icons";

interface FloatingScrollButtonsProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

const FloatingScrollButtons: React.FC<FloatingScrollButtonsProps> = ({
  containerRef,
}) => {
  const [showTopButton, setShowTopButton] = useState(false);
  const [showBottomButton, setShowBottomButton] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtTop = scrollTop < 100;
      const isAtBottom = scrollTop + clientHeight > scrollHeight - 100;

      setShowTopButton(!isAtTop);
      setShowBottomButton(!isAtBottom);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef]);

  const scrollToTop = () => {
    containerRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const scrollToBottom = () => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  return (
    <div className="fixed right-6 bottom-6 flex flex-col gap-3 pointer-events-none z-50">
      {/* Scroll Up Button */}
      <AnimatePresence>
        {showTopButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.4, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.4, y: 12 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            onClick={scrollToTop}
            title="Scroll to top"
            className="pointer-events-auto w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-brand-300 flex items-center justify-center transition-all duration-250 border border-white/0 hover:border-white/10 backdrop-blur-sm"
          >
            <IconArrowUp size={15} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Scroll Down Button */}
      <AnimatePresence>
        {showBottomButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.4, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.4, y: -12 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            onClick={scrollToBottom}
            title="Scroll to bottom"
            className="pointer-events-auto w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-brand-300 flex items-center justify-center transition-all duration-250 border border-white/0 hover:border-white/10 backdrop-blur-sm"
          >
            <IconArrowDown size={15} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingScrollButtons;
