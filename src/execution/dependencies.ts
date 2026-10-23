import { ActionProposalT } from "../contracts";

export interface ExecutionWave {
  waveIndex: number;
  actions: ActionProposalT[];
}

export function resolveDependencyWaves(
  actions: ActionProposalT[],
  approvedActionIds: Set<string>
): { waves: ExecutionWave[]; unexecutable: ActionProposalT[] } {
  // Only consider actions that are approved
  const targetActions = actions.filter((a) => approvedActionIds.has(a.actionId));

  const completed = new Set<string>();
  const remaining = new Map<string, ActionProposalT>();
  for (const action of targetActions) {
    remaining.set(action.actionId, action);
  }

  const waves: ExecutionWave[] = [];
  let waveIndex = 0;

  while (remaining.size > 0) {
    const currentWaveActions: ActionProposalT[] = [];

    for (const [actionId, action] of remaining.entries()) {
      // Check if all dependencies are satisfied
      const allDepsMet = action.dependsOnActionIds.every((depId) => completed.has(depId));
      if (allDepsMet) {
        currentWaveActions.push(action);
      }
    }

    if (currentWaveActions.length === 0) {
      // Circular dependency or depends on an action that was not approved
      break;
    }

    for (const action of currentWaveActions) {
      remaining.delete(action.actionId);
      completed.add(action.actionId);
    }

    waves.push({
      waveIndex,
      actions: currentWaveActions,
    });
    waveIndex++;
  }

  const unexecutable = Array.from(remaining.values());

  return { waves, unexecutable };
}
