export const shippingDelayTemplate = {
  subject: "Delivery update from Nova Store",
  paragraph: "Your delivery is taking longer than expected. We are working with the carrier and will share confirmed updates. Thank you for your patience.",
  render(name: string, orderId: string, paragraph: string) { return `Hi ${name},\n\nOrder ${orderId}: ${paragraph}\n\nNova Store Customer Care`; },
};
