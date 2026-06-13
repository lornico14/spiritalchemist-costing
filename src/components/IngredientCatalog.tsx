/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { MasterIngredient, MeasurementUnit, User, Tenant } from "../types";
import { formatCurrency } from "../utils/conversions";
import {
  Plus,
  Search,
  Edit2,
  Check,
  X,
  Tag,
  Beaker,
  Archive,
  AlertCircle,
  Save,
  Grid,
  Table2,
  Building,
  ExternalLink,
} from "lucide-react";

interface IngredientCatalogProps {
  ingredients: MasterIngredient[];
  onUpdateIngredients: (updated: MasterIngredient[]) => void;
  currentUser: User | null;
  tenants: Tenant[];
  onRestoreDemoData?: () => void;
}

export default function IngredientCatalog({
  ingredients,
  onUpdateIngredients,
  currentUser,
  tenants,
  onRestoreDemoData,
}: IngredientCatalogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTenantFilter, setSelectedTenantFilter] =
    useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Selection states for bulk action
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [ingredientsToBulkDelete, setIngredientsToBulkDelete] = useState<
    MasterIngredient[] | null
  >(null);

  // Bulk Edit / Spreadsheet Mode state
  const [isBulkEdit, setIsBulkEdit] = useState(false);
  const [bulkIngredients, setBulkIngredients] = useState<MasterIngredient[]>(
    [],
  );

  // Individual Edit Form State
  const [editForm, setEditForm] = useState<Partial<MasterIngredient>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [ingredientToDelete, setIngredientToDelete] =
    useState<MasterIngredient | null>(null);

  // Initialize bulk state when entering bulk edit mode
  useEffect(() => {
    if (isBulkEdit) {
      setBulkIngredients(JSON.parse(JSON.stringify(ingredients)));
    }
  }, [isBulkEdit, ingredients]);

  const categories = [
    "all",
    ...Array.from(
      new Set(ingredients.map((i) => i.category || "Others").filter(Boolean)),
    ),
  ];

  // Under client login, they only see ingredients where tenantId is theirs or 'global'
  const visibleIngredients = ingredients.filter((ing) => {
    if (!currentUser) return true;
    if (currentUser.role === "client") {
      return ing.tenantId === currentUser.tenantId || ing.tenantId === "global";
    }
    // Superadmin has filter option
    if (selectedTenantFilter !== "all") {
      return ing.tenantId === selectedTenantFilter;
    }
    return true;
  });

  const filteredIngredients = visibleIngredients.filter((ing) => {
    const matchesSearch =
      ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ing.category || "others")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" ||
      (ing.category || "Others") === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getTenantName = (tId: string) => {
    if (tId === "global") return "Global";
    const match = tenants.find((t) => t.id === tId);
    return match ? match.name : tId;
  };

  const handleStartEdit = (ing: MasterIngredient) => {
    setEditingId(ing.id);
    setEditForm({ ...ing });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.name || !editForm.baseCost || !editForm.baseQuantity) {
      alert("Please fill out the name, pack cost, and pack quantity.");
      return;
    }

    const updated = ingredients.map((ing) => {
      if (ing.id === id) {
        return {
          ...ing,
          name: editForm.name || ing.name,
          baseCost: Number(editForm.baseCost) || ing.baseCost,
          baseQuantity: Number(editForm.baseQuantity) || ing.baseQuantity,
          baseUnit: (editForm.baseUnit as MeasurementUnit) || ing.baseUnit,
          density: Number(editForm.density) || ing.density || 1.0,
          category: editForm.category || ing.category || "Others",
          sku: editForm.sku || "",
          productUrl: editForm.productUrl || "",
          tenantId: editForm.tenantId || ing.tenantId || "global",
        } as MasterIngredient;
      }
      return ing;
    });

    onUpdateIngredients(updated);
    setEditingId(null);
    setEditForm({});
  };

  const handleAddIngredient = () => {
    if (
      !editForm.name ||
      editForm.baseCost === undefined ||
      !editForm.baseQuantity ||
      !editForm.baseUnit
    ) {
      alert(
        "Please fill out all required fields (Name, Cost, Quantity, and Base Unit).",
      );
      return;
    }

    const tenantId =
      currentUser?.role === "client"
        ? currentUser.tenantId
        : editForm.tenantId || "global";

    const newIng: MasterIngredient = {
      id: `ing-${Date.now()}`,
      name: editForm.name,
      baseCost: Number(editForm.baseCost) || 0,
      baseQuantity: Number(editForm.baseQuantity) || 1,
      baseUnit: (editForm.baseUnit as MeasurementUnit) || "g",
      density: Number(editForm.density) || 1.0,
      category: editForm.category || "Others",
      tenantId: tenantId,
      sku: editForm.sku || "",
      productUrl: editForm.productUrl || "",
    };

    onUpdateIngredients([...ingredients, newIng]);
    setIsAdding(false);
    setEditForm({});
  };

  const handleDeleteIngredient = (id: string, ing: MasterIngredient) => {
    // Check permissions
    if (currentUser?.role === "client" && ing.tenantId === "global") {
      alert(
        "You do not have permission to delete corporate global ingredients.",
      );
      return;
    }

    setIngredientToDelete(ing);
  };

  const confirmDeleteIngredient = () => {
    if (ingredientToDelete) {
      const updated = ingredients.filter(
        (item) => item.id !== ingredientToDelete.id,
      );
      onUpdateIngredients(updated);
      setIngredientToDelete(null);
    }
  };

  // Bulk Edit handlers
  const handleBulkChange = (
    id: string,
    field: keyof MasterIngredient,
    value: any,
  ) => {
    setBulkIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === id) {
          return { ...ing, [field]: value };
        }
        return ing;
      }),
    );
  };

  const handleSaveBulk = () => {
    // Validate bulk entries
    for (const b of bulkIngredients) {
      if (!b.name || b.baseCost < 0 || b.baseQuantity < 0) {
        alert(
          `Check details of ${b.name || "unnamed ingredient"}. Name is required and numeric values cannot be negative.`,
        );
        return;
      }
    }

    // Merge bulk modifications back to the original array
    const updated = ingredients.map((ing) => {
      // Find modified entry
      const match = bulkIngredients.find((b) => b.id === ing.id);
      if (match) {
        // Enforce permissions: Clients cannot update global ingredients in bulk
        if (currentUser?.role === "client" && ing.tenantId === "global") {
          return ing; // keep original
        }
        return match;
      }
      return ing;
    });

    onUpdateIngredients(updated);
    setIsBulkEdit(false);
  };

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6"
      id="ingredient-catalog-root"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-800 flex items-center gap-2">
            <Archive className="h-5 w-5 text-indigo-500" />
            Unified Ingredient Catalog
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage commercial base packages, densities, and pricing for the
            entire bar operation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Spreadsheet Mode */}
          <button
            onClick={() => setIsBulkEdit(!isBulkEdit)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-medium text-xs transition cursor-pointer ${
              isBulkEdit
                ? "bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-150"
                : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
            id="btn-toggle-bulk-mode"
          >
            {isBulkEdit ? (
              <>
                <Grid className="h-4 w-4" />
                Exit Bulk Mode
              </>
            ) : (
              <>
                <Table2 className="h-4 w-4" />
                Bulk Spreadsheet Mode
              </>
            )}
          </button>

          {!isAdding && !isBulkEdit && (
            <button
              onClick={() => {
                setIsAdding(true);
                setEditForm({
                  name: "",
                  baseCost: 0,
                  baseQuantity: 1,
                  baseUnit: "g",
                  density: 1.0,
                  category: "Others",
                  tenantId:
                    currentUser?.role === "client"
                      ? currentUser.tenantId
                      : "global",
                });
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl transition shadow-sm cursor-pointer"
              id="btn-add-ingredient-toggle"
            >
              <Plus className="h-4 w-4" />
              New Ingredient
            </button>
          )}
        </div>
      </div>

      {ingredients.length === 0 &&
        currentUser?.role === "superadmin" &&
        onRestoreDemoData && (
          <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="font-extrabold text-amber-900 text-sm">
                Would you like to restore the demo database?
              </h4>
              <p className="text-amber-750 text-xs">
                The catalog is currently empty. Click the button to load
                the sample ingredients and recipes from Spirit Alchemist.
              </p>
            </div>
            <button
              onClick={onRestoreDemoData}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs rounded-xl shadow-sm transition shrink-0 cursor-pointer"
            >
              Restore Demo Content
            </button>
          </div>
        )}

      {/* Adding Module */}
      {isAdding && !isBulkEdit && (
        <div
          className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-4 animate-fadeIn"
          id="new-ingredient-form"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-xs text-indigo-900 tracking-wider uppercase">
              Register New Commercial Ingredient
            </h3>
            <button
              onClick={() => setIsAdding(false)}
              className="p-1 hover:bg-slate-250 rounded text-slate-400 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Commercial Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Cane Sugar, Absolut Vodka"
                value={editForm.name || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Category
              </label>
              <input
                type="text"
                placeholder="e.g., Syrups, Spirits, Fruits"
                value={editForm.category || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, category: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Product SKU (e.g. LIQ-ABS-750)
              </label>
              <input
                type="text"
                placeholder="e.g., SKU-12345"
                value={editForm.sku || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, sku: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Product URL / Link
              </label>
              <input
                type="url"
                placeholder="e.g., https://example.com/product"
                value={editForm.productUrl || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, productUrl: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Commercial Pack Cost ($ USD){" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="e.g., 18.00"
                value={editForm.baseCost || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, baseCost: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Commercial Pack Size Quantity{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.001"
                step="any"
                placeholder="e.g., 2.2 for 2.2lb"
                value={editForm.baseQuantity || ""}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    baseQuantity: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Commercial Pack Unit <span className="text-red-500">*</span>
              </label>
              <select
                value={editForm.baseUnit || "g"}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    baseUnit: e.target.value as MeasurementUnit,
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <optgroup label="Weight Units">
                  <option value="g">Grams (g)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="lb">Pounds (lb)</option>
                  <option value="oz">Ounces (oz)</option>
                </optgroup>
                <optgroup label="Volume Units">
                  <option value="ml">Milliliters (ml)</option>
                  <option value="l">Liters (L)</option>
                  <option value="fl_oz">Fluid Ounces (fl oz)</option>
                </optgroup>
                <optgroup label="Countable Units">
                  <option value="each">Each (u / each)</option>
                  <option value="u">Unidad (u)</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                Density (g/ml)
                <Beaker className="h-3.5 w-3.5 text-slate-400" />
              </label>
              <input
                type="number"
                min="0.1"
                step="0.01"
                placeholder="Default 1.0 (Water)"
                value={editForm.density || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, density: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {currentUser?.role === "superadmin" && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-slate-400" />
                  Establishment Owner Assignment
                </label>
                <select
                  value={editForm.tenantId || "global"}
                  onChange={(e) =>
                    setEditForm({ ...editForm, tenantId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="global">Global (Corporate/Shared)</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-200/60">
            <button
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border border-slate-250 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleAddIngredient}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow-sm cursor-pointer"
            >
              Save to Catalog
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by commercial package name or ingredient category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tenant filter (Superadmin only) */}
          {currentUser?.role === "superadmin" && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">
                Establishment:
              </span>
              <select
                value={selectedTenantFilter}
                onChange={(e) => setSelectedTenantFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Establishments</option>
                <option value="global">Global / Corporate Only</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"
                }`}
              >
                {cat === "all" ? "All Categories" : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-extrabold text-indigo-900 text-sm">
              Bulk Actions Available
            </h4>
            <p className="text-indigo-700 text-xs">
              You have selected {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "ingredient" : "ingredients"}. You can delete or move them to another establishment.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 items-center justify-center">
            {currentUser?.role === 'superadmin' && (
              <div className="flex items-center gap-1.5 border border-indigo-200 bg-white px-3 py-1.5 rounded-xl shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Change Venue:</span>
                <select
                  id="bulk-move-tenant-select"
                  className="text-xs bg-transparent border-0 font-semibold text-slate-700 focus:ring-0 focus:outline-none cursor-pointer"
                  defaultValue=""
                  onChange={(e) => {
                    const destTenantId = e.target.value;
                    if (!destTenantId) return;

                    const count = selectedIds.size;
                    if (!window.confirm(`Are you sure you want to move the ${count} selected ingredients to ${destTenantId === 'global' ? 'Global' : getTenantName(destTenantId)}?`)) {
                      e.target.value = '';
                      return;
                    }

                    const updated = ingredients.map((ing) => {
                      if (selectedIds.has(ing.id)) {
                        return {
                          ...ing,
                          tenantId: destTenantId,
                        };
                      }
                      return ing;
                    });

                    onUpdateIngredients(updated);
                    setSelectedIds(new Set());
                    e.target.value = '';
                  }}
                >
                  <option value="" disabled>Select Venue...</option>
                  <option value="global">Global (Corporate/Shared)</option>
                  {tenants.map((t) => (
                    t.id !== 'global' && (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    )
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-705 font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              onClick={() => {
                const selectedIngredients = ingredients.filter((i) =>
                  selectedIds.has(i.id),
                );
                const holdsGlobal = selectedIngredients.some(
                  (i) =>
                    i.tenantId === "global" && currentUser?.role === "client",
                );
                if (holdsGlobal) {
                  alert(
                    "Selection contains corporate global ingredients. Clients are not allowed to delete global ingredients.",
                  );
                  return;
                }
                setIngredientsToBulkDelete(selectedIngredients);
              }}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
            >
              Delete Selected ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Bulk spreadsheet edit or standard grid */}
      {isBulkEdit ? (
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 text-amber-800 border border-amber-250/50 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>Bulk Spreadsheet Mode Active:</strong> You can edit all
              base quantities and pack costs from this spreadsheet view. Global
              corporate ingredients remain locked for clients and can only be
              modified by a Superadmin.
            </span>
          </div>

          <div className="overflow-x-auto border border-amber-150 rounded-2xl shadow-sm">
            <table className="w-full min-w-[800px] text-left border-collapse bg-white">
              <thead>
                <tr className="bg-amber-50/50 text-slate-600 text-xs font-semibold border-b border-amber-100">
                  <th className="px-4 py-3">Commercial Name</th>
                  <th className="px-3 py-3">SKU</th>
                  <th className="px-3 py-3">Product Link</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Pack Cost ($ USD)</th>
                  <th className="px-3 py-3">Pack Pack Size</th>
                  <th className="px-3 py-3">Base Unit</th>
                  <th className="px-3 py-3">Density (g/mL)</th>
                  <th className="px-3 py-3">Owner / Establishment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 text-sm">
                {bulkIngredients
                  .filter((ing) => {
                    const matchesSearch =
                      ing.name
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                      (ing.category || "others")
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase());
                    const matchesCategory =
                      selectedCategory === "all" ||
                      (ing.category || "Others") === selectedCategory;
                    const matchesTenant =
                      currentUser?.role === "client"
                        ? ing.tenantId === currentUser?.tenantId ||
                          ing.tenantId === "global"
                        : selectedTenantFilter === "all" ||
                          ing.tenantId === selectedTenantFilter;
                    return matchesSearch && matchesCategory && matchesTenant;
                  })
                  .map((bIng) => {
                    const isReadonly =
                      currentUser?.role === "client" &&
                      bIng.tenantId === "global";

                    return (
                      <tr
                        key={bIng.id}
                        className={`hover:bg-amber-50/10 transition-colors ${isReadonly ? "bg-slate-50/60" : ""}`}
                      >
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={bIng.name}
                            disabled={isReadonly}
                            onChange={(e) =>
                              handleBulkChange(bIng.id, "name", e.target.value)
                            }
                            className={`w-full px-2 py-1 border rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                              isReadonly
                                ? "bg-slate-100 text-slate-400 border-slate-200"
                                : "border-slate-200 bg-white"
                            }`}
                          />
                        </td>

                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={bIng.sku || ""}
                            placeholder="No SKU"
                            disabled={isReadonly}
                            onChange={(e) =>
                              handleBulkChange(bIng.id, "sku", e.target.value)
                            }
                            className={`w-28 px-2 py-1 border rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                              isReadonly
                                ? "bg-slate-100 text-slate-400 border-slate-200"
                                : "border-slate-200 bg-white"
                            }`}
                          />
                        </td>

                        <td className="px-3 py-2">
                          <input
                            type="url"
                            value={bIng.productUrl || ""}
                            placeholder="https://..."
                            disabled={isReadonly}
                            onChange={(e) =>
                              handleBulkChange(
                                bIng.id,
                                "productUrl",
                                e.target.value,
                              )
                            }
                            className={`w-40 px-2 py-1 border rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                              isReadonly
                                ? "bg-slate-100 text-slate-400 border-slate-200"
                                : "border-slate-200 bg-white"
                            }`}
                          />
                        </td>

                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={bIng.category || ""}
                            disabled={isReadonly}
                            onChange={(e) =>
                              handleBulkChange(
                                bIng.id,
                                "category",
                                e.target.value,
                              )
                            }
                            className={`w-28 px-2 py-1 border rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                              isReadonly
                                ? "bg-slate-100 text-slate-400 border-slate-200"
                                : "border-slate-200 bg-white"
                            }`}
                          />
                        </td>

                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={bIng.baseCost}
                            disabled={isReadonly}
                            onChange={(e) =>
                              handleBulkChange(
                                bIng.id,
                                "baseCost",
                                Number(e.target.value),
                              )
                            }
                            className={`w-24 px-2 py-1 border rounded-lg text-xs font-mono font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                              isReadonly
                                ? "bg-slate-100 text-slate-450 border-slate-200"
                                : "border-emerald-150 text-emerald-750 bg-white"
                            }`}
                          />
                        </td>

                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={bIng.baseQuantity}
                            disabled={isReadonly}
                            onChange={(e) =>
                              handleBulkChange(
                                bIng.id,
                                "baseQuantity",
                                Number(e.target.value),
                              )
                            }
                            className={`w-20 px-2 py-1 border rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                              isReadonly
                                ? "bg-slate-100 text-slate-400 border-slate-200"
                                : "border-slate-200 bg-white"
                            }`}
                          />
                        </td>

                        <td className="px-3 py-2">
                          <select
                            value={bIng.baseUnit}
                            disabled={isReadonly}
                            onChange={(e) =>
                              handleBulkChange(
                                bIng.id,
                                "baseUnit",
                                e.target.value,
                              )
                            }
                            className={`w-20 px-1.5 py-1 border rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                              isReadonly
                                ? "bg-slate-100 text-slate-400 border-slate-200 bg-transparent"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="lb">lb</option>
                            <option value="oz">oz</option>
                            <option value="ml">ml</option>
                            <option value="l">L</option>
                            <option value="fl_oz">fl oz</option>
                            <option value="each">each</option>
                            <option value="u">u</option>
                          </select>
                        </td>

                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0.1"
                            step="0.01"
                            value={bIng.density || 1.0}
                            disabled={isReadonly}
                            onChange={(e) =>
                              handleBulkChange(
                                bIng.id,
                                "density",
                                Number(e.target.value),
                              )
                            }
                            className={`w-16 px-2 py-1 border rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                              isReadonly
                                ? "bg-slate-100 text-slate-400 border-slate-200"
                                : "border-slate-200 bg-white"
                            }`}
                          />
                        </td>

                        <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">
                          {isReadonly ? (
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-450 text-[10px]">
                              Global (Locked)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-indigo-50 font-medium text-indigo-600 text-[10px]">
                              {getTenantName(bIng.tenantId)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setIsBulkEdit(false)}
              className="px-4 py-2 border border-slate-250 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
            >
              Cancel Changes
            </button>
            <button
              onClick={handleSaveBulk}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-semibold text-xs rounded-xl shadow-sm cursor-pointer"
            >
              <Save className="h-4 w-4" />
              Save Bulk Changes
            </button>
          </div>
        </div>
      ) : (
        /* Regular Table Mode */
        <div className="overflow-x-auto border border-slate-150 rounded-2xl shadow-sm">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
                <th className="pl-5 pr-2 py-3 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredIngredients.length > 0 &&
                      filteredIngredients.every((ing) =>
                        selectedIds.has(ing.id),
                      )
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        const ids = new Set(selectedIds);
                        filteredIngredients.forEach((ing) => ids.add(ing.id));
                        setSelectedIds(ids);
                      } else {
                        const ids = new Set(selectedIds);
                        filteredIngredients.forEach((ing) =>
                          ids.delete(ing.id),
                        );
                        setSelectedIds(ids);
                      }
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                  />
                </th>
                <th className="px-4 py-3">Commercial Ingredient</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Product Link</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Base Pack Size</th>
                <th className="px-4 py-3">Pack Cost</th>
                <th className="px-4 py-3 flex items-center gap-1">
                  Density
                  <Beaker className="h-3 w-3 text-slate-400" />
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredIngredients.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-10 text-center text-slate-400 text-sm"
                  >
                    No commercial ingredients found with this search.
                  </td>
                </tr>
              ) : (
                filteredIngredients.map((ing) => {
                  const isEditing = editingId === ing.id;
                  const isReadonly =
                    currentUser?.role === "client" && ing.tenantId === "global";

                  return (
                    <tr
                      key={ing.id}
                      className={`hover:bg-slate-50/55 transition-colors ${
                        isEditing ? "bg-indigo-50/20" : ""
                      }`}
                    >
                      <td className="pl-5 pr-2 py-3.5 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(ing.id)}
                          onChange={(e) => {
                            const ids = new Set(selectedIds);
                            if (e.target.checked) {
                              ids.add(ing.id);
                            } else {
                              ids.delete(ing.id);
                            }
                            setSelectedIds(ids);
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                        />
                      </td>

                      <td className="px-4 py-3.5">
                        {isEditing ? (
                          <div className="flex flex-col gap-1 min-w-[180px]">
                            <input
                              type="text"
                              value={editForm.name || ""}
                              onChange={(e) =>
                                setEditForm({ ...editForm, name: e.target.value })
                              }
                              className="w-full px-2 py-1 border border-indigo-200 rounded-lg text-sm bg-white font-medium"
                            />
                            {currentUser?.role === 'superadmin' && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Venue:</span>
                                <select
                                  value={editForm.tenantId || "global"}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, tenantId: e.target.value })
                                  }
                                  className="text-[10px] px-1 py-0.5 border border-slate-200 rounded bg-white text-slate-700 min-w-[110px] focus:outline-none focus:ring-1 focus:ring-indigo-505 cursor-pointer"
                                >
                                  <option value="global">Global</option>
                                  {tenants.map((t) => (
                                    t.id !== 'global' && (
                                      <option key={t.id} value={t.id}>
                                        {t.name}
                                      </option>
                                    )
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-700 flex items-center gap-2">
                              {ing.name}
                              {ing.tenantId === "global" ? (
                                <span className="bg-slate-100 text-slate-550 border border-slate-200 text-[10px] px-1.5 py-0.5 rounded-full font-semibold default-badge">
                                  Global
                                </span>
                              ) : (
                                <span className="bg-indigo-50 text-indigo-650 border border-indigo-100 text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                                  <Building className="h-2 w-2" />
                                  {getTenantName(ing.tenantId)}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="SKU-12345"
                            value={editForm.sku || ""}
                            onChange={(e) =>
                              setEditForm({ ...editForm, sku: e.target.value })
                            }
                            className="w-28 px-2 py-1.5 border border-indigo-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : ing.sku ? (
                          <span className="font-mono text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                            {ing.sku}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-slate-400 italic">
                            No SKU
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isEditing ? (
                          <input
                            type="url"
                            placeholder="https://..."
                            value={editForm.productUrl || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                productUrl: e.target.value,
                              })
                            }
                            className="w-40 px-2 py-1.5 border border-indigo-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : ing.productUrl ? (
                          <a
                            href={ing.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View Link
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            No link
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.category || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                category: e.target.value,
                              })
                            }
                            className="w-32 px-2 py-1.5 border border-indigo-200 rounded-lg text-sm bg-white"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            <Tag className="h-2.5 w-2.5" />
                            {ing.category || "Others"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isEditing ? (
                          <div className="flex gap-1 items-center">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={editForm.baseQuantity || ""}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  baseQuantity: Number(e.target.value),
                                })
                              }
                              className="w-16 px-2 py-1.5 border border-indigo-200 rounded-lg text-sm bg-white"
                            />
                            <select
                              value={editForm.baseUnit || "g"}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  baseUnit: e.target.value as MeasurementUnit,
                                })
                              }
                              className="px-1 py-1.5 border border-indigo-200 rounded-lg text-xs bg-white"
                            >
                              <option value="g">g</option>
                              <option value="kg">kg</option>
                              <option value="lb">lb</option>
                              <option value="oz">oz</option>
                              <option value="ml">ml</option>
                              <option value="l">L</option>
                              <option value="fl_oz">fl oz</option>
                              <option value="each">each</option>
                              <option value="u">u</option>
                            </select>
                          </div>
                        ) : (
                          <span className="font-mono text-slate-600">
                            {ing.baseQuantity} {ing.baseUnit}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={editForm.baseCost || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                baseCost: Number(e.target.value),
                              })
                            }
                            className="w-24 px-2 py-1.5 border border-indigo-200 rounded-lg text-sm bg-white"
                          />
                        ) : (
                          <span className="font-bold text-slate-800 font-mono">
                            {formatCurrency(ing.baseCost)}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0.1"
                            step="0.01"
                            value={editForm.density || 1.0}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                density: Number(e.target.value),
                              })
                            }
                            className="w-16 px-2 py-1.5 border border-indigo-200 rounded-lg text-sm bg-white"
                          />
                        ) : (
                          <span className="font-mono text-xs text-slate-500">
                            {ing.density
                              ? `${ing.density.toFixed(2)} g/mL`
                              : "1.00 g/mL (water)"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        {isEditing ? (
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => handleSaveEdit(ing.id)}
                              className="p-1 px-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg border border-emerald-200 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                              title="Save"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1 px-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg border border-rose-200 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => {
                                if (isReadonly) {
                                  alert(
                                    "This global corporate ingredient is read-only for clients.",
                                  );
                                  return;
                                }
                                handleStartEdit(ing);
                              }}
                              disabled={isReadonly}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                isReadonly
                                  ? "text-slate-200 cursor-not-allowed"
                                  : "hover:bg-indigo-50 text-slate-550 hover:text-indigo-600"
                              }`}
                              title={isReadonly ? "Global (Read-Only)" : "Edit"}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteIngredient(ing.id, ing)
                              }
                              disabled={isReadonly}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                isReadonly
                                  ? "text-slate-200 cursor-not-allowed"
                                  : "hover:bg-rose-50 text-slate-550 hover:text-rose-600"
                              }`}
                              title={
                                isReadonly ? "Global (Read-Only)" : "Delete"
                              }
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 leading-relaxed space-y-1">
          <p className="font-semibold text-slate-700">
            💡 What is density and why is it vital?
          </p>
          <p>
            When mixing drinks, some ingredients are purchased by pack weight
            (e.g. Sugar in kilograms/pounds) but are dosed by volume
            (milliliters/fluid ounces). To compute the exact unit cost with
            scientific precision, the costing engine utilizes the ingredient's
            density (g/mL):
          </p>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li>
              Syrups and thick sweet liquids: density approx.{" "}
              <strong>1.25 to 1.33 g/mL</strong> (heavier than water).
            </li>
            <li>
              Alcohol and spirits: density approx.{" "}
              <strong>0.90 to 0.95 g/mL</strong> (lighter than water).
            </li>
            <li>
              Water or light aqueous liquids: standard density of{" "}
              <strong>1.00 g/mL</strong>.
            </li>
          </ul>
        </div>
      </div>

      {/* Custom React-Based Delete Ingredient Confirmation Modal */}
      {ingredientToDelete && (
        <div
          className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fadeIn animate-duration-150"
          id="delete-ingredient-modal"
        >
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-sm w-full space-y-5 text-left transform transition-all duration-200 scale-100">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl font-sans inline-flex">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">
                Delete Ingredient?
              </h3>
            </div>

            <p className="text-slate-500 text-xs leading-normal font-sans">
              Are you sure you want to delete the ingredient{" "}
              <strong className="text-slate-800">
                "{ingredientToDelete.name}"
              </strong>
              ? This action cannot be undone and will affect any recipes that
              contain it in their formulations.
            </p>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 font-sans">
              <button
                type="button"
                onClick={() => setIngredientToDelete(null)}
                className="px-4 py-1.5 border border-slate-250 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteIngredient}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom React-Based Bulk Delete Ingredient Confirmation Modal */}
      {ingredientsToBulkDelete && (
        <div
          className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fadeIn animate-duration-150"
          id="bulk-delete-ingredient-modal"
        >
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-md w-full space-y-5 text-left transform transition-all duration-200 scale-100">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl font-sans inline-flex">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">
                Bulk Delete Ingredients?
              </h3>
            </div>

            <p className="text-slate-500 text-xs leading-normal font-sans">
              Are you sure you want to delete{" "}
              <strong className="text-rose-700">
                {ingredientsToBulkDelete.length}
              </strong>{" "}
              selected ingredients?
            </p>

            <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-1">
              {ingredientsToBulkDelete.map((i) => (
                <div
                  key={i.id}
                  className="text-xs text-slate-600 flex items-center justify-between"
                >
                  <span className="font-medium">{i.name}</span>
                  {i.sku && (
                    <span className="font-mono text-[10px] text-slate-400">
                      ({i.sku})
                    </span>
                  )}
                </div>
              ))}
            </div>

            <p className="text-slate-500 text-xs leading-normal font-sans italic">
              This action cannot be undone and will affect any recipes that
              contain these items in their formulations.
            </p>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 font-sans">
              <button
                type="button"
                onClick={() => setIngredientsToBulkDelete(null)}
                className="px-4 py-1.5 border border-slate-250 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const idsToDelete = new Set(
                    ingredientsToBulkDelete.map((i) => i.id),
                  );
                  const updated = ingredients.filter(
                    (item) => !idsToDelete.has(item.id),
                  );
                  onUpdateIngredients(updated);
                  setSelectedIds(new Set());
                  setIngredientsToBulkDelete(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-750 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition"
              >
                Confirm Bulk Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
