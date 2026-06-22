import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMoverPortalSession } from "@/lib/mover-portal-auth";
import { MoverPortalLogin } from "@/components/movers/mover-portal-login";

export const metadata: Metadata = {
  title: "Mover portal · LocateFlow",
  description: "Sign in to manage your LocateFlow moving-company listing.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MoverPortalSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already signed in → straight to the dashboard.
  const session = await getMoverPortalSession();
  if (session) redirect("/movers/portal/dashboard");

  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md px-5 py-16">
      <header className="mb-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Mover portal</p>
        <h1 className="h1 mt-2 text-3xl text-foreground">Manage your listing</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Approved movers can sign in to view listing stats and buy a sponsored placement.
        </p>
      </header>
      <MoverPortalLogin invalidLink={error === "invalid"} />
    </main>
  );
}
