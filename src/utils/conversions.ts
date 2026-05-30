/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MeasurementUnit, MasterIngredient, Recipe, RecipeIngredient } from '../types';

// Conversion factors to standard grams (g)
export const weightFactors: Record<string, number> = {
  g: 1,
  kg: 1000,
  lb: 453.59237,
  oz: 28.3495231,
};

// Conversion factors to standard milliliters (ml)
export const volumeFactors: Record<string, number> = {
  ml: 1,
  l: 1000,
  fl_oz: 29.5735296,
};

export function isWeightUnit(unit: MeasurementUnit): boolean {
  return unit in weightFactors;
}

export function isVolumeUnit(unit: MeasurementUnit): boolean {
  return unit in volumeFactors;
}

/**
 * Calculates absolute cost per gram and cost per milliliter of a master ingredient,
 * taking its density into account if conversion between weight and volume is needed.
 */
export function getIngredientUnitCosts(ingredient: MasterIngredient): { costPerG: number; costPerMl: number } {
  const d = ingredient.density || 1.0;
  let costPerG = 0;
  let costPerMl = 0;

  if (isWeightUnit(ingredient.baseUnit)) {
    const factor = weightFactors[ingredient.baseUnit] || 1;
    const totalGrams = ingredient.baseQuantity * factor;
    if (totalGrams > 0) {
      costPerG = ingredient.baseCost / totalGrams;
      costPerMl = costPerG * d;
    }
  } else if (isVolumeUnit(ingredient.baseUnit)) {
    const factor = volumeFactors[ingredient.baseUnit] || 1;
    const totalMl = ingredient.baseQuantity * factor;
    if (totalMl > 0) {
      costPerMl = ingredient.baseCost / totalMl;
      costPerG = costPerMl / d;
    }
  }

  return { costPerG, costPerMl };
}

/**
 * Calculates the exact cost of a specific quantity and unit for an ingredient.
 */
export function calculateIngredientCost(ingredient: MasterIngredient, qty: number, unit: MeasurementUnit): number {
  if (qty <= 0) return 0;
  const { costPerG, costPerMl } = getIngredientUnitCosts(ingredient);

  if (isWeightUnit(unit)) {
    const factor = weightFactors[unit] || 1;
    const qtyInGrams = qty * factor;
    return qtyInGrams * costPerG;
  } else {
    const factor = volumeFactors[unit] || 1;
    const qtyInMl = qty * factor;
    return qtyInMl * costPerMl;
  }
}

/**
 * Normalizes a dynamic measurement to standard output value in ml or g for summary
 */
export function getNormalizedQuantity(qty: number, unit: MeasurementUnit, density: number = 1.0): { value: number; label: string } {
  if (isWeightUnit(unit)) {
    const value = qty * (weightFactors[unit] || 1);
    return { value, label: `${value.toFixed(1)} g` };
  } else {
    const value = qty * (volumeFactors[unit] || 1);
    return { value, label: `${value.toFixed(1)} ml` };
  }
}

/**
 * Calculates the total cost of any recipe recursively, accounting for sub-recipes.
 */
export function getRecipeTotalCost(
  recipe: Recipe,
  allRecipes: Recipe[],
  masterIngredients: MasterIngredient[],
  visited: Set<string> = new Set()
): number {
  if (visited.has(recipe.id)) {
    return 0; // Prevent infinite feedback loop
  }
  visited.add(recipe.id);

  const latestVer = recipe.versions.find((v) => v.version === recipe.currentVersion) || recipe.versions[0];
  if (!latestVer) {
    visited.delete(recipe.id);
    return 0;
  }

  const cost = latestVer.ingredients.reduce((acc, row) => {
    if (row.isSubRecipe) {
      // Find the sub-recipe
      const subRec = allRecipes.find((r) => r.id === row.ingredientId);
      if (!subRec) return acc;

      const subTotalCost = getRecipeTotalCost(subRec, allRecipes, masterIngredients, new Set(visited));
      const subVer = subRec.versions.find((v) => v.version === subRec.currentVersion) || subRec.versions[0];
      if (!subVer || subVer.batchYieldValue <= 0) return acc;

      // Standardize requested dose and sub-recipe yield
      let requestedInStd = 0;
      if (isVolumeUnit(row.unit)) {
        requestedInStd = row.quantity * (volumeFactors[row.unit] || 1); // ml
      } else {
        requestedInStd = row.quantity * (weightFactors[row.unit] || 1); // g
      }

      // Determine sub-recipe output standard class
      const yieldUnitStr = subVer.batchYieldUnit.toLowerCase();
      let yieldUnitStdClass: 'volume' | 'weight' | 'other' = 'other';
      let yieldFactor = 1;

      if (['ml', 'l', 'fl_oz'].includes(yieldUnitStr)) {
        yieldUnitStdClass = 'volume';
        yieldFactor = yieldUnitStr === 'l' ? 1000 : yieldUnitStr === 'fl_oz' ? 29.5735296 : 1;
      } else if (['g', 'kg', 'lb', 'oz'].includes(yieldUnitStr)) {
        yieldUnitStdClass = 'weight';
        yieldFactor = yieldUnitStr === 'kg' ? 1000 : yieldUnitStr === 'lb' ? 453.59237 : yieldUnitStr === 'oz' ? 28.3495231 : 1;
      }

      let subTotalYieldInStd = subVer.batchYieldValue * yieldFactor;

      if (yieldUnitStdClass === 'volume') {
        const rowVolMl = isWeightUnit(row.unit) ? requestedInStd / 1.0 : requestedInStd; // assume density 1.0
        const proportion = rowVolMl / subTotalYieldInStd;
        return acc + (subTotalCost * proportion);
      } else if (yieldUnitStdClass === 'weight') {
        const rowWeightG = isVolumeUnit(row.unit) ? requestedInStd * 1.0 : requestedInStd;
        const proportion = rowWeightG / subTotalYieldInStd;
        return acc + (subTotalCost * proportion);
      } else {
        // 'porciones' or 'other'
        const proportion = row.quantity / subVer.batchYieldValue;
        return acc + (subTotalCost * proportion);
      }
    } else {
      // Standard Ingredient
      const master = masterIngredients.find((m) => m.id === row.ingredientId);
      if (!master) return acc;
      return acc + calculateIngredientCost(master, row.quantity, row.unit);
    }
  }, 0);

  visited.delete(recipe.id);
  return cost;
}

