
import { RiskData } from "../components/home/types";

export const initialRiskData: RiskData[] = [
  { id: "1", district: "Bandung", rainfall: 120, riskLevel: "high", events: 5 },
  { id: "2", district: "Bekasi", rainfall: 45, riskLevel: "low", events: 1 },
  { id: "3", district: "Bogor", rainfall: 85, riskLevel: "medium", events: 3 },
  { id: "4", district: "Depok", rainfall: 60, riskLevel: "medium", events: 2 },
  { id: "5", district: "Cimahi", rainfall: 30, riskLevel: "low", events: 0 },
];

export const rainfallHistory = [
  { date: "2023-12-01", amount: 12, risk: 0 },
  { date: "2023-12-02", amount: 45, risk: 0 },
  { date: "2023-12-03", amount: 80, risk: 1 },
  { date: "2023-12-04", amount: 150, risk: 5 }, // High Risk Event
  { date: "2023-12-05", amount: 90, risk: 2 },
  { date: "2023-12-06", amount: 20, risk: 0 },
  { date: "2023-12-07", amount: 5, risk: 0 },
];

export const rainfallPrediction = [
  { date: "2023-12-08", amount: 10, risk: 0 },
  { date: "2023-12-09", amount: 15, risk: 0 },
  { date: "2023-12-10", amount: 110, risk: 4 }, // Predicted High Risk
  { date: "2023-12-11", amount: 40, risk: 1 },
  { date: "2023-12-12", amount: 5, risk: 0 },
  { date: "2023-12-13", amount: 0, risk: 0 },
  { date: "2023-12-14", amount: 2, risk: 0 },
];

export const rainfallHourly = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  amount: Math.random() * (i > 12 && i < 18 ? 30 : 5), // Peak in afternoon
  risk: i > 12 && i < 18 ? Math.floor(Math.random() * 2) : 0
}));

export const riskEvents = [
  { id: 1, date: "2023-12-04", time: "14:00", level: "High", type: "Flash Flood", description: "Rainfall exceeded 100mm threshold" },
  { id: 2, date: "2023-12-04", time: "16:30", level: "Medium", type: "Water Level", description: "River level warning" },
  { id: 3, date: "2023-12-05", time: "09:00", level: "Medium", type: "Landslide Risk", description: "Soil saturation high" },
];
