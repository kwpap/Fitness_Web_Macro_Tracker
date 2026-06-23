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
  // Handles "2,367", "1925", etc.
  const calMatch = text.match(/(?:Calories|kcal):?\s*\*\*?\s*([\d,]+)/i) || text.match(/([\d,]+)\s*(?:Calories|kcal)/i);
  if (calMatch) {
    data.calories = parseInt(calMatch[1].replace(/,/g, ""), 10);
  }

  // 3. Parse Macros (Protein, Fat, Net Carbs, Fiber)
  // Handles "161.0g Protein" or "Protein: 161.0"
  const getMacro = (labelRegex, text) => {
    const m = text.match(new RegExp(`([\\d.]+)\\s*g?\\s*${labelRegex}`, 'i')) || 
              text.match(new RegExp(`${labelRegex}:?\\s*\\*?\\*?\\s*([\\d.]+)`, 'i'));
    return m ? parseFloat(m[1]) : 0;
  };

  data.protein = getMacro('Protein', text);
  data.fat = getMacro('Fat', text);
  data.netCarbs = getMacro('(?:Net\\s*)?Carbs', text);
  data.fiber = getMacro('Fiber', text);

  // 4. Capture Foods Tracked
  // Capture all text following the phrase 'Foods Tracked:' up to the end of the entry or the next structural label (like 'Notes:')
  const foodsMatch = text.match(/Foods Tracked:([\s\S]*?)(?:\*?\*?\s*(?:Notes|Ketosis Status|Deficit|Cumulative):|$)/i);
  if (foodsMatch) {
    data.foodsTracked = foodsMatch[1]
      .replace(/\[cite:\s*\d+\]/gi, "") // Strip [cite: 1]
      .replace(/\*\*|\*/g, "") // Strip markdown wrappers
      .replace(/max|Target:\s*>?\s*\d+g?/gi, "") // Strip labels and targets
      .replace(/\\/g, "") // Strip text citations/links matching pattern \
      .trim();
  }

  return data;
};
