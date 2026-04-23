import { redirect } from "next/navigation";

export default async function TicketAliasDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/support/${id}`);
}
