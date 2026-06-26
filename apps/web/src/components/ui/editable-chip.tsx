'use client';

import {
  useState,
  useRef,
  useEffect,
  type FC,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { BiSolidPencil } from 'react-icons/bi';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableChipProps {
  /** Current label, e.g. an address nickname ('Home'), a service category, or a family member name. */
  defaultLabel?: string;
  /** Fired with the committed value on Enter / confirm. */
  onChange?: (value: string) => void;
}

/**
 * EditableChip — inline-editable tag/label for LocateFlow.
 * Used to rename addresses ('Home' / 'Office' / 'Storage'), tag services by
 * category, or label family members. Click the pencil to edit, commit on Enter
 * or by pressing the confirm (check) button. Re-themed onto our sapphire tokens:
 * the chip surface, ring, and confirm button all resolve through the CSS-var
 * theme so light/dark switch automatically (no hardcoded hex, no gold).
 */
export const EditableChip: FC<EditableChipProps> = ({
  defaultLabel = 'Home',
  onChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState<string>(defaultLabel);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing]);

  const handleSave = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    const finalValue = label.trim() === '' ? 'Untitled' : label;
    setLabel(finalValue);
    setIsEditing(false);
    onChange?.(finalValue);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  return (
      <motion.div layout>
        <div
          className={cn(
            `relative flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full border border-border bg-card py-1 pr-1 transition-all duration-300 ease-in-out select-none`,
            isEditing && 'gap-8 ring-2 ring-ring',
          )}
        >
          <motion.input
            layout="position"
            key="input"
            ref={inputRef}
            type="text"
            value={label}
            readOnly={!isEditing}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setLabel(e.target.value)
            }
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
              e.key === 'Enter' && handleSave(e)
            }

            onClick={(e: MouseEvent) => e.stopPropagation()}
            className="ml-4 w-32 border-none bg-transparent text-lg font-medium text-foreground capitalize outline-none selection:bg-primary/20"
          />

          <AnimatePresence mode="popLayout">
            {isEditing ? (
              <motion.button
                key="done"
                initial={{ opacity: 0, filter: 'blur(4px)', scale: 0 }}
                animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                exit={{ opacity: 0, filter: 'blur(4px)', scale: 0 }}
                layout="position"
                onClick={handleSave}
                transition={{
                  type: 'spring',
                  bounce: 0,
                  duration: 0.4,
                }}
                className="rounded-full bg-primary p-1 text-primary-foreground transition-colors"
              >
                <Check size={26} />
              </motion.button>
            ) : (
              <motion.button
                key="edit"
                initial={{ opacity: 0, filter: 'blur(4px)', scale: 0 }}
                animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                exit={{ opacity: 0, filter: 'blur(4px)', scale: 0 }}
                layout="position"
                onClick={handleEdit}
                transition={{
                  type: 'spring',
                  bounce: 0,
                  duration: 0.4,
                }}
                className="rounded-full bg-muted p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <BiSolidPencil size={26} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
  );
};
