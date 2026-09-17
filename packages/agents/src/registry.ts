/**
 * The agent registry is a pure domain definition and lives in @saveus/common so
 * that the database seed can create the agent rows without depending on the
 * agent runtime. This module re-exports it for callers inside the runtime.
 */
export {
  AGENTS,
  AGENT_LIST,
  AGENT_TOOLS,
  agentMayUse,
  assertTool,
  getAgent,
  type AgentDefinition,
  type AgentPermissions,
  type AgentTool,
} from '@saveus/common';
