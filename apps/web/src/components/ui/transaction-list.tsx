'use client';

import {
  AnimatePresence,
  motion,
  MotionConfig,
  type Transition,
} from 'motion/react';

import { useState, useCallback, useLayoutEffect, useRef } from 'react';
import { ArrowRight, X } from 'lucide-react';

/**
 * Self-contained replacement for `react-use-measure` (not a project dep).
 * Returns a ref callback + the measured bounds, kept in sync via a
 * ResizeObserver so the card can animate its height on expand/collapse.
 */
function useMeasure<T extends HTMLElement = HTMLElement>(): [
  (node: T | null) => void,
  { height: number; width: number },
] {
  const [bounds, setBounds] = useState({ height: 0, width: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setBounds({ height: rect.height, width: rect.width });
    });
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useLayoutEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, bounds];
}

export interface MoveCharge {
  id: string;
  icon: React.ReactNode;
  /** Service / expense name, e.g. "Two Men & a Truck". */
  name: string;
  /** Category label, e.g. "Movers", "Utilities", "Subscription". */
  category: string;
  /** Signed amount string, e.g. "-$1,250.00" or "+$300.00". */
  amount: string;
  /** True for money coming in (deposit refund, credit). */
  isCredit?: boolean;
  date: string;
  time: string;
  /** Reference / confirmation number. */
  reference: string;
  paymentMethod: string;
  cardNumber: string;
  cardType: string;
}

const springConfig: Transition = {
  type: 'spring',
  bounce: 0,
  duration: 0.6,
};

const opacityConfig: Transition = {
  duration: 0.4,
  ease: [0.19, 1, 0.22, 1],
};

export function TransactionList({ charges }: { charges: MoveCharge[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const isOpen = open === null;
  const [ref, bounds] = useMeasure<HTMLDivElement>();

  const selected = charges.find((t) => t.id === open) ?? null;

  return (
    <MotionConfig transition={springConfig}>
      <motion.div
        className="flex items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted shadow-sm"
        animate={{ height: bounds.height > 0 ? bounds.height : 'auto' }}
      >
        <div className="p-3" ref={ref}>
          <AnimatePresence mode="popLayout">
            {isOpen ? (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={opacityConfig}
                className="flex w-64 flex-col gap-2"
              >
                <span className="font-medium text-muted-foreground">
                  This month
                </span>

                {charges.map((item) => (
                  <ChargeItem
                    key={item.id}
                    data={item}
                    onClick={() => setOpen(item.id)}
                  />
                ))}

                <button className="flex items-center justify-center gap-1 rounded-sm py-1 text-foreground">
                  <p className="text-sm">All charges</p>
                  <ArrowRight size={14} />
                </button>
              </motion.div>
            ) : (
              selected && (
                <motion.div exit={{ opacity: 0 }}>
                  <ChargeItemExpanded
                    data={selected}
                    onClose={() => setOpen(null)}
                  />
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </MotionConfig>
  );
}

function ChargeItem({
  data,
  onClick,
}: {
  data: MoveCharge;
  onClick: () => void;
}) {
  return (
    <div className="flex w-64 cursor-pointer gap-2" onClick={onClick}>
      <motion.div
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
        layoutId={`icon-${data.id}`}
      >
        <div className="flex items-center justify-center">{data.icon}</div>
      </motion.div>

      <div className="flex flex-1 flex-col justify-center text-xs">
        <motion.p
          className="font-semibold text-foreground"
          layoutId={`name-${data.id}`}
        >
          {data.name}
        </motion.p>

        <motion.p
          className="text-muted-foreground"
          layoutId={`category-${data.id}`}
        >
          {data.category}
        </motion.p>
      </div>

      <motion.p
        className={`flex items-center text-xs font-medium ${
          data.isCredit ? 'text-success' : 'text-muted-foreground'
        }`}
        layoutId={`amount-${data.id}`}
      >
        {data.amount}
      </motion.p>
    </div>
  );
}

function ChargeItemExpanded({
  data,
  onClose,
}: {
  data: MoveCharge;
  onClose: () => void;
}) {
  return (
    <div className="flex w-64 flex-col gap-2">
      <div className="flex justify-between">
        <motion.div
          className="flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary"
          layoutId={`icon-${data.id}`}
        >
          {data.icon}
        </motion.div>

        <div
          className="flex cursor-pointer items-center justify-center self-start rounded-full bg-accent p-2 text-foreground"
          onClick={onClose}
        >
          <X className="size-4" />
        </div>
      </div>

      <div className="flex justify-between">
        <div>
          <motion.p
            className="font-semibold text-foreground"
            layoutId={`name-${data.id}`}
          >
            {data.name}
          </motion.p>

          <motion.p
            className="text-sm text-muted-foreground"
            layoutId={`category-${data.id}`}
          >
            {data.category}
          </motion.p>
        </div>

        <motion.p
          className={data.isCredit ? 'text-success' : 'text-foreground'}
          layoutId={`amount-${data.id}`}
        >
          {data.amount}
        </motion.p>
      </div>

      <motion.div
        className="flex flex-col gap-2 text-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          ...opacityConfig,
          delay: 0.1,
        }}
      >
        <div className="border border-dashed border-border" />

        <p className="text-muted-foreground">Ref #{data.reference}</p>

        <p className="text-muted-foreground">{data.date}</p>

        <p className="text-muted-foreground">{data.time}</p>

        <div className="border border-dashed border-border" />

        <p className="text-muted-foreground">Paid via {data.paymentMethod}</p>

        <p className="text-muted-foreground">
          XXXX {data.cardNumber}{' '}
          <span className="font-bold uppercase italic text-foreground">
            {data.cardType}
          </span>
        </p>
      </motion.div>
    </div>
  );
}
