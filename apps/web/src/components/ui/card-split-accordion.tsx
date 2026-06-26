'use client';

import React, { useState, useRef, useEffect, type FC } from 'react';
import { motion, MotionConfig, type Transition } from 'motion/react';
import {
  ChevronDown,
  Boxes,
  Plug,
  MailPlus,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';

/* Lightweight element-height hook so the accordion has zero extra deps
   (replaces `react-use-measure`, which is not installed). Tracks the
   measured content height and updates on resize. */
function useMeasuredHeight<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number,
] {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, height];
}

export interface AccordionItemData {
  id: number;
  title: string;
  icon: React.ReactNode;
  content: string;
}

interface AccordionItemProps {
  item: AccordionItemData;

  setOpenId: (id: number | null) => void;
  index: number;
  total: number;
  openIndex: number;
}
interface AccordionProps {
  items?: AccordionItemData[];
}

const springTransition: Transition = {
  type: 'spring',
  stiffness: 600,
  damping: 50,
  mass: 1,
};

/* LocateFlow use-case: moving-checklist accordion. Each item is a plan phase
   / task group that expands to its checklist details. */
const DEFAULT_ITEMS: AccordionItemData[] = [
  {
    id: 1,
    title: 'Before the move',
    icon: <CalendarClock className="size-4" />,
    content:
      'Book your mover, confirm the moving date, and start a room-by-room inventory. Aim to complete this 4–6 weeks out.',
  },
  {
    id: 2,
    title: 'Packing & inventory',
    icon: <Boxes className="size-4" />,
    content:
      'Label boxes by room, photograph valuables, and set aside an essentials box for the first night in your new home.',
  },
  {
    id: 3,
    title: 'Utilities',
    icon: <Plug className="size-4" />,
    content:
      'Schedule disconnection at your old address and connection at the new one: electricity, gas, water, and internet.',
  },
  {
    id: 4,
    title: 'Address changes',
    icon: <MailPlus className="size-4" />,
    content:
      'Update your address with the post office, bank, employer, insurer, and any subscriptions before move day.',
  },
  {
    id: 5,
    title: 'After the move',
    icon: <ShieldCheck className="size-4" />,
    content:
      'Test smoke detectors, confirm all services are live, and check off any damaged-item claims with your mover.',
  },
];

const AccordionItem: FC<AccordionItemProps> = ({
  item,
  setOpenId,
  index,
  total,
  openIndex,
}) => {
  const [ref, measuredHeight] = useMeasuredHeight<HTMLDivElement>();
  const isOpen = index === openIndex;

  const isFirst = index === 0;
  const isLast = index === total - 1;

  const isBeforeOpen = index === openIndex - 1;
  const isAfterOpen = index === openIndex + 1;

  const isAlone = (isAfterOpen && isLast) || (isBeforeOpen && isFirst);

  const BORDER_WIDTH = '1px';
  const BORDER_STYLE = 'solid';
  const borderTopWidth =
    isFirst || isAfterOpen || isOpen ? BORDER_WIDTH : '0px';
  const borderBottomWidth =
    isLast || isBeforeOpen || isOpen ? BORDER_WIDTH : '0px';
  const borderLeftWidth = BORDER_WIDTH;
  const borderRightWidth = BORDER_WIDTH;

  let borderTopLeftRadius = 0;
  let borderTopRightRadius = 0;
  let borderBottomLeftRadius = 0;
  let borderBottomRightRadius = 0;

  if (isOpen || isAlone) {
    borderTopLeftRadius = 20;
    borderTopRightRadius = 20;
    borderBottomLeftRadius = 20;
    borderBottomRightRadius = 20;
  } else if (isBeforeOpen) {
    borderBottomLeftRadius = 20;
    borderBottomRightRadius = 20;
  } else if (isAfterOpen) {
    borderTopLeftRadius = 20;
    borderTopRightRadius = 20;
  } else if (isFirst) {
    borderTopLeftRadius = 20;
    borderTopRightRadius = 20;
  } else if (isLast) {
    borderBottomLeftRadius = 20;
    borderBottomRightRadius = 20;
  }

  return (
    <MotionConfig transition={springTransition}>
      <motion.li layout>
        <motion.div
          animate={{
            borderTopLeftRadius,
            borderTopRightRadius,
            borderBottomLeftRadius,
            borderBottomRightRadius,
          }}
          className="overflow-hidden border-solid border-border bg-card will-change-transform"
          style={{
            borderTopWidth,
            borderBottomWidth,
            borderLeftWidth,
            borderRightWidth,
            borderStyle: BORDER_STYLE,
            marginBlock: isOpen ? '10px' : '0px',
          }}
        >
          <button
            onClick={() => setOpenId(isOpen ? null : item.id)}
            className="flex w-full cursor-pointer items-center justify-between px-[12px] py-[10px]"
          >
            <div className="flex items-center gap-[12px] text-primary">
              {item.icon}

              <span className="text-sm font-bold text-foreground md:text-lg">
                {item.title}
              </span>
            </div>

            <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
              <ChevronDown className="size-5 text-muted-foreground md:size-[1.625rem]" />
            </motion.div>
          </button>

          <motion.div
            initial={false}
            animate={{
              height: isOpen ? measuredHeight : 0,
              opacity: isOpen ? 1 : 0,
            }}
            className="overflow-hidden will-change-transform"
          >
            <div ref={ref}>
              <div className="px-5 pb-5 text-xs font-medium text-muted-foreground md:text-[18px]">
                {item.content}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.li>
    </MotionConfig>
  );
};

export const AccordionApp: FC<AccordionProps> = ({ items }) => {
  const defaultItems = items ?? DEFAULT_ITEMS;

  const [openId, setOpenId] = useState<number | null>(null);

  const openIndex = defaultItems.findIndex((item) => item.id === openId);

  return (
    <div className="flex w-full flex-col items-center justify-center p-6 transition-colors duration-500">
      <ul className="w-full max-w-xs md:max-w-sm">
        {defaultItems.map((item, index) => (
          <AccordionItem
            key={item.id}
            item={item}
            setOpenId={setOpenId}
            index={index}
            total={defaultItems.length}
            openIndex={openIndex}
          />
        ))}
      </ul>
    </div>
  );
};
