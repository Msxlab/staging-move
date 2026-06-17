import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { RaccoonLost } from "@/components/illustrations/RaccoonLost";

export default function RootNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="flex min-h-[60vh] flex-col items-center justify-center p-12 text-center">
        <RaccoonLost size={140} className="mb-6 text-muted-foreground/70" />
        <h2 className="text-2xl font-semibold mb-2">404 - Page Not Found</h2>
        <p className="text-muted-foreground mb-6 max-w-sm">
          This little raccoon went looking for the page too — and came back
          empty-pawed. It does not exist.
        </p>
        <Button asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </main>
      <MarketingFooter />
    </div>
  );
}
