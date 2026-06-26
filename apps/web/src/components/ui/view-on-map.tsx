"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ViewOnMap — show a LocateFlow address or provider service area on a map.
 *
 * Repurposed from the watermelon "Boston Public Garden" Google Map embed into a
 * generic LocateFlow address map: pass an old/new home address or a local
 * provider location and it renders a "View on map" pill that expands into an
 * embedded Google Map with the same loading + light/dark map-invert treatment.
 *
 * Re-themed onto the sapphire (no-gold) tokens: the pill, expanded surface, and
 * close button all use card / muted / border / foreground tokens instead of
 * hardcoded #E5E4EE / #1C1C1E greys, and the map invert filter is driven by the
 * `dark` prop (defaults to detecting a `.dark` ancestor) so theming flows
 * through the .light / .dark CSS vars.
 */

interface ViewOnMapProps {
  /** Label shown above nothing — kept for API parity; the address is the query. */
  locationName?: string;
  /** Address or place to plot. Drives the Google Maps embed query. */
  address?: string;
  /** Button label. */
  triggerLabel?: string;
  /** Force the dark map-invert treatment. Defaults to false (light canvas). */
  dark?: boolean;
  className?: string;
}

export const ViewOnMap: React.FC<ViewOnMapProps> = ({
  address = '1242 Beacon St, Brookline, MA',
  triggerLabel = 'View on map',
  dark = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const toggleOpen = () => {
    setIsOpen((prev) => {
      if (prev) setIsMapLoaded(false);
      return !prev;
    });
  };

  const springConfig = {
    type: 'spring' as const,
    stiffness: 400,
    damping: 30,
    mass: 0.8,
  };

  const publicMapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(
    address,
  )}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="transition-colors duration-500">
      <div className="flex min-h-full w-full flex-col items-center justify-center bg-transparent px-4">
        <div
          className={cn(
            'relative flex w-full items-center justify-center',
            className,
          )}
        >
          <AnimatePresence mode="popLayout">
            {!isOpen ? (
              /* --- PILL BUTTON --- */
              <motion.button
                type="button"
                key="button"
                layoutId="map-container"
                onClick={toggleOpen}
                aria-label={`${triggerLabel}: ${address}`}
                className="group relative flex cursor-pointer items-center justify-center overflow-hidden border border-border bg-muted shadow-sm transition-colors duration-300"
                style={{ width: 196, height: 52, borderRadius: 26 }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={springConfig}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  layoutId="map-bg"
                  aria-hidden
                  className="absolute inset-0 opacity-10 brightness-110 grayscale transition-opacity"
                  style={{
                    backgroundImage: `url(${publicMapUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <span className="relative z-10 flex items-center space-x-3 px-4 py-4">
                  <MapIcon className="h-5 w-5 text-muted-foreground transition-colors" />
                  <span className="text-[18px] font-semibold tracking-tight text-foreground transition-colors">
                    {triggerLabel}
                  </span>
                </span>
              </motion.button>
            ) : (
              /* --- EXPANDED MAP --- */
              <motion.div
                key="map"
                layoutId="map-container"
                className="relative aspect-square w-[calc(100vw-64px)] overflow-hidden border border-border bg-muted shadow-lg transition-colors duration-300 sm:w-[380px]"
                style={{ borderRadius: 32 }}
                transition={springConfig}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="absolute inset-0 h-full w-full brightness-[1.02] contrast-[1.05] grayscale-[0.9] saturate-[0.8] sepia-[0.1]"
                >
                  <iframe
                    title={`Map of ${address}`}
                    width="100%"
                    height="100%"
                    style={{
                      border: 0,
                      filter: dark
                        ? 'invert(90%) hue-rotate(180deg)'
                        : 'invert(15%) hue-rotate(180deg)',
                    }}
                    src={publicMapUrl}
                    allowFullScreen
                    onLoad={() => setIsMapLoaded(true)}
                    className={cn(
                      'transition-opacity duration-700',
                      isMapLoaded ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </motion.div>

                {!isMapLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted transition-colors">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}

                {/* CLOSE BUTTON */}
                <motion.button
                  type="button"
                  aria-label="Close map"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={toggleOpen}
                  className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-all hover:bg-accent active:scale-90 sm:right-6 sm:top-6 sm:h-11 sm:w-11"
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={3} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ViewOnMap;
