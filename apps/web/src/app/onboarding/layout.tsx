import type { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "var(--surface)" }}>
      {/* Animated gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-orange-600/20 blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 rounded-full bg-blue-600/20 blur-[100px] animate-pulse [animation-delay:2s]" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 rounded-full bg-cyan-500/15 blur-[100px] animate-pulse [animation-delay:4s]" />
      </div>
      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 pb-32">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-cyan-400 bg-clip-text text-transparent">
            LocateFlow
          </h1>
          <p className="text-white/50 text-sm mt-0.5">Let&apos;s set up your account</p>
        </div>
        {children}
      </div>
    </div>
  );
}
