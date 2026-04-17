import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <FileQuestion className="h-16 w-16 text-muted-foreground/40 mb-4" />
      <h2 className="text-xl font-semibold mb-2">Page Not Found</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/dashboard">
        <Button>Go to Dashboard</Button>
      </Link>
    </div>
  );
}
