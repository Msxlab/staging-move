"use client";

import { useEffect, useState, type FC, type ReactNode } from "react";
import { motion } from "framer-motion";
import { IoMoon, IoMoonOutline, IoSunny, IoSunnyOutline } from "react-icons/io5";
import { useTheme } from "next-themes";

/* ---------------------------------------------------------------------------
 * SwitchMode — LocateFlow light/dark theme toggle.
 *
 * Re-themed off the watermelon registry original (which hardcoded #0B0B0B /
 * #FFFFFF / #2A2A2E etc.). All track / knob / border colors now resolve
 * through our CSS-var theme (hsl(var(--card)) / var(--muted) / var(--border) /
 * var(--primary)), so the control follows .light / .dark automatically and
 * carries ZERO gold/amber. Icon glyphs use currentColor driven by our
 * text-muted-foreground / text-primary classes instead of hardcoded greys.
 * ------------------------------------------------------------------------- */

interface SwitchModeProps {
    width?: number;
    height?: number;
}

export const SwitchMode: FC<SwitchModeProps> = ({
    width = 144,
    height = 72,
}) => {
    const [mounted, setMounted] = useState(false);
    const { resolvedTheme, setTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div style={{ width, height }} className="rounded-full border-2 border-transparent" />;
    }

    const isDark = resolvedTheme === "dark";
    const iconSize = height * 0.45;

    return (
        <motion.button
            type="button"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="relative flex items-center rounded-full border-2 border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{ width, height }}
        >
            {/* TRACK — dark uses our deep card surface, light uses the card/background */}
            <motion.div
                className="absolute inset-0 rounded-full"
                animate={{ backgroundColor: isDark ? "hsl(var(--card))" : "hsl(var(--background))" }}
                transition={{ duration: 0.4 }}
            />

            {/* SLIDING KNOB — muted surface in both modes, border via theme */}
            <motion.div
                layout
                layoutId="switch-knob"
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="absolute z-30 rounded-full border-2 border-border bg-muted"
                style={{
                    width: height,
                    height,
                    right: isDark ? -2 : undefined,
                    left: isDark ? undefined : -2,
                }}
            />

            {/* SUN */}
            <motion.div
                className={`relative z-30 flex items-center justify-center ${isDark ? "text-muted-foreground" : "text-primary"}`}
                style={{ width: height, height }}
                animate={{ rotate: isDark ? 45 : 0 }}
                transition={{ stiffness: 20 }}
            >
                {isDark ? (
                    <IoSunnyOutline
                        style={{ width: iconSize, height: iconSize }}
                        className="transition-colors duration-200"
                    />
                ) : (
                    <IoSunny
                        style={{ width: iconSize, height: iconSize }}
                        className="transition-colors duration-200"
                    />
                )}
            </motion.div>

            {/* MOON */}
            <motion.div
                className={`relative z-30 flex items-center justify-center ${isDark ? "text-primary" : "text-muted-foreground"}`}
                style={{ width: height, height }}
                animate={{ rotate: isDark ? 0 : 15 }}
                transition={{ stiffness: 20, damping: 14 }}
            >
                {isDark ? (
                    <IoMoon
                        style={{ width: iconSize, height: iconSize }}
                        className="transition-colors duration-200"
                    />
                ) : (
                    <IoMoonOutline
                        style={{ width: iconSize, height: iconSize }}
                        className="transition-colors duration-200"
                    />
                )}
            </motion.div>
        </motion.button>
    );
};

/* ---------------------------------------------------------------------------
 * SwitchToggle — generic two-state pill reusing the same animated knob.
 *
 * Repurposed from the same mechanism for the dashboard "My view / Family view"
 * switch. Controlled component: `value` is the active option, `onChange` fires
 * with the chosen option. Fully themed (active = bg-primary, inactive = muted).
 * ------------------------------------------------------------------------- */

interface SwitchToggleOption {
    value: string;
    label: string;
    icon?: ReactNode;
}

interface SwitchToggleProps {
    options: [SwitchToggleOption, SwitchToggleOption];
    value: string;
    onChange: (value: string) => void;
    /** Accessible group label, e.g. "Dashboard view". */
    ariaLabel?: string;
}

export const SwitchToggle: FC<SwitchToggleProps> = ({
    options,
    value,
    onChange,
    ariaLabel = "Toggle",
}) => {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className="relative inline-flex items-center gap-1 rounded-full border border-border bg-muted p-1"
        >
            {options.map((opt) => {
                const isActive = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onChange(opt.value)}
                        className="relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {isActive && (
                            <motion.span
                                layoutId="switch-toggle-knob"
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                className="absolute inset-0 rounded-full bg-primary shadow-sm"
                            />
                        )}
                        <span
                            className={`relative z-10 flex items-center gap-1.5 transition-colors ${
                                isActive ? "text-primary-foreground" : "text-muted-foreground"
                            }`}
                        >
                            {opt.icon}
                            {opt.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
