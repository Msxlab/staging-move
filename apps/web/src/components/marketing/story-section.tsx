"use client";

import { motion, type Variants } from "framer-motion";
import {
  AlertTriangle,
  Clock,
  ListChecks,
  MapPin,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface StorySectionProps {
  ctaHref: string;
  ctaLabelLoggedIn: boolean;
}

interface SceneDef {
  id: "s1" | "s2" | "s3" | "s4" | "s5";
  icon: LucideIcon;
  iconTone: "amber" | "rose" | "orange" | "emerald" | "white";
}

const SCENES: SceneDef[] = [
  { id: "s1", icon: Clock, iconTone: "white" },
  { id: "s2", icon: AlertTriangle, iconTone: "rose" },
  { id: "s3", icon: MapPin, iconTone: "orange" },
  { id: "s4", icon: ListChecks, iconTone: "emerald" },
  { id: "s5", icon: PiggyBank, iconTone: "amber" },
];

const TONE_CLASSES: Record<SceneDef["iconTone"], string> = {
  amber: "text-amber-300 ring-amber-300/30 bg-amber-500/10",
  rose: "text-rose-300 ring-rose-300/30 bg-rose-500/10",
  orange: "text-orange-400 ring-orange-400/30 bg-orange-500/10",
  emerald: "text-emerald-300 ring-emerald-300/30 bg-emerald-500/10",
  white: "text-white/80 ring-white/20 bg-white/5",
};

const sceneVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const lineVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.15 + i * 0.18,
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

export function StorySection({ ctaHref, ctaLabelLoggedIn }: StorySectionProps) {
  const t = useTranslations("story");
  const tErrors = useTranslations("errors");
  const tLanding = useTranslations("landing");

  return (
    <section className="relative overflow-hidden bg-[#050507] text-white">
      {/* Ambient gradient blobs — fixed in section, drift on scroll feels */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/4 h-[40rem] w-[40rem] rounded-full bg-orange-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[36rem] w-[36rem] rounded-full bg-amber-500/[0.08] blur-[120px]" />
      </div>

      <div className="container relative py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            {t("section_eyebrow")}
          </div>
          <h2 className="mt-5 text-3xl md:text-5xl font-bold tracking-tight">
            {t("section_title")}
          </h2>
          <p className="mt-4 text-base md:text-lg text-white/60 leading-relaxed">
            {t("section_subtitle")}
          </p>
        </div>

        <div className="mx-auto max-w-3xl space-y-24 md:space-y-32">
          {SCENES.map((scene, idx) => {
            const Icon = scene.icon;
            const kicker = t(`${scene.id}_kicker`);
            const line1 = t(`${scene.id}_line1`);
            const line2 = t(`${scene.id}_line2`);
            const line3 = scene.id === "s5" ? null : t(`${scene.id}_line3`);

            return (
              <motion.article
                key={scene.id}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.4 }}
                variants={sceneVariants}
                className="relative"
                aria-labelledby={`story-${scene.id}-kicker`}
              >
                <div className="flex items-start gap-5 md:gap-7">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${TONE_CLASSES[scene.iconTone]}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      id={`story-${scene.id}-kicker`}
                      className="text-[11px] md:text-xs font-bold uppercase tracking-[0.22em] text-white/50"
                    >
                      <span className="mr-2 tabular-nums text-white/30">
                        0{idx + 1}
                      </span>
                      {kicker}
                    </p>

                    <div className="mt-3 space-y-1.5 md:space-y-2">
                      <motion.p
                        custom={0}
                        variants={lineVariants}
                        className="whitespace-pre-line text-2xl md:text-4xl font-bold tracking-tight leading-tight"
                      >
                        {line1}
                      </motion.p>
                      <motion.p
                        custom={1}
                        variants={lineVariants}
                        className="whitespace-pre-line text-2xl md:text-4xl font-bold tracking-tight leading-tight text-white/85"
                      >
                        {line2}
                      </motion.p>
                      {line3 ? (
                        <motion.p
                          custom={2}
                          variants={lineVariants}
                          className={`whitespace-pre-line text-2xl md:text-4xl font-bold tracking-tight leading-tight ${
                            scene.id === "s3"
                              ? "bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent"
                              : "text-white/70"
                          }`}
                        >
                          {line3}
                        </motion.p>
                      ) : null}
                    </div>

                    {/* CTA only on the closing scene */}
                    {scene.id === "s5" ? (
                      <motion.div
                        custom={2}
                        variants={lineVariants}
                        className="mt-7"
                      >
                        <Link href={ctaHref}>
                          <Button
                            size="lg"
                            className="bg-white text-black hover:bg-white/90"
                          >
                            {ctaLabelLoggedIn
                              ? tErrors("goToDashboard")
                              : t("s5_cta")}
                          </Button>
                        </Link>
                        <p className="mt-3 text-xs text-white/50">
                          {tLanding("noCreditCard")} ·{" "}
                          {tLanding("cancelAnytime")}
                        </p>
                      </motion.div>
                    ) : null}
                  </div>
                </div>

                {/* Connector line between scenes (hidden on last) */}
                {idx < SCENES.length - 1 ? (
                  <div
                    aria-hidden="true"
                    className="absolute left-[1.4rem] top-14 h-[calc(100%+5rem)] w-px bg-gradient-to-b from-white/15 via-white/5 to-transparent md:left-[1.55rem]"
                  />
                ) : null}
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
