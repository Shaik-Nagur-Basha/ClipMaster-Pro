import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PageSizeDropdownProps {
  value: number;
  onChange: (v: number) => void;
}

const PageSizeDropdown: React.FC<PageSizeDropdownProps> = ({
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const options = [10, 20, 50, 100];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div className="flex items-center gap-1.5 normal-case">
        <span className="text-gray-500 font-medium">Show:</span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-black/95 border-gray-700 text-gray-300 rounded-md px-2 py-0.5 hover:bg-surface-800 hover:text-white transition-colors focus:outline-none cursor-pointer text-[10px] font-semibold flex items-center gap-1 min-w-[32px] justify-center"
        >
          {value}
          <span className="text-gray-500 text-[8px]">▼</span>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute left-1/2 z-50 min-w-[30px] bg-surface-800 border border-gray-700 rounded-md shadow-lg p-1 flex flex-col gap-1 top-full mt-1"
          >
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`w-full text-center px-1 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                  value === opt
                    ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                    : "text-gray-400 hover:bg-surface-700 hover:text-white border border-transparent"
                }`}
              >
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PageSizeDropdown;
