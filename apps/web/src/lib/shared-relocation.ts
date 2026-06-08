export {
  generateChecklist,
  generateTaskTemplates,
  buildChecklistTaskTemplates,
  composeChecklistTaskDescription,
  getPhaseContextForAI,
  type UserChecklistProfile,
  type RelocationChecklist,
  type ChecklistStateRuleContext,
  type ChecklistTaskTemplate,
} from "../../../../packages/shared/src/relocation-checklist";

export { RELOCATION_PHASES, STATE_DMV_DEADLINES } from "../../../../packages/shared/src/constants";

export {
  analyzeMigration,
  generateMigrationTasks,
  getMigrationContextForAI,
  type ServiceWithProvider,
  type ProviderForMigration,
} from "../../../../packages/shared/src/migration-engine";
