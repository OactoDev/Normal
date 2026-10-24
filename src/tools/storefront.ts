import { BannerParams } from "../execution/action-params";
import { storefront } from "../store/repos";
import { ToolError } from "../execution/retry-policy";
export async function executePublishBanner(raw: unknown) {
  const p = BannerParams.parse(raw);
  if (Date.parse(p.expiresAt) <= Date.now() || Date.parse(p.expiresAt) <= Date.parse(p.startsAt) || Date.parse(p.expiresAt)-Date.parse(p.startsAt) > 14*86400000) throw new ToolError("BANNER_WINDOW", "Invalid banner window");
  const before = await storefront.findOne(p.bannerId);
  const after = await storefront.update(p.bannerId, { $set: { ...p, businessId: "nova_store", active: true, publishedAt: new Date().toISOString() } });
  return { before: before ?? null, after };
}
