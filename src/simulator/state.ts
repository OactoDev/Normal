import { z } from "zod";
import { Campaign, Order, Banner, Email, campaigns, orders, storefront, emails, events, products } from "../store/repos";
export type SimulatedCampaign = z.infer<typeof Campaign>;
export type SimulatedOrder = z.infer<typeof Order>;
export type SimulatedBanner = z.infer<typeof Banner>;
export type DispatchedEmail = z.infer<typeof Email> & { messageId?: string; mubitRequestId?: string };
export async function seedSimulator() {
  await campaigns.claim("campaign_A", { campaignId: "campaign_A", businessId: "nova_store", name: "Nike Running · Campaign A", dailyBudgetMinor: 5000, currency: "GBP", status: "active", updatedAt: new Date().toISOString() });
  for (const product of [
    { productId: "nike_running", name: "Nike Running Shoes", priceMinor: 12000, stock: 12, dailyDemand: 8 },
    { productId: "nike_training", name: "Nike Training Top", priceMinor: 4500, stock: 80, dailyDemand: 10 },
    { productId: "nike_hoodie", name: "Nike Sportswear Hoodie", priceMinor: 7500, stock: 24, dailyDemand: 6 },
  ]) await products.claim(product.productId, { ...product, simulated: true });
  for (const [id, name] of [["ord_001", "Emma Watson"], ["ord_002", "Liam Davies"]]) await orders.claim(id, { orderId: id, businessId: "nova_store", customerName: name, customerEmail: `${id}@example.com`, items: ["Nike Running Shoes"], promisedDeliveryDate: new Date(Date.now()-86400000).toISOString(), carrier: "Royal Mail", trackingNumber: `GB-${id}`, status: "delayed" });
}
export const simulatorState = {
  async getCampaign(id: string) { await seedSimulator(); return campaigns.findOne(id); },
  async getOrder(id: string) { await seedSimulator(); return orders.findOne(id); },
  async listDelayedOrders() { await seedSimulator(); return orders.find({ status: "delayed" }); },
  async getStorefrontBanner() { return (await storefront.find())[0] ?? null; },
  async getDispatchedEmails() { return emails.find(); },
  async getEvents() { return events.find(); },
  async getSnapshot() { await seedSimulator(); return { campaigns: await campaigns.find(), orders: await orders.find(), activeBanner: await this.getStorefrontBanner(), dispatchedEmails: await emails.find(), eventCount: (await events.find()).length }; },
};
