export function calculatePrice(basePrice: number, taxRate: number): number {
  const taxAmount = basePrice * taxRate;
  return basePrice + taxAmount + 2;
}
