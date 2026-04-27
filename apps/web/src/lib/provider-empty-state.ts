export function getProviderEmptyStateCopy({
  state,
  search,
  hasCategoryFilter,
}: {
  state?: string | null;
  search?: string | null;
  hasCategoryFilter?: boolean;
}) {
  const trimmedSearch = search?.trim();

  if (trimmedSearch) {
    return {
      title: "No listed providers matched your search",
      description: `Nothing matched "${trimmedSearch}". Clear the search or add a local/custom provider as a private service record.`,
    };
  }

  if (hasCategoryFilter && state) {
    return {
      title: "No listed providers found for this category",
      description: `No listed providers were found for this category in ${state}. You can still continue without providers or add a local/custom provider from Services.`,
    };
  }

  if (state) {
    return {
      title: "No listed providers found for this location",
      description: `No listed providers were found for ${state}. This does not mean service is unavailable; add a local/custom provider or continue without providers.`,
    };
  }

  return {
    title: "No listed providers found",
    description: "No listed providers are available for the current filters. You can still create a tracked service with a local/custom provider.",
  };
}
