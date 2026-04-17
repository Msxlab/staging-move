import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-12 text-center">
      <FileQuestion className="h-16 w-16 text-muted-foreground/40 mb-4" />
      <h2 className="text-2xl font-semibold mb-2">404 - Page Not Found</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        The page you are looking for does not exist.
      </p>
      <Link href="/">
        <Button>Go Home</Button>
      </Link>
    </div>
  );
}
