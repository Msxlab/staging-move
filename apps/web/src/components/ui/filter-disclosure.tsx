"use client";

import { useState, type FC } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { FaBell, FaTasks } from "react-icons/fa";
import { IoCalendar } from "react-icons/io5";
import { BsCheckLg, BsPinFill } from "react-icons/bs";
import { PiFunnelSimpleBold } from "react-icons/pi";
import { MdSubscriptions } from "react-icons/md";
import { TbMapPin, TbBolt, TbShieldCheck, TbTruck } from "react-icons/tb";
import type { IconType } from "react-icons";

export interface FilterItem {
  id: string;
  label: string;
  icon: IconType;
}

interface FilterDisclosureProps {
  items?: FilterItem[];
  defaultActiveId?: string;
  onChange?: (id: string) => void;
}

const SPRING = {
  type: "spring",
  stiffness: 240,
  damping: 20,
  mass: 1,
} as const;

/**
 * LocateFlow default: filter the Reminders/Tasks list by reminder type.
 * Repurposed from the original Tasks/Events/Reminders/Appointment/Meetings/
 * Celebrations demo groups. Pass `items` to reuse the same collapsible
 * control for the Subscriptions-by-category or Providers-by-service-area
 * lists (see REMINDER_FILTERS / SUBSCRIPTION_FILTERS / PROVIDER_FILTERS).
 */
export const REMINDER_FILTERS: FilterItem[] = [
  { id: "tasks", label: "Tasks", icon: FaTasks },
  { id: "events", label: "Events", icon: IoCalendar },
  { id: "appointments", label: "Appointments", icon: BsPinFill },
  { id: "reminders", label: "Reminders", icon: FaBell },
];

export const SUBSCRIPTION_FILTERS: FilterItem[] = [
  { id: "streaming", label: "Streaming", icon: MdSubscriptions },
  { id: "utilities", label: "Utilities", icon: TbBolt },
  { id: "insurance", label: "Insurance", icon: TbShieldCheck },
];

export const PROVIDER_FILTERS: FilterItem[] = [
  { id: "movers", label: "Movers", icon: TbTruck },
  { id: "utilities", label: "Utility setup", icon: TbBolt },
  { id: "local", label: "In service area", icon: TbMapPin },
];

export const FilterDisclosure: FC<FilterDisclosureProps> = ({
  items = REMINDER_FILTERS,
  defaultActiveId = "reminders",
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(defaultActiveId);

  const activeItem = items.find((i) => i.id === active);
  const ActiveIcon = activeItem ? activeItem.icon : FaTasks;

  const handleSelect = (id: string) => {
    setActive(id);
    onChange?.(id);
    setTimeout(() => setOpen(false), 220);
  };

  return (
    <div className="flex h-[70px] w-[300px] items-center justify-center">
      <MotionConfig
        transition={{
          type: "spring",
          bounce: 0.25,
          duration: 0.7,
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {open ? (
            <motion.div
              key="open"
              layoutId="filter-disclosure"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                transition: { duration: 0 },
              }}
              style={{ transformOrigin: "50% 100%", borderRadius: 32 }}
              className="absolute z-20 flex w-[300px] flex-col gap-[4px] overflow-hidden rounded-2xl border-[1.6px] border-border bg-card p-[8px] shadow-[0_12px_40px_rgba(0,0,0,0.08)] will-change-transform"
            >
              {items.map((item, index) => {
                const Icon = item.icon;
                const selected = active === item.id;

                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, scale: 1.1, y: 40 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    onClick={() => handleSelect(item.id)}
                    whileTap={{ scale: 0.98 }}
                    transition={{ ...SPRING, delay: (3 + index) * 0.05 }}
                    className="flex w-full cursor-pointer items-center justify-between rounded-[16px] px-[12px] py-[10px] transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-[28px]">
                      <Icon className="h-[24px] w-[24px] text-muted-foreground" />
                      <span className="text-[18px] font-bold tracking-tight text-foreground">
                        {item.label}
                      </span>
                    </div>

                    <motion.div
                      animate={{
                        backgroundColor: selected
                          ? "var(--success)"
                          : "rgba(0,0,0,0)",
                      }}
                      className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-[3px] ${
                        selected ? "border-success" : "border-border"
                      } `}
                    >
                      <motion.div
                        animate={{
                          scale: selected ? 1 : 0,
                          opacity: selected ? 1 : 0,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 520,
                          damping: 30,
                        }}
                      >
                        <BsCheckLg className="h-[16px] w-[16px] text-white" />
                      </motion.div>
                    </motion.div>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <div key="close" className="flex items-center">
              <motion.button
                layoutId="filter-disclosure"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0 },
                }}
                onClick={() => setOpen(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  borderRadius: 32,
                }}
                aria-label="Open filters"
                className="z-30 flex h-[60px] w-[60px] cursor-pointer items-center justify-center rounded-full border-[1.6px] border-border bg-card shadow-sm will-change-transform"
              >
                <PiFunnelSimpleBold className="h-[30px] w-[30px] text-foreground" />
              </motion.button>

              <motion.div
                initial={{ x: -30 }}
                animate={{ x: 0 }}
                transition={{
                  type: "spring",
                  bounce: 0,
                  duration: 1.2,
                }}
                className="z-10 -ml-[12px] flex h-[60px] w-[60px] items-center justify-center rounded-full border-[1.6px] border-border bg-card opacity-80 shadow-sm"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                  >
                    <ActiveIcon className="h-[24px] w-[24px] text-muted-foreground" />
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
};
