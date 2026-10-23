import { simulatorState } from "../simulator/state";

export interface SetDailyBudgetParams {
  campaignId: string;
  newDailyBudgetMinor: number;
  currency: string;
}

export interface SetDailyBudgetResult {
  campaignId: string;
  previousBudgetMinor: number;
  newBudgetMinor: number;
  currency: string;
  verified: boolean;
  verificationDetails: string;
  providerOperationId: string;
}

export async function executeSetDailyBudget(
  params: SetDailyBudgetParams
): Promise<SetDailyBudgetResult> {
  const { campaignId, newDailyBudgetMinor, currency } = params;

  if (newDailyBudgetMinor <= 0) {
    throw new Error(`Invalid budget: ${newDailyBudgetMinor}. Must be positive.`);
  }

  const existing = simulatorState.getCampaign(campaignId);
  if (!existing) {
    throw new Error(`Campaign ${campaignId} not found in connected ad platforms.`);
  }

  const previousBudget = existing.dailyBudgetMinor;

  // 1. Perform state-changing operation on simulated Meta Ads platform
  const updated = simulatorState.updateCampaignBudget(campaignId, newDailyBudgetMinor);

  // 2. Read-back verification: query service again to confirm new value is stored
  const verifiedCampaign = simulatorState.getCampaign(campaignId);
  const isVerified = verifiedCampaign?.dailyBudgetMinor === newDailyBudgetMinor;

  if (!isVerified) {
    throw new Error(
      `Read-back verification failed: Expected budget ${newDailyBudgetMinor}, but got ${verifiedCampaign?.dailyBudgetMinor}`
    );
  }

  return {
    campaignId,
    previousBudgetMinor: previousBudget,
    newBudgetMinor: newDailyBudgetMinor,
    currency,
    verified: true,
    verificationDetails: `Meta Ads API confirmed Campaign ${campaignId} budget updated from £${(previousBudget / 100).toFixed(2)} to £${(newDailyBudgetMinor / 100).toFixed(2)}`,
    providerOperationId: `meta_act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
}
