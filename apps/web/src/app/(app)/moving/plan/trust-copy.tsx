import {
  PROVIDER_ACCOUNT_UNCHANGED_COPY,
  type MoveTaskLocalEffect,
  type UxTrustCopyVariant,
} from "@locateflow/shared";

const TRUST_CONFIRMATION_ACTION_TYPES = new Set([
  "STOP",
  "STOP_SERVICE",
  "START",
  "START_SERVICE",
  "TRANSFER",
  "TRANSFER_SERVICE",
  "CANCEL",
  "CANCEL_OR_CLOSE",
  "UPDATE",
  "UPDATE_ADDRESS",
]);

export const MOVE_TASK_TRUST_BADGE_LABEL = "Move only";
export const MOVE_TASK_TRUST_BADGE_LABEL_V1 = "Move only — your provider account is unchanged";

export interface MoveTaskTrustInput {
  actionType?: string | null;
  localEffect?: MoveTaskLocalEffect | null;
  isDone?: boolean;
  isDismissed?: boolean;
  variant?: UxTrustCopyVariant;
}

export function isPointOfActionTrustType(actionType?: string | null): boolean {
  return typeof actionType === "string" && TRUST_CONFIRMATION_ACTION_TYPES.has(actionType);
}

export function isVerifiedIntegrationTask(localEffect?: MoveTaskLocalEffect | null): boolean {
  return localEffect?.localOnly === false || localEffect?.noExternalAutomation === false;
}

export function shouldShowMoveTaskTrustConfirmation(input: MoveTaskTrustInput): boolean {
  const currentBehavior = Boolean(input.localEffect?.localOnly && !input.isDone && !input.isDismissed);
  if (input.variant !== "variant") return currentBehavior;
  if (isVerifiedIntegrationTask(input.localEffect)) return false;
  if (isPointOfActionTrustType(input.actionType)) return true;
  return currentBehavior;
}

export function shouldShowMoveTaskTrustLegalLine(input: MoveTaskTrustInput): boolean {
  return (
    input.variant === "variant" &&
    isPointOfActionTrustType(input.actionType) &&
    !isVerifiedIntegrationTask(input.localEffect)
  );
}

export function moveTaskTrustBadgeLabel(input: MoveTaskTrustInput): string {
  return shouldShowMoveTaskTrustLegalLine(input) ? MOVE_TASK_TRUST_BADGE_LABEL_V1 : MOVE_TASK_TRUST_BADGE_LABEL;
}

export function MoveTaskTrustConfirmation(input: MoveTaskTrustInput) {
  if (!shouldShowMoveTaskTrustConfirmation(input)) return null;
  const showLegalLine = shouldShowMoveTaskTrustLegalLine(input);
  return (
    <div>
      <span>{moveTaskTrustBadgeLabel(input)}</span>
      {showLegalLine && (
        <p>{PROVIDER_ACCOUNT_UNCHANGED_COPY}</p>
      )}
    </div>
  );
}
