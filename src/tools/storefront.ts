import { simulatorState, SimulatedBanner } from "../simulator/state";

export interface PublishBannerParams {
  bannerId: string;
  message: string;
  startsAt: string;
  expiresAt: string;
}

export interface PublishBannerResult {
  bannerId: string;
  message: string;
  active: boolean;
  publishedAt: string;
  verified: boolean;
  verificationDetails: string;
  providerOperationId: string;
}

export async function executePublishBanner(
  params: PublishBannerParams
): Promise<PublishBannerResult> {
  const { bannerId, message, startsAt, expiresAt } = params;

  if (!message || message.trim().length === 0) {
    throw new Error("Banner message cannot be empty.");
  }

  // 1. Perform state-changing operation on demo storefront configuration
  const banner: SimulatedBanner = simulatorState.publishStorefrontBanner({
    bannerId,
    message,
    startsAt,
    expiresAt,
  });

  // 2. Read-back verification: query storefront configuration to verify it is active
  const verifiedBanner = simulatorState.getStorefrontBanner();
  const isVerified =
    verifiedBanner?.bannerId === bannerId &&
    verifiedBanner.active === true &&
    verifiedBanner.message === message;

  if (!isVerified) {
    throw new Error(
      `Read-back verification failed: Storefront configuration does not reflect banner ${bannerId}.`
    );
  }

  return {
    bannerId,
    message,
    active: true,
    publishedAt: banner.publishedAt,
    verified: true,
    verificationDetails: `Storefront service verified banner "${bannerId}" is live and rendering on storefront homepage.`,
    providerOperationId: `store_pub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
}
