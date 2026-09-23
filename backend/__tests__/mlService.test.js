const { predictFinalSpending, detectAnomalies } = require("../services/mlService");

describe("ML Service", () => {
  test("predictFinalSpending calculates correctly for on track budget", () => {
    const trip = { start_date: "2026-05-01", end_date: "2026-05-10", budget: 1000 };
    const expenses = [
      { amount: 50, expense_date: "2026-05-01" },
      { amount: 50, expense_date: "2026-05-02" }
    ];
    const result = predictFinalSpending(trip, expenses);
    expect(result.totalSpent).toBe(100);
    expect(result.averageDailySpending).toBe(50);
    expect(result.projectedFinalSpending).toBe(500); // 10 days * 50
    expect(result.riskLevel).toBe("Low");
  });

  test("detectAnomalies identifies unusual spending", () => {
    const expenses = [
      { id: 1, amount: 10, category: "Food" },
      { id: 2, amount: 12, category: "Food" },
      { id: 3, amount: 11, category: "Food" },
      { id: 4, amount: 10, category: "Food" },
      { id: 5, amount: 9, category: "Food" },
      { id: 6, amount: 11, category: "Food" },
      { id: 7, amount: 12, category: "Food" },
      { id: 8, amount: 10, category: "Food" },
      { id: 9, amount: 500, category: "Hotel" }, // anomaly
    ];
    const anomalies = detectAnomalies(expenses);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].amount).toBe(500);
  });
});
