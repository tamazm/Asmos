export interface EmailCaptureInputs {
  monthlyVisitors: number;
  currentCVR: number; // percent
  benchmarkCVR: number; // percent
  subscriberToCustomerCVR: number; // percent
  aov: number;
}

export interface EmailCaptureResult {
  additionalSubscribers: number;
  additionalCustomers: number;
  additionalMonthlyRevenue: number;
  additionalAnnualRevenue: number;
  isAboveBenchmark: boolean;
}

export function computeEmailCaptureOpportunity(inputs: EmailCaptureInputs): EmailCaptureResult {
  const { monthlyVisitors, currentCVR, benchmarkCVR, subscriberToCustomerCVR, aov } = inputs;
  const isAboveBenchmark = currentCVR >= benchmarkCVR;
  const rateDelta = Math.max(benchmarkCVR - currentCVR, 0) / 100;
  const additionalSubscribers = Math.round(monthlyVisitors * rateDelta);
  const additionalCustomers = Math.round(additionalSubscribers * (subscriberToCustomerCVR / 100));
  const additionalMonthlyRevenue = Math.round(additionalCustomers * aov);
  const additionalAnnualRevenue = additionalMonthlyRevenue * 12;
  return { additionalSubscribers, additionalCustomers, additionalMonthlyRevenue, additionalAnnualRevenue, isAboveBenchmark };
}

export function formatCurrency(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
