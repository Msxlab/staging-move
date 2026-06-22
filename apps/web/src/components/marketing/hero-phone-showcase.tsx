"use client";

import { MobileMockup } from "@/components/marketing/mobile-mockup";

export function HeroPhoneShowcase({ className }: { className?: string }) {
  return <MobileMockup variant="hero" className={className} />;
}

export default HeroPhoneShowcase;
