export const NON_TRACKED_SERVICE_ACTIONS = [
  "CANCEL",
  "CANCELED",
  "CANCELLED",
  "REMOVE",
  "REMOVED",
  "ARCHIVE",
  "ARCHIVED",
] as const;

export const ACTIVE_TRACKED_SERVICE_WHERE = {
  deletedAt: null,
  isActive: true,
  deactivatedAt: null,
  OR: [
    { migrationAction: null },
    { migrationAction: { notIn: [...NON_TRACKED_SERVICE_ACTIONS] } },
  ],
};

export function activeTrackedServiceWhere(
  userId: string,
  extra: Record<string, unknown> = {},
) {
  return {
    userId,
    ...ACTIVE_TRACKED_SERVICE_WHERE,
    ...extra,
  };
}
