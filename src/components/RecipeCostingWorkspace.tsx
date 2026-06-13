/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Recipe, MasterIngredient, RecipeIngredient, RecipeVersion, YieldUnit, MeasurementUnit } from '../types';
import {
  calculateIngredientCost,
  formatCurrency,
  getNormalizedQuantity,
  getRecipeTotalCost,
  calculateVersionCostWithSubrecipes
} from '../utils/conversions';
import {
  FileText,
  Printer,
  History,
  TrendingUp,
  Plus,
  Trash,
  Save,
  Clock,
  Coins,
  ChevronRight,
  TrendingDown,
  Info,
  Layers,
  Sparkles,
  RefreshCw,
  MessageSquare,
  Flame,
  ArrowRight,
  Shield
} from 'lucide-react';
import { User, Tenant } from '../types';

interface RecipeCostingWorkspaceProps {
  recipe: Recipe;
  recipes: Recipe[]; // All recipes to resolve nested sub-recipes
  masterIngredients: MasterIngredient[];
  onUpdateRecipe: (updated: Recipe) => void;
  key?: string | number;
  currentUser?: User | null;
  tenants?: Tenant[];
  onDeleteRecipe?: (recipe: Recipe) => void;
}

export default function RecipeCostingWorkspace({
  recipe,
  recipes,
  masterIngredients,
  onUpdateRecipe,
  currentUser,
  tenants = [],
  onDeleteRecipe
}: RecipeCostingWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'costing' | 'history' | 'print' | 'guide'>('costing');

  // Permissions check — client users cannot mutate Corporate Standard templates
  const isReadOnly = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'superadmin') return false;
    return recipe.tenantId === 'global';
  }, [recipe.tenantId, currentUser]);

  // --- VERSIONING & COMPARISON STATUS ----
  const [versionToCompareA, setVersionToCompareA] = useState<number>(recipe.currentVersion);
  const [versionToCompareB, setVersionToCompareB] = useState<number>(
    recipe.versions.length > 1 ? recipe.versions[1].version : recipe.currentVersion
  );

  // --- EDITING STATE ----
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(recipe.name);
  const [editedDescription, setEditedDescription] = useState(recipe.description);
  const [editedTenantId, setEditedTenantId] = useState(recipe.tenantId || 'global');
  const [editedRetailPrice, setEditedRetailPrice] = useState<number>(recipe.retailPrice || 0);

  // Working draft for recipe items
  const [editIngredients, setEditIngredients] = useState<RecipeIngredient[]>([]);
  const [editYieldValue, setEditYieldValue] = useState<number>(100);
  const [editYieldUnit, setEditYieldUnit] = useState<YieldUnit>('ml');

  // Version comments modal
  const [showSaveVersionModal, setShowSaveVersionModal] = useState(false);
  const [versionNote, setVersionNote] = useState('');

  // Interactive local simulation price state
  const [simulatedPrice, setSimulatedPrice] = useState<number>(0);
  const [lastRecipeId, setLastRecipeId] = useState<string>('');

  // Active snapshot representation
  const latestVersionSnapshot = useMemo(() => {
    const found = recipe.versions.find((v) => v.version === recipe.currentVersion) || recipe.versions[0];
    if (found) return found;
    return {
      version: 1,
      note: 'Starter Version',
      updatedAt: new Date().toISOString(),
      batchYieldValue: 300,
      batchYieldUnit: 'ml' as YieldUnit,
      ingredients: [],
    };
  }, [recipe]);

  // Combined selector choices of master ingredients + sub-recipes (excluding current recipe to prevent loops)
  const selectorChoices = useMemo(() => {
    const ingChoices = masterIngredients.map((m) => ({
      id: m.id,
      name: `${m.name}`,
      category: m.category,
      isSubRecipe: false,
    }));

    const subChoices = recipes
      .filter((r) => r.type === 'sub_receta' && r.id !== recipe.id)
      .map((r) => ({
        id: r.id,
        name: `⭐ [Sub-Recipe] ${r.name}`,
        category: 'Sub-Recipe',
        isSubRecipe: true,
      }));

    return [...ingChoices, ...subChoices];
  }, [masterIngredients, recipes, recipe.id]);

  // Recursively calculate total cost of a version
  const calculateVersionTotalCost = (ver: RecipeVersion) => {
    return calculateVersionCostWithSubrecipes(ver.ingredients, recipes, masterIngredients);
  };

  const activeTotalCost = useMemo(() => {
    return calculateVersionTotalCost(latestVersionSnapshot);
  }, [latestVersionSnapshot, recipes, masterIngredients]);

  // Cost per unit calculation
  const activeCostPerUnit = useMemo(() => {
    if (latestVersionSnapshot.batchYieldValue <= 0) return 0;
    return activeTotalCost / latestVersionSnapshot.batchYieldValue;
  }, [activeTotalCost, latestVersionSnapshot]);

  // Cost per single portion / serving (yield unit of 'porciones' or 'botellas' uses activeCostPerUnit, otherwise entire batch is 1 serving)
  const activeServingCost = useMemo(() => {
    if (latestVersionSnapshot.batchYieldUnit === 'porciones' || latestVersionSnapshot.batchYieldUnit === 'botellas') {
      return activeCostPerUnit;
    }
    return activeTotalCost;
  }, [activeTotalCost, activeCostPerUnit, latestVersionSnapshot]);

  // Dynamic step for sales price slider based on serving cost currency scale
  const dynamicStep = useMemo(() => {
    if (activeServingCost > 5000) return 500;
    if (activeServingCost > 1000) return 100;
    if (activeServingCost > 100) return 5;
    return 0.25;
  }, [activeServingCost]);

  // Start editor draft mode
  const handleStartEditing = () => {
    setEditedName(recipe.name);
    setEditedDescription(recipe.description);
    setEditedTenantId(recipe.tenantId || 'global');
    setEditedRetailPrice(recipe.retailPrice || 0);
    setEditIngredients([...latestVersionSnapshot.ingredients]);
    setEditYieldValue(latestVersionSnapshot.batchYieldValue);
    setEditYieldUnit(latestVersionSnapshot.batchYieldUnit);
    setIsEditing(true);
  };

  // Keep simulated price synced to active recipe changes
  if (recipe.id !== lastRecipeId) {
    setSimulatedPrice(recipe.retailPrice || (activeServingCost > 0 ? Number((activeServingCost * 4).toFixed(2)) : 10.00));
    setLastRecipeId(recipe.id);
  }

  const handleQuickSaveRetailPrice = (priceVal: number) => {
    const updatedRecipe: Recipe = {
      ...recipe,
      retailPrice: Number(priceVal.toFixed(2)),
    };
    onUpdateRecipe(updatedRecipe);
  };

  // Cancel edit
  const handleCancelEditing = () => {
    setIsEditing(false);
    setShowSaveVersionModal(false);
  };

  // Row operations in draft mode
  const handleAddIngredientRow = () => {
    if (selectorChoices.length === 0) {
      alert('You must create commercial ingredients or sub-recipes first.');
      return;
    }
    const defaultChoice = selectorChoices[0];
    let defaultUnit: MeasurementUnit = 'ml';
    if (!defaultChoice.isSubRecipe) {
      const master = masterIngredients.find((m) => m.id === defaultChoice.id);
      if (master && (master.baseUnit === 'each' || master.baseUnit === 'u')) {
        defaultUnit = master.baseUnit;
      }
    }
    const newRow: RecipeIngredient = {
      id: `draft-row-${Date.now()}-${Math.random()}`,
      ingredientId: defaultChoice.id,
      isSubRecipe: defaultChoice.isSubRecipe,
      quantity: 10,
      unit: defaultUnit,
    };
    setEditIngredients([...editIngredients, newRow]);
  };

  const handleRemoveIngredientRow = (rowId: string) => {
    setEditIngredients(editIngredients.filter((row) => row.id !== rowId));
  };

  const handleUpdateRow = (rowId: string, fields: Partial<RecipeIngredient>) => {
    setEditIngredients(
      editIngredients.map((row) => {
        if (row.id === rowId) {
          const updatedRow = { ...row, ...fields };
          // If ingredient selection changed, sync the isSubRecipe flag!
          if (fields.ingredientId) {
            const match = selectorChoices.find((c) => c.id === fields.ingredientId);
            if (match) {
              updatedRow.isSubRecipe = match.isSubRecipe;
              if (!match.isSubRecipe) {
                const master = masterIngredients.find((m) => m.id === fields.ingredientId);
                if (master && (master.baseUnit === 'each' || master.baseUnit === 'u')) {
                  updatedRow.unit = master.baseUnit;
                }
              }
            }
          }
          return updatedRow;
        }
        return row;
      })
    );
  };

  // Draft dynamic totals calculated for the live interface
  const draftTotalCost = useMemo(() => {
    return calculateVersionCostWithSubrecipes(editIngredients, recipes, masterIngredients);
  }, [editIngredients, recipes, masterIngredients]);

  // Trigger Save Confirmation
  const triggerSaveNewVersion = () => {
    if (editIngredients.length === 0) {
      alert('The recipe must contain at least 1 ingredient or sub-recipe.');
      return;
    }
    if (editYieldValue <= 0) {
      alert('The batch yield quantity must be a positive number.');
      return;
    }
    setVersionNote('');
    setShowSaveVersionModal(true);
  };

  // Confirmed persistent save version
  const handleSaveConfirmed = () => {
    const nextVerNumber = recipe.currentVersion + 1;
    const newVersionObj: RecipeVersion = {
      version: nextVerNumber,
      updatedAt: new Date().toISOString(),
      note: versionNote.trim() || `Version ${nextVerNumber} - Adjustments & Costing`,
      ingredients: editIngredients.map((row) => ({
        id: row.id.startsWith('draft-') ? `row-${nextVerNumber}-${Date.now()}-${Math.random()}` : row.id,
        ingredientId: row.ingredientId,
        isSubRecipe: row.isSubRecipe,
        quantity: Number(row.quantity) || 0,
        unit: row.unit,
      })),
      batchYieldValue: Number(editYieldValue) || 1,
      batchYieldUnit: editYieldUnit,
    };

    const updatedRecipe: Recipe = {
      ...recipe,
      name: editedName,
      description: editedDescription,
      tenantId: editedTenantId,
      currentVersion: nextVerNumber,
      versions: [newVersionObj, ...recipe.versions], // pre-pended so index 0 is newest
      retailPrice: Number(editedRetailPrice) || 0,
    };

    onUpdateRecipe(updatedRecipe);
    setIsEditing(false);
    setShowSaveVersionModal(false);
    // Auto sync selectors
    setVersionToCompareA(nextVerNumber);
    setVersionToCompareB(recipe.currentVersion);
  };

  // --- SIDE-BY-SIDE HISTORICAL COMPARISON LOGIC ----
  const comparedVersionsData = useMemo(() => {
    const vAObj = recipe.versions.find((v) => v.version === versionToCompareA);
    const vBObj = recipe.versions.find((v) => v.version === versionToCompareB);

    if (!vAObj || !vBObj) return null;

    const costA = calculateVersionTotalCost(vAObj);
    const costB = calculateVersionTotalCost(vBObj);

    // Build unique ingredient row listing
    const allIngIdsMap = new Set<string>();
    vAObj.ingredients.forEach((i) => allIngIdsMap.add(i.ingredientId));
    vBObj.ingredients.forEach((i) => allIngIdsMap.add(i.ingredientId));

    const rows = Array.from(allIngIdsMap).map((ingId) => {
      // Find either master ingredient OR sub-recipe
      const master = masterIngredients.find((m) => m.id === ingId);
      const subRec = recipes.find((r) => r.id === ingId);

      const isSubRecipe = !!subRec;
      const name = subRec ? `[Sub-Recipe] ${subRec.name}` : (master ? master.name : 'Removed Ingredient');
      const category = subRec ? 'Sub-Recipe' : (master ? master.category : 'Others');

      const ingA = vAObj.ingredients.find((i) => i.ingredientId === ingId);
      const ingB = vBObj.ingredients.find((i) => i.ingredientId === ingId);

      // Cost calculation helper for A and B
      const getSingleCost = (rowItem: RecipeIngredient | undefined) => {
        if (!rowItem) return 0;
        return calculateVersionCostWithSubrecipes([rowItem], recipes, masterIngredients);
      };

      const costInA = getSingleCost(ingA);
      const costInB = getSingleCost(ingB);

      return {
        ingId,
        name,
        category,
        isSubRecipe,
        // Version A
        qtyA: ingA ? ingA.quantity : 0,
        unitA: ingA ? ingA.unit : '',
        costA: costInA,
        // Version B
        qtyB: ingB ? ingB.quantity : 0,
        unitB: ingB ? ingB.unit : '',
        costB: costInB,
        // Type of modification
        status: !ingA ? 'Added in B' : !ingB ? 'Removed in B' : 'Modified',
      };
    });

    return {
      vAObj,
      vBObj,
      costA,
      costB,
      rows,
    };
  }, [versionToCompareA, versionToCompareB, recipe, masterIngredients, recipes]);

  // Native UI Printing handler
  const handlePrint = () => {
    window.print();
  };

  // Helper row info
  const getIngredientRowInfo = (row: RecipeIngredient) => {
    if (row.isSubRecipe) {
      const subRec = recipes.find((r) => r.id === row.ingredientId);
      if (!subRec) return { name: 'Removed Sub-Recipe', category: 'Sub-Recipe', baseLabel: 'N/A' };
      const subVer = subRec.versions.find((v) => v.version === subRec.currentVersion) || subRec.versions[0];
      const subCost = getRecipeTotalCost(subRec, recipes, masterIngredients);
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
      if (!master) return { name: 'Removed Ingredient', category: 'Others', baseLabel: 'N/A' };
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
    <div className="space-y-6" id="recipe-workspace-root">
      {/* Recipe Header Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-150">
                <Layers className="h-3.5 w-3.5" />
                Version {recipe.currentVersion} ({recipe.type === 'sub_receta' ? 'Base Sub-Recipe' : 'Final Drink'})
              </span>
              <span className="text-slate-400 text-xs font-mono">
                Updated: {new Date(latestVersionSnapshot.updatedAt).toLocaleDateString('en-US')}
              </span>
            </div>

            {isEditing ? (
              <div className="space-y-4 mt-2 pr-0 md:pr-10">
                <div className={`grid grid-cols-1 ${recipe.type === 'bebida' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Recipe Name *</label>
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="w-full text-base font-bold font-sans text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 px-3 py-2"
                      placeholder="Recipe Name"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Establishment / Venue *</label>
                    {currentUser?.role === 'superadmin' ? (
                      <select
                        value={editedTenantId}
                        onChange={(e) => setEditedTenantId(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white px-3 py-2 h-[38px] cursor-pointer"
                      >
                        <option value="global">Global (Corporate/Shared)</option>
                        {tenants.map((t) => (
                          t.id !== 'global' && (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          )
                        ))}
                      </select>
                    ) : (
                      <div className="w-full text-xs font-semibold text-slate-500 border border-slate-200 rounded-xl bg-slate-100/80 px-3 py-2 h-[38px] flex items-center">
                        {recipe.tenantId === 'global' ? 'Global (Corporate/Shared)' : tenants.find(t => t.id === recipe.tenantId)?.name || recipe.tenantId}
                      </div>
                    )}
                  </div>
                  {recipe.type === 'bebida' && (
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Retail Price ($) *</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editedRetailPrice || ''}
                        onChange={(e) => setEditedRetailPrice(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full text-xs font-bold font-mono text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white px-3 py-2 h-[38px]"
                        placeholder="e.g. 12.00"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Directions & Description</label>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className="w-full text-slate-500 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                    placeholder="Add description, preparation directions, notes..."
                    rows={2}
                  />
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight font-sans flex items-center gap-2">
                  {recipe.name}
                </h1>
                <p className="text-slate-500 text-sm mt-1 max-w-3xl leading-relaxed">
                  {recipe.description || 'No detailed description available.'}
                </p>
                <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400">
                  <MessageSquare className="h-4 w-4 text-slate-350 shrink-0" />
                  <span className="italic">Change log: "{latestVersionSnapshot.note}"</span>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto self-stretch md:self-auto justify-end border-t md:border-t-0 pt-4 md:pt-0">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancelEditing}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={triggerSaveNewVersion}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition relative"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </button>
              </>
            ) : (
              isReadOnly ? (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-500 text-xxs font-extrabold uppercase tracking-wider rounded-xl border border-slate-200">
                  <Shield className="h-4 w-4 text-slate-400 shrink-0" />
                  Global Corporate Standard (Read Only)
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={handleStartEditing}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition cursor-pointer"
                  >
                    Modify Recipe & Costings
                  </button>
                  {onDeleteRecipe && (
                    <button
                      onClick={() => onDeleteRecipe(recipe)}
                      className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-semibold text-xs rounded-xl transition cursor-pointer border border-rose-150 inline-flex items-center gap-1.5 shrink-0"
                      title="Delete this recipe permanently"
                    >
                      <Trash className="h-4 w-4" />
                      <span>Delete Recipe</span>
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-t border-slate-100 mt-6 pt-2" id="workspace-tabs-navigator">
          <button
            onClick={() => setActiveTab('costing')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs transition border-b-2 cursor-pointer ${
              activeTab === 'costing'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Coins className="h-4 w-4" />
            Costing Worksheet
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs transition border-b-2 cursor-pointer ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="h-4 w-4" />
            Version History
          </button>
          <button
            onClick={() => setActiveTab('print')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs transition border-b-2 cursor-pointer ${
              activeTab === 'print'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Printer className="h-4 w-4" />
            Printable Sheet / PDF
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs transition border-b-2 cursor-pointer ${
              activeTab === 'guide'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="h-4 w-4" />
            Recipe Manual & Guide
          </button>
        </div>
      </div>

      {/* --- LIVE WORKSPACE CONTENT --- */}
      {activeTab === 'costing' && (
        <div className="space-y-6">
          {/* Main cost indicators Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Batch Cost</div>
              <div className="text-2xl font-black text-slate-800 mt-2 font-mono">
                {isEditing ? formatCurrency(draftTotalCost) : formatCurrency(activeTotalCost)}
              </div>
              <div className="text-slate-400 text-xxs mt-1">Sum of all raw items and sub-recipes</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Net Yield (Batch Yield)</div>
              <div className="flex items-baseline gap-1.5 mt-2">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={editYieldValue}
                      min="0.1"
                      step="any"
                      onChange={(e) => setEditYieldValue(Number(e.target.value) || 1)}
                      className="w-16 px-1.5 py-0.5 border border-indigo-250 rounded text-sm bg-slate-50 font-semibold text-slate-700 font-mono"
                    />
                    <select
                      value={editYieldUnit}
                      onChange={(e) => setEditYieldUnit(e.target.value as YieldUnit)}
                      className="text-xs px-1 py-1 border border-indigo-250 bg-slate-50 rounded bg-white text-slate-700"
                    >
                      <option value="ml">ml</option>
                      <option value="oz">oz</option>
                      <option value="fl_oz">fl oz</option>
                      <option value="porciones">servings</option>
                      <option value="botellas">bottles</option>
                      <option value="batch">batch</option>
                      <option value="g">grams (g)</option>
                    </select>
                  </div>
                ) : (
                  <>
                    <span className="text-2xl font-black text-indigo-700 font-mono">
                      {latestVersionSnapshot.batchYieldValue}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      {latestVersionSnapshot.batchYieldUnit === 'porciones' ? 'servings' : latestVersionSnapshot.batchYieldUnit === 'botellas' ? 'bottles' : latestVersionSnapshot.batchYieldUnit}
                    </span>
                  </>
                )}
              </div>
              <div className="text-slate-400 text-xxs mt-1">Total liquid outcome or servings</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Unit Production Cost</div>
              <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                {isEditing ? (
                  editYieldValue > 0 ? (
                    formatCurrency(draftTotalCost / editYieldValue)
                  ) : (
                    '$0.00'
                  )
                ) : (
                  formatCurrency(activeCostPerUnit)
                )}
                <span className="text-xxs text-slate-400 font-semibold ml-1">
                  / {isEditing ? editYieldUnit : (latestVersionSnapshot.batchYieldUnit === 'porciones' ? 'serving' : latestVersionSnapshot.batchYieldUnit === 'botellas' ? 'bottle' : latestVersionSnapshot.batchYieldUnit)}
                </span>
              </div>
              <div className="text-slate-400 text-xxs mt-1">Cost per yield unit division</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-indigo-150 shadow-xs bg-indigo-50/10">
              <div className="text-indigo-600 text-xs font-bold uppercase tracking-wider">Fluid Ounce Cost (30ml)</div>
              <div className="text-2xl font-black text-indigo-900 mt-2 font-mono">
                {isEditing ? (
                  editYieldValue > 0 && ['ml', 'l', 'fl_oz'].includes(editYieldUnit) ? (
                    formatCurrency((draftTotalCost / (editYieldUnit === 'l' ? editYieldValue * 1000 : editYieldUnit === 'fl_oz' ? editYieldValue * 29.57 : editYieldValue)) * 29.57)
                  ) : (
                    'N/A'
                  )
                ) : (
                  ['ml', 'l', 'fl_oz'].includes(latestVersionSnapshot.batchYieldUnit) ? (
                    formatCurrency(activeCostPerUnit * (latestVersionSnapshot.batchYieldUnit === 'l' ? 0.02957 : latestVersionSnapshot.batchYieldUnit === 'fl_oz' ? 1.0 : 29.57))
                  ) : (
                    'N/A'
                  )
                )}
              </div>
              <div className="text-indigo-500 text-xxs mt-1">Standard metric for liquid items</div>
            </div>
          </div>

          {/* Interactive Pricing Simulator & Margin Estimator (Only for Finished Cocktails / Beverages) */}
          {!isEditing && recipe.type === 'bebida' && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4 bg-linear-to-r from-indigo-50/10 to-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span>Interactive Pricing Simulator & Margin Estimator</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Simulate retail menu prices to instantly calculate guest food cost percentages and profit margins based on recipe cost per serving.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Standard Price:</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono">
                    {recipe.retailPrice ? formatCurrency(recipe.retailPrice) : 'Not configured'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
                {/* Simulator Slider Box */}
                <div className="lg:col-span-2 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100 pb-4 lg:pb-0 lg:pr-6">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-slate-550">Simulated Retail Price (Type to Edit):</span>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs font-bold text-indigo-400 font-mono">$</span>
                      <input
                        type="number"
                        id="price-simulator-input"
                        min="0"
                        step="0.01"
                        value={simulatedPrice === 0 ? "" : simulatedPrice}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setSimulatedPrice(isNaN(val) ? 0 : val);
                        }}
                        className="w-28 pl-7 pr-3 py-1.5 text-right text-sm font-black text-indigo-750 font-mono bg-indigo-50 hover:bg-indigo-100/50 focus:bg-white rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xxs font-mono text-slate-400 font-bold">{formatCurrency(Math.max(1, Math.round(activeServingCost)))}</span>
                    <input
                      type="range"
                      min={Math.max(1, Number((activeServingCost).toFixed(2)))}
                      max={Math.max(12, Number((activeServingCost * 12).toFixed(2)))}
                      step={dynamicStep}
                      value={simulatedPrice || Math.max(1, activeServingCost * 4)}
                      onChange={(e) => setSimulatedPrice(Number(e.target.value) || 1)}
                      className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650 border border-slate-200/40"
                    />
                    <span className="text-xxs font-mono text-slate-400 font-bold">{formatCurrency(Math.max(25, Math.round(activeServingCost * 10)))}</span>
                  </div>

                  {/* Preset quick target triggers */}
                  <div className="space-y-1.5">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quick F&B Cost Targets:</div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setSimulatedPrice(Number((activeServingCost / 0.18).toFixed(2)))}
                        className="text-[10px] font-extrabold px-2.5 py-1 rounded bg-slate-50 hover:bg-slate-100 text-indigo-600 border border-slate-150 transition cursor-pointer"
                        title="Establishment target of 18% cost ratio (5.5x markup multiplier)"
                      >
                        18% Cost (5.5x)
                      </button>
                      <button
                        onClick={() => setSimulatedPrice(Number((activeServingCost / 0.22).toFixed(2)))}
                        className="text-[10px] font-extrabold px-2.5 py-1 rounded bg-slate-50 hover:bg-slate-100 text-indigo-600 border border-slate-150 transition cursor-pointer"
                        title="Establishment target of 22% cost ratio (4.5x markup multiplier)"
                      >
                        22% Cost (4.5x)
                      </button>
                      <button
                        onClick={() => setSimulatedPrice(Number((activeServingCost / 0.25).toFixed(2)))}
                        className="text-[10px] font-extrabold px-2.5 py-1 rounded bg-indigo-50/50 hover:bg-indigo-100/50 text-indigo-600 border border-indigo-150 transition cursor-pointer font-bold"
                        title="Traditional bar rule of thumb: 25% cost ratio (4.0x markup multiplier)"
                      >
                        25% Cost (4.0x)
                      </button>
                      <button
                        onClick={() => setSimulatedPrice(Number((activeServingCost / 0.33).toFixed(2)))}
                        className="text-[10px] font-extrabold px-2.5 py-1 rounded bg-slate-50 hover:bg-slate-100 text-indigo-600 border border-slate-150 transition cursor-pointer"
                        title="Maximum threshold: 33% cost ratio (3.0x markup multiplier)"
                      >
                        33% Cost (3.0x)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Columns */}
                <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">F&B Beverage Cost %</span>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <span className={`text-lg font-black font-mono leading-none ${
                        simulatedPrice > 0 && (activeServingCost / simulatedPrice) * 100 <= 20 
                          ? 'text-emerald-600' 
                          : simulatedPrice > 0 && (activeServingCost / simulatedPrice) * 100 <= 28 
                          ? 'text-amber-500' 
                          : 'text-rose-500'
                      }`}>
                        {simulatedPrice > 0 ? ((activeServingCost / simulatedPrice) * 100).toFixed(1) : '100.0'}%
                      </span>
                    </div>
                    <span className="text-[8px] text-slate-400 block font-semibold">Lower is more profitable</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Gross Profit (Value)</span>
                    <div className="flex items-center justify-center mt-1">
                      <span className="text-lg font-black text-emerald-600 font-mono leading-none">
                        {formatCurrency(Math.max(0, simulatedPrice - activeServingCost))}
                      </span>
                    </div>
                    <span className="text-[8px] text-slate-400 block font-semibold">Net profit per serving</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-center col-span-2 md:col-span-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Gross Margin %</span>
                    <div className="flex items-center justify-center mt-1">
                      <span className="text-lg font-black text-indigo-650 font-mono leading-none">
                        {simulatedPrice > 0 ? (((simulatedPrice - activeServingCost) / simulatedPrice) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                    <span className="text-[8px] text-slate-400 block font-mono">
                      {simulatedPrice > 0 && activeServingCost > 0 ? (simulatedPrice / activeServingCost).toFixed(1) : '0'}x markup
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick persistent update */}
              <div className="bg-indigo-50/30 border border-indigo-100/50 p-3 rounded-2xl flex items-center justify-between text-xs gap-3 flex-wrap">
                <p className="text-indigo-900 font-medium">
                  Would you like to establish the simulated price of <strong>{formatCurrency(simulatedPrice)}</strong> as your active standard sales price?
                </p>
                <button
                  onClick={() => handleQuickSaveRetailPrice(simulatedPrice)}
                  disabled={isReadOnly}
                  className={`px-4.5 py-1.5 font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer ${
                    isReadOnly 
                      ? 'bg-slate-105 text-slate-400 cursor-not-allowed border border-slate-200' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <Save className="h-3 w-3" />
                  Apply & Save Price
                </button>
              </div>
            </div>
          )}

          {/* Interactive Costing Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <span>Ingredients & Sub-recipes in Mix</span>
              </h3>

              {isEditing && (
                <button
                  onClick={handleAddIngredientRow}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold text-xs rounded-lg transition border border-indigo-100 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Ingredient or Sub-recipe
                </button>
              )}
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-bold text-xxs tracking-wider uppercase border-b border-slate-100">
                    <th className="px-4 py-3">Ingredient / Sub-Recipe</th>
                    <th className="px-4 py-3">Source / Catalog Cost</th>
                    <th className="px-4 py-3">Recipe Dosage</th>
                    <th className="px-4 py-3 text-right">Proportional Cost</th>
                    {isEditing && <th className="px-4 py-3 w-16 text-center"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {(isEditing ? editIngredients : latestVersionSnapshot.ingredients).length === 0 ? (
                    <tr>
                      <td colSpan={isEditing ? 5 : 4} className="px-4 py-10 text-center text-slate-400">
                        No recipe items mapped yet. Click "Modify Recipe & Costings" to begin.
                      </td>
                    </tr>
                  ) : (
                    (isEditing ? editIngredients : latestVersionSnapshot.ingredients).map((row, idx) => {
                      const { name, category, baseLabel, isSub } = getIngredientRowInfo(row);
                      
                      // Calculate the proportional cost for just this single ingredient row
                      const rowCost = calculateVersionCostWithSubrecipes([row], recipes, masterIngredients);

                      return (
                        <tr key={row.id || idx} className="hover:bg-slate-50/45 transition">
                          <td className="px-4 py-3.5">
                            {isEditing ? (
                              <select
                                value={row.ingredientId}
                                onChange={(e) => handleUpdateRow(row.id, { ingredientId: e.target.value })}
                                className="w-full max-w-[280px] px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-semibold"
                              >
                                {selectorChoices.map((choice) => (
                                  <option key={choice.id} value={choice.id}>
                                    {choice.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div>
                                <span className="font-bold text-slate-700 text-sm block flex items-center gap-1.5">
                                  {isSub && <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
                                  {name}
                                </span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                  isSub ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {category === 'Sub-receta' ? 'Sub-Recipe' : category}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 font-semibold text-slate-500">
                            <span className="font-mono">{baseLabel}</span>
                          </td>

                          <td className="px-4 py-3.5">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 max-w-[160px]">
                                <input
                                  type="number"
                                  min="0.001"
                                  step="any"
                                  value={row.quantity}
                                  onChange={(e) => handleUpdateRow(row.id, { quantity: Number(e.target.value) || 0 })}
                                  className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-mono"
                                  placeholder="Qty."
                                />
                                <select
                                  value={row.unit}
                                  onChange={(e) => handleUpdateRow(row.id, { unit: e.target.value as MeasurementUnit })}
                                  className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
                                >
                                  <option value="ml">ml</option>
                                  <option value="fl_oz">fl oz</option>
                                  <option value="oz">oz</option>
                                  <option value="g">g</option>
                                  <option value="kg">kg</option>
                                  <option value="lb">lb</option>
                                  <option value="l">L</option>
                                  <option value="each">each</option>
                                  <option value="u">u</option>
                                </select>
                              </div>
                            ) : (
                              <span className="font-bold text-indigo-700 font-mono bg-indigo-50/60 border border-indigo-100 px-2.5 py-1 rounded-full text-xs">
                                {row.quantity} {row.unit}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <span className="font-bold text-slate-800 font-mono text-sm block">
                              {formatCurrency(rowCost)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {((rowCost / (isEditing ? draftTotalCost : activeTotalCost)) * 105 || 0).toFixed(1).replace('105', '100')}% of recipe
                            </span>
                          </td>

                          {isEditing && (
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={() => handleRemoveIngredientRow(row.id)}
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                title="Delete row"
                              >
                                <Trash className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TIMELINE AND COMPARISON SHEET --- */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Historical Timeline select */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" />
                Change History
              </h3>

              <div className="relative border-l-2 border-slate-100 pl-4 space-y-6 text-xs font-medium">
                {recipe.versions.map((ver) => {
                  const isCurrent = ver.version === recipe.currentVersion;
                  const isA = ver.version === versionToCompareA;
                  const isB = ver.version === versionToCompareB;

                  return (
                    <div key={ver.version} className="relative">
                      {/* Circle indicator */}
                      <span className={`absolute -left-[23px] top-0.5 h-3.5 w-3.5 rounded-full border-2 ${
                        isCurrent
                          ? 'bg-indigo-600 border-indigo-200'
                          : 'bg-white border-slate-300'
                      }`} />

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-705">Version {ver.version} {isCurrent && '(Current)'}</span>
                          <span className="text-xxs text-slate-400 font-mono">
                            {new Date(ver.updatedAt).toLocaleDateString('en-US')}
                          </span>
                        </div>
                        <p className="text-slate-500 leading-relaxed italic pr-2">
                          "{ver.note}"
                        </p>

                        {/* Selector switches to configure compare tool */}
                        <div className="flex items-center gap-2 pt-1.5 font-bold">
                          <button
                            onClick={() => setVersionToCompareA(ver.version)}
                            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition ${
                              isA
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Initial Var (A)
                          </button>
                          <button
                            onClick={() => setVersionToCompareB(ver.version)}
                            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition ${
                              isB
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Target Var (B)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Cols: Comparison Workspace panel */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-150 pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg">
                    Side-by-Side Version Comparison
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Analyzing cost variance from <strong>Version {versionToCompareA}</strong> to <strong>Version {versionToCompareB}</strong>.
                  </p>
                </div>
                <div className="bg-slate-100 rounded-lg p-1.5 text-xxs font-mono text-slate-500 flex items-center gap-1">
                  v{versionToCompareA} <ChevronRight className="h-3 w-3 shrink-0" /> v{versionToCompareB}
                </div>
              </div>

              {comparedVersionsData ? (
                <div className="space-y-6">
                  {/* Aggregate differences cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="text-slate-400 text-xxs font-bold uppercase tracking-wider">Batch Cost Difference</div>
                      <div className="flex items-center justify-between mt-1 border-t border-slate-100 pt-1">
                        <div className="font-mono text-xs space-y-0.5">
                          <span className="block text-slate-550">v{versionToCompareA}: {formatCurrency(comparedVersionsData.costA)}</span>
                          <span className="block text-slate-955 font-bold">v{versionToCompareB}: {formatCurrency(comparedVersionsData.costB)}</span>
                        </div>

                        {comparedVersionsData.costB - comparedVersionsData.costA > 0 ? (
                          <div className="text-right text-rose-500 flex items-center gap-0.5 font-bold text-xs" title="Increase in batch cost">
                            <TrendingUp className="h-4 w-4" />
                            +{(((comparedVersionsData.costB - comparedVersionsData.costA) / comparedVersionsData.costA) * 100 || 0).toFixed(1)}%
                          </div>
                        ) : comparedVersionsData.costB - comparedVersionsData.costA < 0 ? (
                          <div className="text-right text-emerald-600 flex items-center gap-0.5 font-bold text-xs" title="Decrease in batch cost">
                            <TrendingDown className="h-4 w-4" />
                            {(((comparedVersionsData.costB - comparedVersionsData.costA) / comparedVersionsData.costA) * 100 || 0).toFixed(1)}%
                          </div>
                        ) : (
                          <div className="text-right text-slate-400 text-xs">No change</div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="text-slate-400 text-xxs font-bold uppercase tracking-wider">Unit Cost Difference</div>
                      <div className="flex items-center justify-between mt-1 font-mono text-xs border-t border-slate-100 pt-1">
                        <div>
                          {comparedVersionsData.vAObj.batchYieldValue > 0 && comparedVersionsData.vBObj.batchYieldValue > 0 ? (
                            <div className="space-y-0.5">
                              <span className="block text-slate-550">
                                v{versionToCompareA}: {formatCurrency(comparedVersionsData.costA / comparedVersionsData.vAObj.batchYieldValue)} / {comparedVersionsData.vAObj.batchYieldUnit}
                              </span>
                              <span className="block text-slate-950 font-semibold text-indigo-700">
                                v{versionToCompareB}: {formatCurrency(comparedVersionsData.costB / comparedVersionsData.vBObj.batchYieldValue)} / {comparedVersionsData.vBObj.batchYieldUnit}
                              </span>
                            </div>
                          ) : (
                            <span className="text-rose-500 font-semibold">Invalid yields</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Compared detailed Ingredients table */}
                  <div className="border border-slate-150 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs bg-white">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-xxs">
                          <th className="px-3 py-2.5">Ingredient Used</th>
                          <th className="px-3 py-2.5">Initial Version ({versionToCompareA})</th>
                          <th className="px-3 py-2.5">Compared Version ({versionToCompareB})</th>
                          <th className="px-3 py-2.5 text-right font-bold text-slate-600">Cost Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comparedVersionsData.rows.map((row) => {
                          const quantityDiff = row.qtyB - row.qtyA;
                          const costDiff = row.costB - row.costA;

                          return (
                            <tr key={row.ingId} className="hover:bg-slate-50/50">
                              <td className="px-3 py-3">
                                <div className="font-bold text-slate-700 text-xs flex items-center gap-1">
                                  {row.isSubRecipe && <Sparkles className="h-3 w-3 text-amber-500" />}
                                  {row.name}
                                </div>
                                <div className="text-[10px] text-slate-400 font-semibold uppercase">{row.category === 'Sub-receta' ? 'Sub-Recipe' : row.category}</div>
                              </td>

                              <td className="px-3 py-3 font-mono">
                                {row.qtyA > 0 ? (
                                  <span>{row.qtyA} {row.unitA} <span className="block text-xxs text-slate-400">{formatCurrency(row.costA)}</span></span>
                                ) : (
                                  <span className="text-slate-400 italic">Not used</span>
                                )}
                              </td>

                              <td className="px-3 py-3 font-mono">
                                {row.qtyB > 0 ? (
                                  <span>{row.qtyB} {row.unitB} <span className="block text-xxs text-slate-400">{formatCurrency(row.costB)}</span></span>
                                ) : (
                                  <span className="text-rose-500 font-semibold uppercase text-[9px] bg-rose-50 px-1.5 py-0.5 rounded">Removed</span>
                                )}
                              </td>

                              <td className="px-3 py-3 text-right font-mono font-bold">
                                {costDiff > 0 ? (
                                  <span className="text-rose-600">+{formatCurrency(costDiff)}</span>
                                ) : costDiff < 0 ? (
                                  <span className="text-emerald-600">{formatCurrency(costDiff)}</span>
                                ) : (
                                  <span className="text-slate-400 font-normal">-</span>
                                )}
                                {row.qtyA > 0 && quantityDiff !== 0 && (
                                  <span className="block text-[9px] text-slate-400 font-semibold uppercase">
                                    Dose: {quantityDiff > 0 ? '+' : ''}
                                    {quantityDiff.toFixed(1)} {row.unitB || row.unitA}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">Select two valid versions to compare.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- PREMIUM PRINTABLE HOJA DE COSTO --- */}
      {activeTab === 'print' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
            <div className="flex items-start gap-2.5 animate-fadeIn">
              <Info className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
              <div className="text-xs text-indigo-900 leading-relaxed">
                <span className="font-bold">🖥️ Print Optimizer:</span> This sheet is formally designed to fit normal printing paper. Simply press <strong>"Print / Save PDF"</strong> and select the browser option <strong>"Save as PDF"</strong>.
              </div>
            </div>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer shadow-sm ml-4"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>
          </div>

          {/* Core Printable Sheet Wrapper */}
          <div
            className="p-8 sm:p-12 md:p-16 bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl mx-auto space-y-8 font-sans printable-section"
            id="print-sheet-content"
          >
            {/* Print Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
              <div className="space-y-1">
                <div className="text-xs font-black tracking-widest text-indigo-600 uppercase">Food & Beverage Cost Control Technical File</div>
                <h1 className="text-2xl font-black text-slate-950 font-sans tracking-tight">RECIPE COSTING SHEET</h1>
                <p className="text-slate-500 text-xs">Dilution profile, yield cost, and bar liquid assets costing</p>
              </div>

              <div className="text-right space-y-1">
                <div className="font-extrabold text-sm text-slate-800">Version: {recipe.currentVersion}</div>
                <div className="text-[10px] text-slate-400 font-mono">Issued: {new Date().toLocaleDateString('en-US')}</div>
                <div className="text-[10px] bg-slate-100 text-slate-655 px-2 py-0.5 rounded inline-block font-semibold">STATUS: VERIFIED</div>
              </div>
            </div>

            {/* General Meta Data */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-150 text-xs">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Drink Name</div>
                <div className="text-sm font-bold text-slate-850 mt-0.5">{recipe.name}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase text-left">Net Batch Yield</div>
                <div className="text-sm font-bold text-slate-850 mt-0.5 font-mono">
                  {latestVersionSnapshot.batchYieldValue} {latestVersionSnapshot.batchYieldUnit === 'porciones' ? 'servings' : latestVersionSnapshot.batchYieldUnit}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Batch Cost</div>
                <div className="text-sm font-bold text-emerald-750 mt-0.5 font-mono">{formatCurrency(activeTotalCost)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Unit Yield Cost</div>
                <div className="text-sm font-bold text-indigo-750 mt-0.5 font-mono">
                  {formatCurrency(activeCostPerUnit)} / {latestVersionSnapshot.batchYieldUnit === 'porciones' ? 'serving' : latestVersionSnapshot.batchYieldUnit}
                </div>
              </div>
            </div>

            {recipe.type === 'bebida' && recipe.retailPrice ? (
              <div className="grid grid-cols-3 gap-4 p-4 bg-indigo-50/25 border border-indigo-100 rounded-xl text-xs">
                <div>
                  <div className="text-[10px] text-indigo-600 font-extrabold uppercase">Standard Retail Price</div>
                  <div className="text-sm font-black text-indigo-950 mt-0.5 font-mono">{formatCurrency(recipe.retailPrice)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-indigo-600 font-extrabold uppercase">F&B Cost % Ratio</div>
                  <div className="text-sm font-black text-emerald-750 mt-0.5 font-mono">
                    {((activeServingCost / recipe.retailPrice) * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-indigo-600 font-extrabold uppercase font-sans">Gross Profit Margin %</div>
                  <div className="text-sm font-black text-indigo-900 mt-0.5 font-mono">
                    {(((recipe.retailPrice - activeServingCost) / recipe.retailPrice) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ) : null}

            {/* Description */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Description & Custom Instructions</h4>
              <p className="text-slate-600 text-xs leading-relaxed italic border-l-2 border-indigo-500 pl-3">
                {recipe.description || 'No detailed instructions configured.'}
              </p>
            </div>

            {/* Table of Insumos */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Ingredient & Sub-Recipe Breakdown</h4>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                    <th className="px-3 py-2">Ingredient Used</th>
                    <th className="px-3 py-2">Catalog Package Price / Source</th>
                    <th className="px-3 py-2">Recipe Dosage</th>
                    <th className="px-3 py-2 text-right">Calculated Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {latestVersionSnapshot.ingredients.map((row, idx) => {
                    const { name, category, baseLabel, isSub } = getIngredientRowInfo(row);
                    const calculatedCost = calculateVersionCostWithSubrecipes([row], recipes, masterIngredients);

                    return (
                      <tr key={idx} className="bg-white">
                        <td className="px-3 py-2 text-slate-800">
                          <span className="font-bold flex items-center gap-1">
                            {isSub && <Sparkles className="h-3 w-3 text-amber-500" />}
                            {name}
                          </span>
                          <span className="block text-[9px] text-slate-400 tracking-wider font-semibold uppercase">
                            {category === 'Sub-receta' ? 'Sub-Recipe' : category}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">
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
                    <td className="px-3 py-2.5 text-right text-slate-950 font-mono text-sm">
                      {formatCurrency(activeTotalCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Verification Footer sign */}
            <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-4">
                <div className="border-b border-slate-900 mx-auto max-w-[200px] h-10"></div>
                <div>
                  <div className="font-bold text-slate-800">Bar Manager Signature</div>
                  <div className="text-[10px] text-slate-400">Beverage Costing Yield Check</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border-b border-slate-900 mx-auto max-w-[200px] h-10"></div>
                <div>
                  <div className="font-bold text-slate-800">Finance & Cost Approval</div>
                  <div className="text-[10px] text-slate-400">Target Profit Margin Validation</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- RECONCILED DYNAMIC DRINK MANUAL & OPERATION GUIDES --- */}
      {activeTab === 'guide' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 space-y-1">
            <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <FileText className="h-5.5 w-5.5 text-indigo-600" />
              Beverage Formulation & Cost Control Manual
            </h2>
            <p className="text-slate-550 text-xs leading-relaxed">
              Step-by-step technical standard operating procedures (SOP) to add, modify, delete, and control bar assets, ingredient inventories, and compound sub-recipes.
            </p>
          </div>

          <div className="space-y-6 text-xs text-slate-600 leading-relaxed text-left">
            {/* Section 1 */}
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl space-y-2.5">
              <h3 className="text-sm font-extrabold text-slate-850 flex items-center gap-1.5 uppercase tracking-wide">
                <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black font-sans text-xs shrink-0">1</span>
                Managing the Ingredients Catalog
              </h3>
              <p>
                The <strong>Ingredient Catalog</strong> houses raw materials (e.g. spirits, purées, liqueurs, citrus, sugars) with their container pricing. Cost conversions are computed down to individual cubic milliliters (ml) or grams (g).
              </p>
              <div className="pl-4 border-l-2 border-indigo-500 space-y-2 font-medium">
                <p>
                  <strong className="text-slate-800">➕ Add New Ingredients:</strong> Navigate to the <strong>Ingredient Catalog</strong> view from the sidebar. Click on the <strong>"Create New Ingredient"</strong> button. Enter the commercial name, supplier purchase price, container dosage volume/weight (e.g., a bottle of standard gin is <code className="font-mono bg-slate-100 px-1 rounded">750 ml</code> at <code className="font-mono bg-indigo-50 px-1 rounded text-indigo-600">$18,000 COP</code>), and group category.
                </p>
                <p>
                  <strong className="text-slate-800">✏️ Modify Existing Items:</strong> Click on any row inside the ingredient catalog to toggle its editor. You can update price variations, product links, and relative densities. Hit **Save** to apply globally.
                </p>
                <p>
                  <strong className="text-slate-800">❌ Remove Ingredients:</strong> Click the <strong>Trash (Delete)</strong> button at the end of the item row. Any deleted ingredient will notify active formulas that use it, keeping you protected from broken links!
                </p>
              </div>
            </div>

            {/* Section 2 */}
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl space-y-2.5">
              <h3 className="text-sm font-extrabold text-slate-850 flex items-center gap-1.5 uppercase tracking-wide">
                <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black font-sans text-xs shrink-0">2</span>
                Building & Linking Recipes
              </h3>
              <p>
                Recipes are designated as either a <strong>Final Drink</strong> (served directly to guests) or a <strong>⭐ Base Sub-Recipe</strong> (batched syrups, infusions, cordial pre-mixes, or citrus blends used to charge other main cocktails).
              </p>
              <div className="pl-4 border-l-2 border-indigo-500 space-y-2 font-medium">
                <p>
                  <strong className="text-slate-800">⭐ Using Sub-Recipes as Ingredients:</strong> When formulating a final cocktail, you don't need to rebuild syrups. You can select your prepared <strong>[Sub-Recipe]</strong> directly from the standard ingredient dropdown. The cost matrix dynamically resolves nested costs in real-time!
                </p>
                <p>
                  <strong className="text-slate-800">✏️ Editing Recipe Formulas & Dosages:</strong> Open the target recipe, click <strong>"Modify Recipe & Costings"</strong>, and click <strong>"Add Ingredient or Sub-recipe"</strong>. Match the exact volume or countable unit (e.g. <code className="font-mono">45 ml</code> Gin, or <code className="font-mono font-bold text-amber-600">⭐ 20 ml Citrus batch Syrup</code>).
                </p>
                <p>
                  <strong className="text-slate-800">📦 Yield Configuration:</strong> Crucially determine the final <strong>"Net Yield"</strong> of your formulation (e.g. if the batch yields <code className="font-mono bg-slate-100 px-1 rounded">500 ml</code> of syrup, set Batch Yield to <code className="font-mono">500</code> and unit to <code className="font-mono">ml</code>). This divides overall costs down to unit milliliters perfectly.
                </p>
                <p>
                  <strong className="text-slate-800">💾 Version Safe snapshots:</strong> Every time you modify ingredients, clicking <strong>"Save Changes"</strong> prompts a version change-log comment. This secures historical snapshots, letting you compare cost improvements!
                </p>
              </div>
            </div>

            {/* Section 3 */}
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl space-y-2.5">
              <h3 className="text-sm font-extrabold text-slate-850 flex items-center gap-1.5 uppercase tracking-wide">
                <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black font-sans text-xs shrink-0">3</span>
                Understanding Retail Prices & Profit Margins
              </h3>
              <p>
                 For finished cocktails, the interactive Pricing Tool calculates optimal sales targets automatically, matching traditional high-end bar standards.
              </p>
              <div className="pl-4 border-l-2 border-indigo-500 space-y-2 font-medium">
                <p>
                  <strong className="text-slate-800">⚖️ F&B Cost Ratio (%):</strong> Refers to the cost of liquid ingredients spent vs sales price. Target ratios for profitability should hover between <span className="text-emerald-700 font-bold">18% and 25%</span>.
                </p>
                <p>
                  <strong className="text-slate-800">🎛️ Simulation Slider:</strong> Move the interactive range slider to see immediate shifts in profitability and food cost percentages. Utilize target preset buttons (e.g., hitting <strong>"22% Cost"</strong> sets the ideal retail price mathematically). Click <strong>"Set as Active Price"</strong> to persist to memory.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SAVE VERSION MODAL PROT --- */}
      {showSaveVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 animate-fadeIn" id="version-save-modal">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <History className="h-5 w-5" />
              <h4 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase font-sans">Confirm New Version</h4>
            </div>

            <p className="text-slate-550 text-xs leading-relaxed">
              You are about to save <strong>Version {recipe.currentVersion + 1}</strong>. Write a short comment describing the changes made to keep a clear history of costing adjustments.
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block text-left">Change Note / Comment</label>
              <input
                type="text"
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
                placeholder="e.g., Simple Syrup cost adjustment or updated lime juice ratio"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowSaveVersionModal(false)}
                className="px-4 py-1.5 border border-slate-250 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleSaveConfirmed}
                className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer"
              >
                Save Version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
