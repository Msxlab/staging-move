import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";

export default function RootNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="flex min-h-[60vh] flex-col items-center justify-center p-12 text-center">
        <FileQuestion className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">404 - Page Not Found</h2>
        <p className="text-muted-foreground mb-6 max-w-sm">
          The page you are looking for does not exist.
        </p>
        <Link href="/">
          <Button>Go Home</Button>
        </Link>
      </main>
      <MarketingFooter />
    </div>
  );
}
