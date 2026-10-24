import { expect, test } from "@playwright/test";
import { E2E_RUN, products, resetE2ERun, tick } from "./helpers";

test.describe.serial("demo storefront", () => {
  test.beforeAll(async ({ request }) => {
    await resetE2ERun(request);
    await tick(request, 6);
  });

  test("lists the verified catalogue with provenance and an unaffiliated notice", async ({ page }) => {
    await page.goto("/demo-store");
    await expect(page.getByText("Nike — Unaffiliated Simulation.").first()).toBeVisible();
    await expect(page.locator("[data-testid^=product-]")).toHaveCount(17);
    await page.getByRole("button", { name: "Football", exact: true }).click();
    await expect(page.locator("[data-testid^=product-]")).toHaveCount(3);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByLabel("Search products").fill("pegasus");
    await expect(page.locator("[data-testid^=product-]")).toHaveCount(2);
    await page.getByLabel("Search products").fill("");
    await page.getByTestId("product-nk_air_force_1_07").click();
    const drawer = page.getByTestId("product-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("£109.99").first()).toBeVisible();
    await expect(drawer.getByRole("link", { name: "nike.com/gb" })).toHaveAttribute("href", /nike\.com\/gb/);
    await expect(drawer.getByText(/not Nike data/)).toBeVisible();
  });

  test("adding to cart and checking out creates a persisted order, reduces inventory and survives refresh", async ({ page, request }) => {
    const before = (await products(request)).find((p) => p.productId === "nk_pegasus_42")!;
    await page.goto("/demo-store");
    await page.getByTestId("product-nk_pegasus_42").click();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByTestId("add-to-cart").click();
    const cart = page.getByTestId("cart-drawer");
    await expect(cart).toBeVisible();
    await expect(cart.getByTestId("cart-line-nk_pegasus_42")).toContainText("Nike Pegasus 42");
    await expect(cart.getByText("£259.98")).toBeVisible();
    await expect(cart.getByText(/No card or personal details/)).toBeVisible();
    await cart.getByTestId("place-order").click();
    const confirmation = page.getByTestId("order-confirmation");
    await expect(confirmation).toBeVisible();
    const orderId = (await confirmation.locator("strong").textContent())!.trim();
    expect(orderId).toMatch(/^ord_e2e_run_h/);

    const after = (await products(request)).find((p) => p.productId === "nk_pegasus_42")!;
    expect(after.availableUnits).toBe(before.availableUnits - 2);

    const ledger = await request.get(`/api/dev/simulator/events?simulationRunId=${E2E_RUN}&type=order.completed&limit=5`);
    const events = ((await ledger.json()) as { events: Array<{ payload: { orderId: string; netRevenueMinor: number } }> }).events;
    const mine = events.find((e) => e.payload.orderId === orderId);
    expect(mine?.payload.netRevenueMinor).toBe(before.priceMinor * 2);

    await page.reload();
    const orders = page.getByTestId("your-orders");
    await expect(orders).toBeVisible();
    await expect(orders.getByText(orderId)).toBeVisible();
    await expect(orders.getByText("2× Nike Pegasus 42")).toBeVisible();
  });

  test("a sold-out product cannot be purchased", async ({ page, request }) => {
    // Drain stock through real checkouts of the smallest-stock product is slow; instead buy the last units of the Phantom via the API first.
    const phantom = (await products(request)).find((p) => p.productId === "nk_phantom_6_low_elite")!;
    for (let i = 0; i < Math.ceil(phantom.availableUnits / 5); i++) {
      const left = phantom.availableUnits - i * 5;
      const res = await request.post("/api/demo-store/checkout", { data: { idempotencyKey: `e2e-drain-${i}-${Date.now()}`, items: [{ productId: "nk_phantom_6_low_elite", quantity: Math.min(5, left) }] } });
      expect([201, 409]).toContain(res.status());
    }
    await page.goto("/demo-store");
    const card = page.getByTestId("product-nk_phantom_6_low_elite");
    await expect(card).toContainText("Sold out");
    await card.click();
    await expect(page.getByTestId("add-to-cart")).toBeDisabled();
  });
});
