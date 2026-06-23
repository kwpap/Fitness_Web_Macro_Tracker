export const parseLog = (text) => {
  const data = {
    dayId: "",
    calories: 0,
    protein: 0,
    fat: 0,
    netCarbs: 0,
    fiber: 0,
    foodsTracked: ""
  };

  // 1. Extract Day ID (e.g., "Day 78" or "Day 58")
  const dayMatch = text.match(/Day\s+(\d+)/i);
  if (dayMatch) {
    data.dayId = dayMatch[0];
  }

  // 2. Parse Calories / kcal
  const calMatch = text.match(/(\d+)\s*(?:Calories|kcal)/i);
  if (calMatch) {
    data.calories = parseInt(calMatch[1], 10);
  }

  // 3. Parse Macros (Protein, Fat, Net Carbs, Fiber)
  const proteinMatch = text.match(/Protein:\s*([\d.]+)/i);
  if (proteinMatch) data.protein = parseFloat(proteinMatch[1]);

  const fatMatch = text.match(/Fat:\s*([\d.]+)/i);
  if (fatMatch) data.fat = parseFloat(fatMatch[1]);

  const netCarbsMatch = text.match(/Net Carbs:\s*([\d.]+)/i);
  if (netCarbsMatch) data.netCarbs = parseFloat(netCarbsMatch[1]);

  const fiberMatch = text.match(/Fiber:\s*([\d.]+)/i);
  if (fiberMatch) data.fiber = parseFloat(fiberMatch[1]);

  // 4. Capture Foods Tracked
  // Capture all text following the phrase 'Foods Tracked:' up to the end of the entry or the next structural label (like 'Notes:')
  const foodsMatch = text.match(/Foods Tracked:([\s\S]*?)(?:Notes:|$)/i);
  if (foodsMatch) {
    data.foodsTracked = foodsMatch[1]
      .replace(/\*\*|\*/g, "") // Strip markdown wrappers
      .replace(/max|Target:/gi, "") // Strip labels
      .replace(/\\/g, "") // Strip text citations/links matching pattern \
      .trim();
  }

  return data;
};
