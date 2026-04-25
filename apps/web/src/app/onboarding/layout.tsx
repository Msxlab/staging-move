import type { ReactNode } from "react";
import { Wordmark } from "@/components/marketing/logo";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
        <div className="text-center mb-6">
          <div className="flex justify-center">
            <Wordmark href="/" animated={false} />
          </div>
          <p className="text-muted-foreground text-sm mt-2">Let&apos;s set up your account</p>
        </div>
        {children}
      </div>
    </div>
  );
}
