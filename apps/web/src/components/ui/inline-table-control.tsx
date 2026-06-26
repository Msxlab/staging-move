'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Pencil, X, Check, Tag, CalendarDays, DollarSign } from 'lucide-react';

/**
 * A LocateFlow subscription / service line-item.
 *  - service:  name of the subscription or service (e.g. 'Netflix', 'Internet')
 *  - amount:   monthly cost (string, no currency symbol — '15.99')
 *  - renewal:  next renewal date label (e.g. 'Jul 14')
 *  - category: service category (e.g. 'Streaming', 'Utilities')
 */
export interface TableItem {
  id: string;
  service: string;
  amount: string;
  renewal: string;
  category: string;
}

interface InlineTableControlProps {
  data: TableItem[];
  onUpdate?: (item: TableItem) => void;
  className?: string;
}

const FIELDS = ['service', 'amount', 'renewal', 'category'] as const;
type Field = (typeof FIELDS)[number];

const FIELD_LABEL: Record<Field, string> = {
  service: 'Service',
  amount: 'Amount',
  renewal: 'Renewal',
  category: 'Category',
};

const getIcon = (field: Field) => {
  const iconClass = 'text-muted-foreground';
  if (field === 'service') return <Tag size={18} className={iconClass} />;
  if (field === 'amount')
    return <DollarSign size={18} className={iconClass} />;
  if (field === 'renewal')
    return <CalendarDays size={18} className={iconClass} />;
  if (field === 'category') return <Tag size={18} className={iconClass} />;
  return null;
};

/**
 * InlineTableControl — inline-editable table for LocateFlow subscriptions /
 * services. Columns: service name, amount, renewal date, category. Click the
 * pencil to edit a row in place; amounts and names commit on Done. The same
 * control backs an editable addresses table. Re-themed onto our sapphire
 * tokens — surfaces, borders, focus ring, and the primary action button all
 * resolve through the CSS-var theme so light/dark switch automatically (no
 * hardcoded neutral/white/black/blue, no gold).
 */
