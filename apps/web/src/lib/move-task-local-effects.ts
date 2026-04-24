import { buildMoveTaskLifecyclePatch } from "@locateflow/shared";
import { prisma } from "@/lib/db";

export interface CompleteMoveTaskOptions {
  selectedDestinationProviderId?: string | null;
  selectedCustomProviderId?: string | null;
  notes?: string | null;
}

async function getSelectedProvider(
  userId: string,
  providerId?: string | null,
  customProviderId?: string | null,
) {
  if (providerId) {
    const provider = await prisma.serviceProvider.findFirst({
      where: { id: providerId, deletedAt: null, isActive: true },
    });
    if (!provider) throw new Error("Destination provider not found");
    return {
      providerId: provider.id,
      customProviderId: null,
      providerName: provider.name,
      category: provider.category,
      website: provider.website,
      phone: provider.phone,
      email: null,
    };
  }

  if (customProviderId) {
    const customProvider = await prisma.userCustomProvider.findFirst({
      where: { id: customProviderId, userId, deletedAt: null },
    });
    if (!customProvider) throw new Error("Custom provider not found");
    return {
      providerId: null,
      customProviderId: customProvider.id,
      providerName: customProvider.name,
      category: customProvider.category,
      website: customProvider.website,
      phone: customProvider.phone,
      email: customProvider.email,
    };
  }

  return null;
}

export async function completeMoveTaskWithLocalEffect(
  userId: string,
  taskId: string,
  options: CompleteMoveTaskOptions = {},
) {
  const task = await prisma.moveTask.findFirst({
    where: { id: taskId, userId, deletedAt: null },
    include: {
      service: true,
      destinationProvider: true,
      customProvider: true,
      destinationAddress: true,
    },
  });

  if (!task) throw new Error("Move task not found");

  const now = new Date();
  const selectedProvider = await getSelectedProvider(
    userId,
    options.selectedDestinationProviderId || task.destinationProviderId,
    options.selectedCustomProviderId || task.customProviderId,
  );
  const lifecyclePatch = buildMoveTaskLifecyclePatch(task as any, "COMPLETE", now);
  const localEffect = {
    ...(task.localEffect && typeof task.localEffect === "object" ? (task.localEffect as any) : {}),
    appliedAt: now.toISOString(),
    appliedBy: userId,
    localOnly: true,
    noExternalAutomation: true,
    selectedDestinationProviderId: selectedProvider?.providerId || null,
    selectedCustomProviderId: selectedProvider?.customProviderId || null,
  };

  const result = await prisma.$transaction(async (tx) => {
    let createdServiceId: string | null = null;
    let updatedServiceId: string | null = null;

    if (
      (task.actionType === "STOP_SERVICE" || task.actionType === "CANCEL_OR_CLOSE") &&
      task.serviceId
    ) {
      const service = await tx.service.findFirst({
        where: { id: task.serviceId, userId, deletedAt: null },
      });
      if (service) {
        await tx.service.update({
          where: { id: service.id },
          data: {
            isActive: false,
            deactivatedAt: now,
            migrationAction: task.actionType === "STOP_SERVICE" ? "CANCEL" : "CANCEL",
          },
        });
        updatedServiceId = service.id;
      }
    }

    if (task.actionType === "TRANSFER_SERVICE" && task.service && task.destinationAddressId) {
      const existingDestinationService = await tx.service.findFirst({
        where: {
          userId,
          addressId: task.destinationAddressId,
          providerName: task.service.providerName,
          category: task.service.category,
          deletedAt: null,
        },
      });
      if (!existingDestinationService) {
        const service = await tx.service.create({
          data: {
            userId,
            addressId: task.destinationAddressId,
            providerId: task.service.providerId,
            customProviderId: task.service.customProviderId,
            providerName: task.service.providerName,
            category: task.service.category,
            subCategory: task.service.subCategory,
            website: task.service.website,
            phone: task.service.phone,
            email: task.service.email,
            isActive: true,
            activatedAt: now,
            migrationAction: "TRANSFER",
            previousServiceId: task.service.id,
            notes: "Created locally when the user completed a move transfer task. No external provider update was performed.",
          },
        });
        createdServiceId = service.id;
      } else {
        createdServiceId = existingDestinationService.id;
      }

      await tx.service.update({
        where: { id: task.service.id },
        data: { isActive: false, deactivatedAt: now, migrationAction: "TRANSFER" },
      });
      updatedServiceId = task.service.id;
    }

    if (
      ["START_SERVICE", "SHOP_PROVIDER", "FIND_REPLACEMENT"].includes(task.actionType) &&
      task.destinationAddressId &&
      selectedProvider
    ) {
      const existingDestinationService = await tx.service.findFirst({
        where: {
          userId,
          addressId: task.destinationAddressId,
          providerName: selectedProvider.providerName,
          category: selectedProvider.category,
          deletedAt: null,
        },
      });
      if (!existingDestinationService) {
        const service = await tx.service.create({
          data: {
            userId,
            addressId: task.destinationAddressId,
            providerId: selectedProvider.providerId,
            customProviderId: selectedProvider.customProviderId,
            providerName: selectedProvider.providerName,
            category: selectedProvider.category,
            website: selectedProvider.website,
            phone: selectedProvider.phone,
            email: selectedProvider.email,
            isActive: true,
            activatedAt: now,
            migrationAction: "NEW",
            previousServiceId: task.serviceId || null,
            notes: "Created locally when the user completed a destination provider task. No external provider update was performed.",
          },
        });
        createdServiceId = service.id;
      } else {
        createdServiceId = existingDestinationService.id;
      }
    }

    const completedTask = await tx.moveTask.update({
      where: { id: task.id },
      data: {
        ...lifecyclePatch,
        completedByUserId: userId,
        notes: options.notes ?? task.notes,
        localEffect: {
          ...localEffect,
          createdServiceId,
          updatedServiceId,
          completionMeaning: "Task completion updates LocateFlow only.",
        },
        metadata: {
          ...(task.metadata && typeof task.metadata === "object" ? (task.metadata as any) : {}),
          userConfirmedCompletionAt: now.toISOString(),
        },
      },
    });

    return { task: completedTask, createdServiceId, updatedServiceId };
  });

  return result;
}
