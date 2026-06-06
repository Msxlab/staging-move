import { prisma } from "@/lib/db";

type ProviderLike = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  category?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  scope?: string | null;
};

type ServiceLike = {
  providerName?: string | null;
  category?: string | null;
  website?: string | null;
  phone?: string | null;
  provider?: ProviderLike | null;
  providerLogoUrl?: string | null;
  logoUrl?: string | null;
};

function normalizeName(value: unknown): string {
  return typeof value === "string"
    ? value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "")
    : "";
}

function slugify(value: unknown): string {
  return typeof value === "string"
    ? value.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    : "";
}

function hasProviderLogo(service: ServiceLike): boolean {
  return Boolean(
    service.provider?.logoUrl?.trim() ||
      service.providerLogoUrl?.trim() ||
      service.logoUrl?.trim(),
  );
}

function providerScore(service: ServiceLike, provider: ProviderLike): number {
  let score = 0;
  if (normalizeName(provider.name) === normalizeName(service.providerName)) score += 4;
  if (provider.slug && provider.slug === slugify(service.providerName)) score += 3;
  if (provider.category && service.category && provider.category === service.category) score += 2;
  if (provider.logoUrl) score += 1;
  return score;
}

function chooseProvider(service: ServiceLike, providers: ProviderLike[]): ProviderLike | null {
  const serviceName = normalizeName(service.providerName);
  const serviceSlug = slugify(service.providerName);
  if (!serviceName && !serviceSlug) return null;

  return (
    providers
      .filter((provider) => normalizeName(provider.name) === serviceName || provider.slug === serviceSlug)
      .sort((a, b) => providerScore(service, b) - providerScore(service, a))[0] || null
  );
}

export async function enrichServicesWithProviderCatalog<T extends ServiceLike>(services: T[]): Promise<T[]> {
  const missingLogoServices = services.filter((service) => !hasProviderLogo(service) && service.providerName?.trim());
  if (missingLogoServices.length === 0) return services;

  const names = [...new Set(missingLogoServices.map((service) => service.providerName?.trim()).filter(Boolean) as string[])];
  const slugs = [...new Set(names.map(slugify).filter(Boolean))];
  if (names.length === 0 && slugs.length === 0) return services;

  const providers = await prisma.serviceProvider.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      OR: [
        ...(names.length > 0 ? [{ name: { in: names } }] : []),
        ...(slugs.length > 0 ? [{ slug: { in: slugs } }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      website: true,
      phone: true,
      logoUrl: true,
      scope: true,
    },
  });

  if (providers.length === 0) return services;

  return services.map((service) => {
    if (hasProviderLogo(service)) return service;
    const provider = chooseProvider(service, providers);
    if (!provider?.logoUrl && !provider?.website) return service;

    const existingProvider = service.provider || null;
    return {
      ...service,
      provider: existingProvider
        ? {
            ...existingProvider,
            website: existingProvider.website || provider.website || null,
            logoUrl: existingProvider.logoUrl || provider.logoUrl || null,
          }
        : provider,
      providerLogoUrl: service.providerLogoUrl || provider.logoUrl || null,
      logoUrl: service.logoUrl || provider.logoUrl || null,
      website: service.website || provider.website || null,
      phone: service.phone || provider.phone || null,
    };
  });
}