/**
 * Calculates the total cost of an array of RecipeIngredients potentially containing sub-recipes.
 */
export function calculateVersionCostWithSubrecipes(
  ingredientsArr: RecipeIngredient[],
  allRecipes: Recipe[],
  masterIngredientsForLookup: MasterIngredient[],
  visited: Set<string> = new Set()
): number {
  return ingredientsArr.reduce((acc, row) => {
    if (row.isSubRecipe) {
      const subRec = allRecipes.find((r) => r.id === row.ingredientId);
      if (!subRec) return acc;

      const subTotalCost = getRecipeTotalCost(subRec, allRecipes, masterIngredientsForLookup, new Set(visited));
      const subVer = subRec.versions.find((v) => v.version === subRec.currentVersion) || subRec.versions[0];
      if (!subVer || subVer.batchYieldValue <= 0) return acc;

      // Standardize requested dose and sub-recipe yield
      let requestedInStd = 0;
      if (isVolumeUnit(row.unit)) {
        requestedInStd = row.quantity * (volumeFactors[row.unit] || 1); // ml
      } else {
        requestedInStd = row.quantity * (weightFactors[row.unit] || 1); // g
      }

      // Determine sub-recipe output standard class
      const yieldUnitStr = subVer.batchYieldUnit.toLowerCase();
      let yieldUnitStdClass: 'volume' | 'weight' | 'other' = 'other';
      let yieldFactor = 1;

      if (['ml', 'l', 'fl_oz'].includes(yieldUnitStr)) {
        yieldUnitStdClass = 'volume';
        yieldFactor = yieldUnitStr === 'l' ? 1000 : yieldUnitStr === 'fl_oz' ? 29.5735296 : 1;
      } else if (['g', 'kg', 'lb', 'oz'].includes(yieldUnitStr)) {
        yieldUnitStdClass = 'weight';
        yieldFactor = yieldUnitStr === 'kg' ? 1000 : yieldUnitStr === 'lb' ? 453.59237 : yieldUnitStr === 'oz' ? 28.3495231 : 1;
      }

      let subTotalYieldInStd = subVer.batchYieldValue * yieldFactor;

      if (yieldUnitStdClass === 'volume') {
        const rowVolMl = isWeightUnit(row.unit) ? requestedInStd / 1.0 : requestedInStd; // assume density 1.0
        const proportion = rowVolMl / subTotalYieldInStd;
        return acc + (subTotalCost * proportion);
      } else if (yieldUnitStdClass === 'weight') {
        const rowWeightG = isVolumeUnit(row.unit) ? requestedInStd * 1.0 : requestedInStd;
        const proportion = rowWeightG / subTotalYieldInStd;
        return acc + (subTotalCost * proportion);
      } else {
        // 'porciones' or 'other'
        const proportion = row.quantity / subVer.batchYieldValue;
        return acc + (subTotalCost * proportion);
      }
    } else {
      // Standard Ingredient
      const master = masterIngredientsForLookup.find((m) => m.id === row.ingredientId);
      if (!master) return acc;
      return acc + calculateIngredientCost(master, row.quantity, row.unit);
    }
  }, 0);
}

/**
 * Formats standard currency string in COP or USD or general $ depending on target.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
