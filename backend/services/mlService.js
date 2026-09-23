// Simple ML/Statistical Spending Prediction Service

const predictFinalSpending = (trip, expenses) => {
  if (!trip || !expenses || expenses.length === 0) {
    return {
      averageDailySpending: 0,
      projectedFinalSpending: 0,
      riskLevel: "Low",
      message: "Not enough data to predict."
    };
  }

  const startDate = new Date(trip.start_date);
  const endDate = new Date(trip.end_date);
  const totalTripDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);

  // Group expenses by date to find active spending days
  const expensesByDate = {};
  let totalSpent = 0;

  expenses.forEach(exp => {
    const d = new Date(exp.expense_date).toISOString().split('T')[0];
    if (!expensesByDate[d]) expensesByDate[d] = 0;
    expensesByDate[d] += Number(exp.amount);
    totalSpent += Number(exp.amount);
  });

  const activeDays = Object.keys(expensesByDate).length;
  
  // Basic prediction: total spent so far / active days * total trip days
  // If activeDays is 0, we can't predict
  const averageDailySpending = activeDays > 0 ? totalSpent / activeDays : 0;
  let projectedFinalSpending = totalSpent;

  if (activeDays > 0 && totalTripDays > activeDays) {
    const remainingDays = totalTripDays - activeDays;
    projectedFinalSpending = totalSpent + (averageDailySpending * remainingDays);
  }

  let riskLevel = "Low";
  const budget = Number(trip.budget);

  if (projectedFinalSpending > budget) {
    riskLevel = "High";
  } else if (projectedFinalSpending > budget * 0.8) {
    riskLevel = "Medium";
  }

  return {
    totalSpent,
    totalTripDays,
    activeDays,
    averageDailySpending,
    projectedFinalSpending,
    riskLevel,
    message: riskLevel === "High" ? "You are projected to exceed your budget." : "You are on track."
  };
};

const detectAnomalies = (expenses) => {
  if (!expenses || expenses.length < 3) return [];

  const amounts = expenses.map(e => Number(e.amount));
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  const anomalies = [];
  expenses.forEach(exp => {
    const amt = Number(exp.amount);
    // Flag if amount is > mean + 2*stdDev (Standard Z-score > 2)
    if (amt > mean + (2 * stdDev)) {
      anomalies.push({
        id: exp.id,
        amount: amt,
        category: exp.category,
        reason: "Unusually high compared to average spending."
      });
    }
  });

  return anomalies;
};

module.exports = {
  predictFinalSpending,
  detectAnomalies
};
