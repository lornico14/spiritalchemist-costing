/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Recipe, MasterIngredient, Tenant, RecipeIngredient } from '../types';
import { 
  getRecipeTotalCost, 
  calculateVersionCostWithSubrecipes, 
  formatCurrency 
} from '../utils/conversions';
import { 
  Printer, 
  ArrowLeft, 
  Sparkles, 
  Layers, 
  Info,
  Beaker
} from 'lucide-react';

interface BatchPrintLayoutProps {
  visibleRecipes: Recipe[];
  allRecipes: Recipe[];
  masterIngredients: MasterIngredient[];
  tenants: Tenant[];
  currentTenantId: string;
  onClose: () => void;
}

export default function BatchPrintLayout({
  visibleRecipes,
  allRecipes,
  masterIngredients,
  tenants,
  currentTenantId,
  onClose
}: BatchPrintLayoutProps) {
  
  // Try to find the establishment name
  const currentTenantName = tenants.find(t => t.id === currentTenantId)?.name || 'The Last Straw';

  // Automatically trigger printing when view is open if desired, or let user click. 
  // Let's give them the manual trigger for better control.

  const handlePrint = () => {
    window.print();
  };

  const getIngredientRowInfo = (row: RecipeIngredient) => {
    if (row.isSubRecipe) {
      const subRec = allRecipes.find((r) => r.id === row.ingredientId);
      if (!subRec) return { name: 'Removed Sub-Recipe', category: 'Sub-Recipe', baseLabel: 'N/A', isSub: true };
      const subVer = subRec.versions.find((v) => v.version === subRec.currentVersion) || subRec.versions[0];
      const subCost = getRecipeTotalCost(subRec, allRecipes, masterIngredients);
      const baseLabel = subVer 
        ? `${formatCurrency(subCost)} per Batch of ${subVer.batchYieldValue} ${subVer.batchYieldUnit}`
        : 'Loading...';
      return {
        name: subRec.name,
        category: 'Sub-Recipe',
        baseLabel,
        isSub: true,
      };
    } else {
      const master = masterIngredients.find((m) => m.id === row.ingredientId);
      if (!master) return { name: 'Removed Ingredient', category: 'Others', baseLabel: 'N/A', isSub: false };
      const baseLabel = `${formatCurrency(master.baseCost)} x ${master.baseQuantity} ${master.baseUnit}`;
      return {
        name: master.name,
        category: master.category,
        baseLabel,
        isSub: false,
      };
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans text-slate-800" id="batch-print-workbench-layout">
      {/* Top Controller Bar - Hidden when printing */}
      <div className="max-w-4xl mx-auto mb-6 bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-4 no-print" id="batch-print-navigator-header">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl transition cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
              <Beaker className="h-4.5 w-4.5 text-indigo-400" />
              Batch PDF Export Desk
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Venue: <strong className="text-indigo-300 font-bold">{currentTenantName}</strong> • {visibleRecipes.length} consolidated formulas
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-xs font-semibold rounded-lg cursor-pointer transition"
          >
            Back to Workspace
          </button>
          <button
            onClick={handlePrint}
            className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-755 text-white text-xs font-extrabold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-md"
          >
            <Printer className="h-4 w-4" />
            Print / Save compiled PDF
          </button>
        </div>
      </div>

      {/* Floating alert tip - Hidden when printing */}
      <div className="max-w-4xl mx-auto mb-8 bg-indigo-50 border border-indigo-150 p-4 rounded-xl flex items-start gap-3 no-print">
        <Info className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
        <div className="text-xs text-indigo-900 leading-relaxed">
          <span className="font-bold block">📄 Batch PDF Compilation Tips:</span> 
          This view merges high-fidelity tech sheets for all {visibleRecipes.length} recipes in <strong className="text-indigo-950 font-bold">{currentTenantName}</strong>. 
          Inside the browser print settings, verify that **"Background Graphics"** is enabled, and **"Margins"** is set to **"Default"** or **"None"** to secure precise pagination boundaries.
        </div>
      </div>

      {/* Compiled sheets list container */}
      <div className="space-y-12" id="compiled-sheets-scroll-viewport">
        {visibleRecipes.map((recipe) => {
          const latestVersionSnapshot = recipe.versions.find((v) => v.version === recipe.currentVersion) || recipe.versions[0];
          if (!latestVersionSnapshot) return null;

          const activeTotalCost = getRecipeTotalCost(recipe, allRecipes, masterIngredients);
          const activeCostPerUnit = latestVersionSnapshot.batchYieldValue > 0 
            ? activeTotalCost / latestVersionSnapshot.batchYieldValue 
            : 0;

          return (
            <div
              key={recipe.id}
              className="p-8 sm:p-12 md:p-16 bg-white rounded-2xl border border-slate-205 shadow-xl max-w-4xl mx-auto space-y-8 font-sans printable-section bg-white text-black"
              style={{ pageBreakAfter: 'always' }}
            >
              {/* Print Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
                <div className="space-y-1">
                  <div className="text-[10px] font-black tracking-widest text-indigo-600 uppercase">Food & Beverage Cost Control Technical File</div>
                  <h1 className="text-xl font-black text-slate-950 tracking-tight">{recipe.name} COSTING SHEET</h1>
                  <p className="text-slate-500 text-[11px]">Venue: {currentTenantName} • Dilution yield, and bar liquid assets costing</p>
                </div>

                <div className="text-right space-y-1">
                  <div className="font-extrabold text-xs text-slate-800">Version: {recipe.currentVersion}</div>
                  <div className="text-[9px] text-slate-400 font-mono">Issued: {new Date().toLocaleDateString('en-US')}</div>
                  <div className="text-[9px] bg-slate-100 text-slate-655 px-2 py-0.5 rounded inline-block font-semibold">STATUS: VERIFIED</div>
                </div>
              </div>

              {/* General Tech Data Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-150 text-xs">
                <div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase">Drink Name</div>
                  <div className="text-xs font-bold text-slate-850 mt-0.5">{recipe.name}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase">Net Batch Yield</div>
                  <div className="text-xs font-bold text-slate-850 mt-0.5 font-mono">
                    {latestVersionSnapshot.batchYieldValue} {latestVersionSnapshot.batchYieldUnit === 'porciones' ? 'servings' : latestVersionSnapshot.batchYieldUnit}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase">Total Batch Cost</div>
                  <div className="text-xs font-bold text-emerald-755 mt-0.5 font-mono">{formatCurrency(activeTotalCost)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase">Unit Yield Cost</div>
                  <div className="text-xs font-bold text-indigo-755 mt-0.5 font-mono">
                    {formatCurrency(activeCostPerUnit)} / {latestVersionSnapshot.batchYieldUnit === 'porciones' ? 'serving' : latestVersionSnapshot.batchYieldUnit}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5 text-xs text-left">
                <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Description & Custom Instructions</h4>
                <p className="text-slate-600 leading-relaxed italic border-l-2 border-indigo-500 pl-3">
                  {recipe.description || 'No detailed instructions configured.'}
                </p>
              </div>

              {/* Ingredients Details breakdown list */}
              <div className="space-y-2.5 text-left">
                <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Ingredient & Sub-Recipe Breakdown</h4>
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[9px] border-b border-slate-200">
                      <th className="px-3 py-2">Ingredient Used</th>
                      <th className="px-3 py-2">Catalog Package Price / Source</th>
                      <th className="px-3 py-2">Recipe Dosage</th>
                      <th className="px-3 py-2 text-right">Calculated Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {latestVersionSnapshot.ingredients.map((row, idx) => {
                      const { name, category, baseLabel, isSub } = getIngredientRowInfo(row);
                      const calculatedCost = calculateVersionCostWithSubrecipes([row], allRecipes, masterIngredients);

                      return (
                        <tr key={idx} className="bg-white">
                          <td className="px-3 py-2 text-slate-800">
                            <span className="font-bold inline-flex items-center gap-1">
                              {isSub && <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />}
                              {name}
                            </span>
                            <span className="block text-[8px] text-slate-400 tracking-wider font-semibold uppercase">
                              {category === 'Sub-receta' ? 'Sub-Recipe' : category}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-500 text-[11px]">
                            {baseLabel}
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-700 font-mono">
                            {row.quantity} {row.unit}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900 font-mono">
                            {formatCurrency(calculatedCost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-350">
                      <td colSpan={2} className="px-3 py-2.5 text-slate-700">TOTAL BATCH INGREDIENTS COST</td>
                      <td className="px-3 py-2.5 font-mono">
                        {latestVersionSnapshot.ingredients.reduce((acc, r) => acc + r.quantity, 0).toFixed(1)} ml/g
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-950 font-mono text-xs">
                        {formatCurrency(activeTotalCost)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures check */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="space-y-4">
                  <div className="border-b border-slate-900 mx-auto max-w-[180px] h-8"></div>
                  <div>
                    <div className="font-bold text-slate-800">Bar Manager Signature</div>
                    <div className="text-[10px] text-slate-400">Beverage Costing Yield Check</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border-b border-slate-900 mx-auto max-w-[180px] h-8"></div>
                  <div>
                    <div className="font-bold text-slate-800">Finance & Cost Approval</div>
                    <div className="text-[10px] text-slate-400">Target Profit Margin Validation</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