export const InlineTableControl: React.FC<InlineTableControlProps> = ({
  data,
  onUpdate,
  className = '',
}) => {
  const [items, setItems] = useState<TableItem[]>(data);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<TableItem | null>(null);

  useEffect(() => {
    setItems(data);
  }, [data]);

  const handleDone = () => {
    if (editValues) {
      const updatedItems = items.map((item) =>
        item.id === editValues.id ? editValues : item,
      );
      setItems(updatedItems);
      onUpdate?.(editValues);
      setEditingId(null);
      setEditValues(null);
    }
  };

  const layoutTransition = {
    type: 'spring' as const,
    bounce: 0,
    duration: 0.7,
  };

  return (
    <div
      className={`flex w-full flex-col items-center justify-center p-4 antialiased select-none sm:p-10 ${className}`}
    >
      <div className="w-full max-w-lg">
        <motion.div
          layout
          transition={layoutTransition}
          className={`hidden grid-cols-[1.2fr_0.8fr_0.9fr_1fr] px-6 py-4 text-sm font-semibold tracking-wider capitalize transition-all duration-300 sm:grid ${editingId ? 'opacity-20 blur-[1px]' : 'opacity-100'} text-muted-foreground`}
        >
          <motion.div layout className="flex items-center gap-2">
            <Tag size={18} /> Service
          </motion.div>
          <motion.div layout className="flex items-center gap-2">
            <DollarSign size={18} /> Amount
          </motion.div>
          <motion.div layout className="flex items-center gap-2">
            <CalendarDays size={18} /> Renewal
          </motion.div>
          <motion.div layout className="flex items-center gap-2">
            <Tag size={18} /> Category
          </motion.div>
        </motion.div>

        <LayoutGroup>
          <div className="flex flex-col gap-2 sm:gap-0">
            {items.map((item) => (
              <div key={item.id} className="relative">
                {!editingId && (
                  <motion.div
                    layoutId={`divider-${item.id}`}
                    className="mx-6 hidden h-px bg-border sm:block"
                  />
                )}

                <AnimatePresence mode="popLayout">
                  {editingId === item.id ? (
                    <motion.div
                      layoutId={`container-${item.id}`}
                      transition={layoutTransition}
                      className="relative z-20 my-2 rounded-2xl border-[1.4px] border-r-0 border-l-0 border-border bg-card p-4 shadow-xl sm:my-4 sm:rounded-none sm:p-8 sm:py-4 sm:shadow-none"
                    >
                      <motion.div className="space-y-4 sm:space-y-5">
                        {FIELDS.map((field) => (
                          <div
                            key={field}
                            className="flex flex-col gap-1 sm:grid sm:grid-cols-[120px_1fr] sm:items-center sm:gap-0"
                          >
                            <motion.label
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.3, delay: 0.1 }}
                              className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase sm:text-sm sm:capitalize"
                            >
                              {getIcon(field)} {FIELD_LABEL[field]}
                            </motion.label>
                            <motion.div
                              layout="position"
                              transition={layoutTransition}
                              className="flex w-full items-center rounded-xl border-[1.6px] border-border bg-muted px-4 py-2.5 focus-within:border-ring sm:py-2"
                            >
                              <motion.input
                                layoutId={`${field}-${item.id}`}
                                layout="position"
                                title="edit text"
                                type="text"
                                value={editValues ? editValues[field] : ''}
                                transition={layoutTransition}
                                onChange={(e) =>
                                  setEditValues((prev) =>
                                    prev
                                      ? { ...prev, [field]: e.target.value }
                                      : null,
                                  )
                                }
                                className="relative z-[999] w-full bg-transparent text-base font-bold text-foreground outline-none sm:text-sm"
                              />
                            </motion.div>
                          </div>
                        ))}
                      </motion.div>

                      <div className="mt-6 flex flex-row justify-end gap-2 sm:mt-4">
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditValues(null);
                          }}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-muted px-5 py-3 text-sm font-bold text-muted-foreground sm:flex-none sm:py-2 hover:bg-accent"
                        >
                          <X size={18} /> <span>Cancel</span>
                        </button>
                        <button
                          onClick={handleDone}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground sm:flex-none sm:py-2 hover:bg-primary/90"
                        >
                          <Check size={18} /> <span>Done</span>
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      layout="position"
                      layoutId={`container-${item.id}`}
                      transition={layoutTransition}
                      animate={{
                        opacity: editingId ? 0.35 : 1,
                        filter: editingId ? 'blur(1px)' : 'blur(0px)',
                      }}
                      className={`group grid cursor-default grid-cols-[1fr_auto_40px] items-center rounded-2xl px-4 py-4 transition-all duration-300 sm:grid-cols-[1.2fr_0.8fr_0.9fr_1fr_40px] sm:rounded-none sm:px-6 sm:py-5 ${
                        editingId
                          ? ''
                          : 'border border-border bg-card/50 opacity-100 hover:bg-accent sm:border-none sm:bg-transparent'
                      }`}
                    >
                      <motion.div className="flex flex-col">
                        <motion.div
                          layoutId={`service-${item.id}`}
                          layout="position"
                          className="flex text-sm font-bold text-foreground sm:text-base"
                        >
                          <motion.span
                            layout="position"
                            transition={layoutTransition}
                          >
                            {item.service}
                          </motion.span>
                        </motion.div>
                        <motion.div
                          layoutId={`category-mobile-${item.id}`}
                          layout="position"
                          className="flex text-xs font-medium text-muted-foreground sm:hidden"
                        >
                          <motion.span
                            layout="position"
                            transition={layoutTransition}
                          >
                            {item.category} · {item.renewal}
                          </motion.span>
                        </motion.div>
                      </motion.div>

                      <motion.div
                        layoutId={`amount-${item.id}`}
                        layout="position"
                        className="flex justify-end text-sm font-bold text-foreground sm:order-none sm:justify-start sm:text-base"
                      >
                        <motion.span
                          layout="position"
                          transition={layoutTransition}
                          className="flex items-center"
                        >
                          <span className="mr-0.5 text-muted-foreground">
                            $
                          </span>
                          {item.amount}
                        </motion.span>
                      </motion.div>

                      <motion.div
                        layoutId={`renewal-${item.id}`}
                        layout="position"
                        className="hidden text-sm font-semibold text-muted-foreground sm:flex"
                      >
                        <motion.span
                          layout="position"
                          transition={layoutTransition}
                        >
                          {item.renewal}
                        </motion.span>
                      </motion.div>

                      <motion.div
                        layoutId={`category-${item.id}`}
                        layout="position"
                        className="hidden text-sm font-semibold text-muted-foreground sm:flex"
                      >
                        <motion.span
                          layout="position"
                          transition={layoutTransition}
                        >
                          {item.category}
                        </motion.span>
                      </motion.div>

                      <button
                        title="edit"
                        onClick={() => {
                          setEditValues({ ...item });
                          setEditingId(item.id);
                        }}
                        className="flex justify-end text-muted-foreground transition-transform hover:text-foreground active:scale-125"
                      >
                        <Pencil size={18} strokeWidth={2.5} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </LayoutGroup>
      </div>
    </div>
  );
};
