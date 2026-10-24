import type { Metadata } from "next";
import { StorefrontApp } from "@/components/store/StorefrontApp";

export const metadata: Metadata = {
  title: "Demo store — Nike (unaffiliated simulation) · Normal",
  description: "Simulated Nike storefront. Real public product names and list prices; synthetic inventory, orders and customers. No real purchases.",
};

export default function DemoStorePage() {
  return <StorefrontApp />;
}
