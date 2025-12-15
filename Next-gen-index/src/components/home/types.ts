
export type Region = {
  country: string;
  province: string;
  district: string;
};

export type RainfallType = "historical" | "predicted";

export type RiskData = {
  id: string;
  district: string;
  rainfall: number;
  riskLevel: "low" | "medium" | "high";
  events: number;
};

export type InsuranceProduct = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

export type DateRange = {
  from: Date;
  to: Date;
  startHour: number; // 0-23
  endHour: number; // 0-23
};
