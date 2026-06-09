/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { MasterIngredient, User, Tenant, MeasurementUnit } from '../types';
import { 
  formatCurrency, 
  calculateIngredientCost, 
  getIngredientUnitCosts 
} from '../utils/conversions';
import { 
  ClipboardCheck, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  ShoppingCart, 
  Printer, 
  Save, 
  Eye, 
  Clock, 
  Sparkles,
  ChevronRight,
  Database,
  Briefcase,
  Layers,
  ArrowRight,
  Calculator,
  Trash2,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface IngredientAuditWorkspaceProps {
  ingredients: MasterIngredient[];
  currentUser: User | null;
  tenants: Tenant[];
}

interface AuditRecord {
  parStock: number;
  currentStock: number;
}

interface HistoricalAuditReport {
  id: string;
  name: string;
  date: string;
  tenantId: string;
  totalValue: number;
  purchaseCost: number;
  itemsCount: number;
  shortagesCount: number;
  inventoryState: Record<string, AuditRecord>;
}

export default function IngredientAuditWorkspace({
  ingredients,
  currentUser,
  tenants
}: IngredientAuditWorkspaceProps) {
  const tenantId = currentUser?.tenantId || 'global';
  const tenantName = tenants.find((t) => t.id === tenantId)?.name || 'The Last Straw';

  // State for inventory parameters (key is ingredientId)
  const [inventoryState, setInventoryState] = useState<Record<string, AuditRecord>>({});
  const [history, setHistory] = useState<HistoricalAuditReport[]>([]);
  const [activeTab, setActiveTab] = useState<'audit' | 'shopping' | 'history'>('audit');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  
  // Dialog / Input states
  const [reportName, setReportName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedHistoricalReport, setSelectedHistoricalReport] = useState<HistoricalAuditReport | null>(null);

  // Load ingredients master category list
  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(ingredients.map((i) => i.category || 'Others').filter(Boolean)))];
  }, [ingredients]);

  // Combined key for local storage
  const localStorageKey = `spirit_alchemist_inventory_state_${tenantId}`;
  const localHistoryKey = `spirit_alchemist_inventory_history_${tenantId}`;

  // 1. Initial Load of inventory parameters and historical reports
  useEffect(() => {
    // A. Load from LocalStorage
    const localData = localStorage.getItem(localStorageKey);
    const localHistory = localStorage.getItem(localHistoryKey);

    let initialParams: Record<string, AuditRecord> = {};
    if (localData) {
      try {
        initialParams = JSON.parse(localData);
      } catch (e) {
        console.warn('Error reading local inventory state', e);
      }
    }

    if (localHistory) {
      try {
        setHistory(JSON.parse(localHistory));
      } catch (e) {
        console.warn('Error reading local historical record', e);
      }
    }

    // Initialize with default values for ingredients that don't have records yet
    const consolidated: Record<string, AuditRecord> = {};
    ingredients.forEach((ing) => {
      consolidated[ing.id] = {
        parStock: initialParams[ing.id]?.parStock ?? 0,
        currentStock: initialParams[ing.id]?.currentStock ?? 0
      };
    });
    setInventoryState(consolidated);

    // B. Attempt to fetch current state and history from Firestore (aggregated to minimize reads/writes)
    const loadFromCloud = async () => {
      if (!currentUser) return;
      setSyncStatus('syncing');
      try {
        const docRef = doc(db, 'inventory_snapshots', `${tenantId}_current_audit`);
        const docSnap = await getDoc(docRef);

        const histRef = doc(db, 'inventory_snapshots', `${tenantId}_history`);
        const histSnap = await getDoc(histRef);

        let mergedState = { ...consolidated };
        if (docSnap.exists()) {
          const cloudData = docSnap.data().state as Record<string, AuditRecord>;
          ingredients.forEach((ing) => {
            if (cloudData[ing.id]) {
              mergedState[ing.id] = {
                parStock: cloudData[ing.id].parStock ?? consolidated[ing.id]?.parStock ?? 0,
                currentStock: cloudData[ing.id].currentStock ?? consolidated[ing.id]?.currentStock ?? 0
              };
            }
          });
          setInventoryState(mergedState);
          localStorage.setItem(localStorageKey, JSON.stringify(mergedState));
        }

        if (histSnap.exists()) {
          const cloudHistory = histSnap.data().reports as HistoricalAuditReport[];
          setHistory(cloudHistory);
          localStorage.setItem(localHistoryKey, JSON.stringify(cloudHistory));
        }
        setSyncStatus('synced');
      } catch (err) {
        console.warn('Failed cloud sync for inventory snapshots, falling back to local storage:', err);
        setSyncStatus('error');
      }
    };

    loadFromCloud();
  }, [tenantId, ingredients.length]);

  // 2. Proactive local state updater and debounced cloud syncer
  const updateAuditParam = (ingredientId: string, field: 'parStock' | 'currentStock', val: number) => {
    const updated = {
      ...inventoryState,
      [ingredientId]: {
        ...(inventoryState[ingredientId] || { parStock: 0, currentStock: 0 }),
        [field]: Number(val) >= 0 ? Number(val) : 0
      }
    };
    setInventoryState(updated);
    localStorage.setItem(localStorageKey, JSON.stringify(updated));
  };

  // Trigger manual sync
  const handleCloudSync = async () => {
    if (!currentUser) return;
    setSyncStatus('syncing');
    try {
      // Save current audit state
      await setDoc(doc(db, 'inventory_snapshots', `${tenantId}_current_audit`), {
        tenantId,
        updatedAt: new Date().toISOString(),
        state: inventoryState
      });

      // Save history catalog
      await setDoc(doc(db, 'inventory_snapshots', `${tenantId}_history`), {
        tenantId,
        reports: history
      });

      setSyncStatus('synced');
    } catch (err) {
      console.error('Firestore inventory save failed:', err);
      setSyncStatus('error');
    }
  };

  // Clean filters
  const visibleIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      // Scope to current tenant
      if (currentUser?.role === 'client') {
        if (ing.tenantId !== tenantId && ing.tenantId !== 'global') return false;
      }
      
      const matchSearch = ing.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (ing.category || 'others').toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = categoryFilter === 'all' || (ing.category || 'Others') === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [ingredients, searchTerm, categoryFilter, tenantId, currentUser]);

  // Calculate detailed inventory metrics
  const calculatedMetrics = useMemo(() => {
    let totalValueOnDecimal = 0;
    let totalPurchaseCost = 0;
    let activeScansCount = 0;
    let totalShortages = 0;

    const breakdown = ingredients.map((ing) => {
      const state = inventoryState[ing.id] || { parStock: 0, currentStock: 0 };
      const { costPerG, costPerMl } = getIngredientUnitCosts(ing);
      
      // Determine standard unit costs
      let unitCost = 0;
      if (['ml', 'l', 'fl_oz'].includes(ing.baseUnit)) {
        unitCost = costPerMl; // Per milliliter reference
      } else if (['g', 'kg', 'lb', 'oz'].includes(ing.baseUnit)) {
        unitCost = costPerG;
      } else {
        unitCost = ing.baseQuantity > 0 ? ing.baseCost / ing.baseQuantity : 0;
      }

      // Calculate on-hand stock values
      // Note: we input stocks in base product format (e.g. 1 bottle, 500 grams, etc.)
      // To simplify input for the user, currentStock is physical units of baseQuantity packaging spec.
      // (For example, if baseQuantity is 1000ml and baseCost is $10: 1.5 package unit = 1500ml on hand, costing $15)
      const onHandValue = state.currentStock * ing.baseCost;
      totalValueOnDecimal += onHandValue;

      // Check if currentStock < parStock
      const missingStock = Math.max(0, state.parStock - state.currentStock);
      const targetPurchaseCost = missingStock * ing.baseCost;
      totalPurchaseCost += targetPurchaseCost;

      if (state.currentStock > 0 || state.parStock > 0) {
        activeScansCount++;
      }

      if (state.currentStock < state.parStock) {
        totalShortages++;
      }

      const ratio = state.parStock > 0 ? state.currentStock / state.parStock : 1;
      let status: 'ok' | 'low' | 'critical' = 'ok';
      if (ratio <= 0.2 && state.parStock > 0) status = 'critical';
      else if (ratio < 1.0 && state.parStock > 0) status = 'low';

      return {
        ingredient: ing,
        currentStock: state.currentStock,
        parStock: state.parStock,
        unitCost: ing.baseCost,
        onHandValue,
        missingStock,
        targetPurchaseCost,
        status
      };
    });

    return {
      totalValueOnDecimal,
      totalPurchaseCost,
      activeScansCount,
      totalShortages,
      breakdown
    };
  }, [ingredients, inventoryState]);

  // Reset counters to zero
  const resetAuditQuantities = () => {
    if (confirm('Are you sure you want to reset all current stock and Par targets to zero for a new audit cycle?')) {
      const resetObj: Record<string, AuditRecord> = {};
      ingredients.forEach((ing) => {
        resetObj[ing.id] = { parStock: 0, currentStock: 0 };
      });
      setInventoryState(resetObj);
      localStorage.setItem(localStorageKey, JSON.stringify(resetObj));
      handleCloudSync();
    }
  };

  // Copy Par stock values down as current stock (for fast input)
  const autofillCurrentWithPar = () => {
    if (confirm('Do you wish to auto-fill the Physical Inventory of all products using their scheduled Par Stock targets?')) {
      const updated = { ...inventoryState };
      ingredients.forEach((ing) => {
        const state = updated[ing.id] || { parStock: 0, currentStock: 0 };
        updated[ing.id] = {
          ...state,
          currentStock: state.parStock
        };
      });
      setInventoryState(updated);
      localStorage.setItem(localStorageKey, JSON.stringify(updated));
    }
  };

  // Save current audit snapshot to local history and cloud
  const triggerSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportName.trim()) {
      alert('Please enter a name for the audit report.');
      return;
    }

    const newReport: HistoricalAuditReport = {
      id: `audit_${Date.now()}`,
      name: reportName,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      tenantId,
      totalValue: calculatedMetrics.totalValueOnDecimal,
      purchaseCost: calculatedMetrics.totalPurchaseCost,
      itemsCount: ingredients.length,
      shortagesCount: calculatedMetrics.totalShortages,
      inventoryState: { ...inventoryState }
    };

    const updatedHistory = [newReport, ...history];
    setHistory(updatedHistory);
    localStorage.setItem(localHistoryKey, JSON.stringify(updatedHistory));

    // Save history database state
    setReportName('');
    setShowSaveModal(false);

    // Sync to backend Cloud Firestore
    if (currentUser) {
      try {
        await setDoc(doc(db, 'inventory_snapshots', `${tenantId}_history`), {
          tenantId,
          reports: updatedHistory
        });
        setSyncStatus('synced');
      } catch (err) {
        console.warn('Snapshot history backed locally, cloud database was busy:', err);
        setSyncStatus('error');
      }
    }
  };

  // Delete historical snapshot
  const deleteSnapshot = async (id: string) => {
    if (confirm('Are you sure you want to permanently delete this report from the audit history?')) {
      const updated = history.filter((r) => r.id !== id);
      setHistory(updated);
      localStorage.setItem(localHistoryKey, JSON.stringify(updated));

      if (currentUser) {
        try {
          await setDoc(doc(db, 'inventory_snapshots', `${tenantId}_history`), {
            tenantId,
            reports: updated
          });
        } catch (e) {
          console.warn('Error clearing cloud history:', e);
        }
      }
    }
  };

  // Restore snapshot values back into the active worksheet
  const loadSnapshotIntoActiveWorksheet = (report: HistoricalAuditReport) => {
    if (confirm(`Do you wish to restore the data status of report "${report.name}" into your active worksheet? This will replace your current numbers.`)) {
      setInventoryState(report.inventoryState);
      localStorage.setItem(localStorageKey, JSON.stringify(report.inventoryState));
      setActiveTab('audit');
      setSelectedHistoricalReport(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter items that need to be reordered
  const shoppingList = useMemo(() => {
    return calculatedMetrics.breakdown.filter((item) => item.missingStock > 0);
  }, [calculatedMetrics.breakdown]);

  return (
    <div className="space-y-6" id="auditor-mainframe-root">
      
      {/* 1. Header Hero Panel (No Print) */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-5 no-print" id="auditor-hero-header">
        <div className="flex items-center gap-4 text-left">
          <div className="p-3.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl">
            <ClipboardCheck className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/25">
                Admin Module
              </span>
              <span className="text-slate-500">•</span>
              <span className="font-mono text-[10px] text-slate-400 leading-none">Stock Take</span>
            </div>
            <h2 className="text-lg font-black tracking-tight text-slate-100 flex items-center gap-1.5 mt-0.5">
              Inventory Control & Monthly Audit
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Venue: <strong className="text-indigo-300 font-bold">{tenantName}</strong> • Conduct physical inventory counts, set Par levels, and calculate smart monthly purchase orders.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          <div className="flex items-center gap-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            <span className="text-[10px] text-slate-400">
              Cloud: {syncStatus === 'synced' ? 'Synced ✓' : syncStatus === 'syncing' ? 'Saving...' : 'Local Cache'}
            </span>
            <button 
              onClick={handleCloudSync}
              className="p-1 hover:bg-slate-800 rounded transition text-slate-300 hover:text-white cursor-pointer ml-1" 
              title="Save to cloud"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>

          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4.5 py-2.5 bg-indigo-650 hover:bg-indigo-755 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md"
            id="audit-btn-save-report"
          >
            <Save className="h-4 w-4" />
            Save Audit Close
          </button>
        </div>
      </div>

      {/* 2. Key Performance Indicators BENTO Grid (No Print) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print" id="auditor-bento-kpi">
        
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-left flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">On-Hand Value</span>
            <span className="text-xl font-black text-slate-900 tracking-tight font-mono">
              {formatCurrency(calculatedMetrics.totalValueOnDecimal)}
            </span>
            <span className="text-[10px] text-slate-500 block leading-none">Total physical stock cost today</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-left flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Order Budget</span>
            <span className="text-xl font-black text-indigo-650 tracking-tight font-mono">
              {formatCurrency(calculatedMetrics.totalPurchaseCost)}
            </span>
            <span className="text-[10px] text-slate-500 block leading-none">To replenish to target par stock</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShoppingCart className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-left flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Tracked Items</span>
            <span className="text-xl font-black text-slate-900 tracking-tight font-mono">
              {calculatedMetrics.activeScansCount} <span className="text-xs text-slate-400 font-normal">/ {ingredients.length}</span>
            </span>
            <span className="text-[10px] text-slate-500 block leading-none">With count or par set</span>
          </div>
          <div className="p-3 bg-slate-55 text-slate-600 rounded-xl">
            <Briefcase className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-left flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Shortages (Under Par)</span>
            <span className={`text-xl font-black tracking-tight font-mono ${calculatedMetrics.totalShortages > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {calculatedMetrics.totalShortages} <span className="text-xs text-slate-405 font-light">items</span>
            </span>
            <span className="text-[10px] text-slate-500 block leading-none">Ingredients flagged to purchase</span>
          </div>
          <div className={`p-3 rounded-xl ${calculatedMetrics.totalShortages > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs Bar (No Print) */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-3 border border-slate-100 rounded-2xl shadow-xs no-print" id="auditor-navigator-sub">
        
        <div className="flex bg-slate-100 p-1 rounded-xl self-start" id="audit-tabs-row">
          <button
            onClick={() => { setActiveTab('audit'); setSelectedHistoricalReport(null); }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'audit' && !selectedHistoricalReport
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Audit Worksheet
          </button>
          <button
            onClick={() => { setActiveTab('shopping'); setSelectedHistoricalReport(null); }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'shopping' && !selectedHistoricalReport
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🛒 Suggested Purchases
            {shoppingList.length > 0 && (
              <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded-full text-[9px] font-black font-mono">
                {shoppingList.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('history'); setSelectedHistoricalReport(null); }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history' || selectedHistoricalReport
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🕒 Audit History & Logs
            {history.length > 0 && (
              <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[9px] font-bold font-mono">
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* Dynamic filters based on active view tab */}
        {activeTab !== 'history' && !selectedHistoricalReport && (
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Search Input */}
            <div className="relative w-44 md:w-56">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search ingredient..."
                className="w-full text-xs font-medium pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/50"
              />
            </div>

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs font-bold border border-slate-200 bg-slate-50/50 p-2 rounded-xl focus:outline-none"
            >
              <option value="all">All categories</option>
              {categories.slice(1).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 4. Active Workstation Area */}

      {/* VIEW A: INTERACTIVE AUDIT SHEET CONTAINER */}
      {activeTab === 'audit' && !selectedHistoricalReport && (
        <div className="space-y-4 no-print text-left animate-fadeIn">
          
          {/* Quick utility helpers row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl text-xs text-indigo-950 gap-3">
            <div className="flex items-start gap-2 max-w-lg">
              <Sparkles className="h-4.5 w-4.5 text-indigo-600 shrink-0 mt-0.5" />
              <p>
                <strong>💡 Measurement Tip:</strong> Quantities are entered based on the <strong>default purchase format unit</strong> configured in the Catalog. For example, if you have 1 bottle of 750ml, the physical stock is <code className="bg-indigo-100 p-0.5 rounded font-bold font-mono">1.00</code>.
              </p>
            </div>

            <div className="flex gap-2 self-stretch sm:self-auto justify-end">
              <button
                onClick={autofillCurrentWithPar}
                className="px-3 py-1.5 border border-indigo-200 hover:bg-indigo-50 text-indigo-705 text-[10.5px] font-bold rounded-lg cursor-pointer transition flex items-center gap-1 leading-none"
                title="Copy Par stocks"
              >
                <Calculator className="h-3.5 w-3.5" />
                Autofill Par Stocks
              </button>
              <button
                onClick={resetAuditQuantities}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10.5px] font-bold rounded-lg cursor-pointer transition flex items-center gap-1 leading-none"
                title="Clear worksheet"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Quantities
              </button>
            </div>
          </div>
          {/* Core spreadsheet grid */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[9.5px] border-b border-slate-100">
                    <th className="px-5 py-3">Ingredient / Category</th>
                    <th className="px-4 py-3">Purchase Unit</th>
                    <th className="px-4 py-3 text-right">Pack Cost</th>
                    <th className="px-5 py-3 text-center w-36">Par Stock (Target)</th>
                    <th className="px-5 py-3 text-center w-36">Physical Stock (On Hand)</th>
                    <th className="px-4 py-3 text-right">On-Hand Value</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleIngredients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400 italic">
                        No ingredients found for active filters. Go to "Ingredient Catalog" to add more.
                      </td>
                    </tr>
                  ) : (
                    visibleIngredients.map((ing) => {
                      const state = inventoryState[ing.id] || { parStock: 0, currentStock: 0 };
                      const onHandVal = state.currentStock * ing.baseCost;
                      const ratio = state.parStock > 0 ? state.currentStock / state.parStock : 1.0;

                      let statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-50 text-emerald-700 uppercase tracking-widest leading-none border border-emerald-100">
                          <CheckCircle2 className="h-3 w-3" /> OK
                        </span>
                      );
                      
                      if (ratio <= 0.2 && state.parStock > 0) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-extrabold bg-red-50 text-red-700 uppercase tracking-widest leading-none border border-red-100">
                            <TrendingDown className="h-3 w-3" /> Critical
                          </span>
                        );
                        if (state.currentStock === 0) {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-extrabold bg-red-50 text-red-700 uppercase tracking-widest leading-none border border-red-100">
                              <TrendingDown className="h-3 w-3" /> Stockout
                            </span>
                          );
                        }
                      } else if (ratio < 1.0 && state.parStock > 0) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-extrabold bg-amber-50 text-amber-700 uppercase tracking-widest leading-none border border-amber-100 border-dashed">
                            ⚠️ Under Par
                          </span>
                        );
                      }

                      return (
                        <tr key={ing.id} className="hover:bg-slate-50 transition-colors">
                          {/* Name & sku */}
                          <td className="px-5 py-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {ing.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-[8.5px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                              <span>{ing.category || 'Uncategorized'}</span>
                              {ing.sku && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-slate-400">SKU: {ing.sku}</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Packet yield unit spec */}
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-700">
                              {ing.baseQuantity} {ing.baseUnit}
                            </div>
                          </td>

                          {/* Base list price */}
                          <td className="px-4 py-3 text-right font-mono text-slate-650">
                            {formatCurrency(ing.baseCost)}
                          </td>

                          {/* Input Target Par */}
                          <td className="px-5 py-3 text-center">
                            <div className="flex items-center justify-center gap-1 max-w-[120px] mx-auto">
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={state.parStock === 0 ? '' : state.parStock}
                                onChange={(e) => updateAuditParam(ing.id, 'parStock', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-16 p-1 text-center font-mono border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-extrabold text-slate-800"
                              />
                              <span className="text-[10px] text-slate-400 font-bold">units</span>
                            </div>
                          </td>

                          {/* Input On-Hand physical stock */}
                          <td className="px-5 py-3 text-center">
                            <div className="flex items-center justify-center gap-1 max-w-[120px] mx-auto">
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={state.currentStock === 0 ? '' : state.currentStock}
                                onChange={(e) => updateAuditParam(ing.id, 'currentStock', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-16 p-1 text-center font-mono border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 font-extrabold text-indigo-755 bg-indigo-50/30"
                              />
                              <span className="text-[10px] text-slate-400 font-bold">units</span>
                            </div>
                          </td>

                          {/* Extracted actual valuation on site */}
                          <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono text-xs">
                            {formatCurrency(onHandVal)}
                          </td>

                          {/* Visual KPI trigger badge */}
                          <td className="px-4 py-3 text-center">
                            {statusBadge}
                          </td>
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


      {/* VIEW B: RECOMMENDED REORDERS & SUGGESTED PURCHASE ORDER */}
      {activeTab === 'shopping' && !selectedHistoricalReport && (
        <div className="space-y-6 no-print text-left animate-fadeIn">
          
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">
                Purchase List / Suggested Purchase Order
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ingredients with current physical stock ({tenantName}) under registered Par Stock levels.
              </p>
            </div>

            {shoppingList.length > 0 && (
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm select-none"
              >
                <Printer className="h-4 w-4" />
                Print Purchase Order
              </button>
            )}
          </div>

          {shoppingList.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-3 shadow-inner">
              <div className="inline-flex p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                <CheckCircle2 className="h-8 w-8 animate-bounce" />
              </div>
              <h4 className="text-base font-black text-slate-900">Inventory Fully Supplied!</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                All of your physical stock covers or is equal to the scheduled target <strong>Par Stock</strong>. No procurement orders are required at this stage.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Purchase order summary grid list */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="shopping-purchase-receipt-print">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <span className="text-[10px] font-black text-indigo-650 uppercase tracking-wider block">Consolidated Replenishment Order</span>
                    <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">SUGGESTED PURCHASE REORDER SHEET</h4>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 block font-mono">Estimated Budget</span>
                    <span className="text-lg font-black text-indigo-605 font-mono">{formatCurrency(calculatedMetrics.totalPurchaseCost)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-100">
                        <th className="px-5 py-2.5">Missing Ingredient</th>
                        <th className="px-4 py-2.5 text-center">Purchase Unit</th>
                        <th className="px-4 py-2.5 text-right">List Price</th>
                        <th className="px-4 py-2.5 text-center">Current Stock</th>
                        <th className="px-4 py-2.5 text-center">Par Stock</th>
                        <th className="px-4 py-2.5 text-center bg-indigo-50/30 text-indigo-900">Recommended Order Quantity</th>
                        <th className="px-4 py-2.5 text-right font-bold text-slate-900">Subtotal Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shoppingList.map(({ ingredient, currentStock, parStock, missingStock, targetPurchaseCost }) => (
                        <tr key={ingredient.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3">
                            <div className="font-extrabold text-slate-900">{ingredient.name}</div>
                            <div className="text-[8.5px] text-slate-400 font-semibold tracking-wide uppercase mt-0.5">{ingredient.category || 'Uncategorized'}</div>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500">
                            {ingredient.baseQuantity} {ingredient.baseUnit}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-650">
                            {formatCurrency(ingredient.baseCost)}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600 font-mono">
                            {currentStock} units
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600 font-mono">
                            {parStock} units
                          </td>
                          <td className="px-4 py-3 text-center font-black text-indigo-700 bg-indigo-50/20 font-mono">
                            {missingStock.toFixed(1)} units
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-900 font-mono">
                            {formatCurrency(targetPurchaseCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-950 text-white font-bold text-xs border-t-2 border-slate-900">
                        <td colSpan={5} className="px-5 py-3 font-extrabold text-slate-200">TOTAL ESTIMATED ADQUISITION BUDGET</td>
                        <td className="px-4 py-3 text-center bg-slate-900 font-mono">
                          {shoppingList.reduce((acc, item) => acc + item.missingStock, 0).toFixed(1)} units
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-amber-400 font-black">
                          {formatCurrency(calculatedMetrics.totalPurchaseCost)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW C: TIMELINE RECORD DE AUDITORIAS GUARDADAS */}
      {(activeTab === 'history' || selectedHistoricalReport) && (
        <div className="space-y-6 no-print text-left animate-fadeIn">
          
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">
                Historical Audit Closures
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and manage saved historical monthly audits to track inventory changes and expenses.
              </p>
            </div>
          </div>

          {selectedHistoricalReport ? (
            /* Detailed view of a single historical report */
            <div className="space-y-4">
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-850 flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block leading-none">Historical Report Loaded</span>
                  <h4 className="text-base font-black text-white">{selectedHistoricalReport.name}</h4>
                  <p className="text-xs text-slate-400">
                    Audit closed on: <strong>{selectedHistoricalReport.date}</strong> for {tenantName}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      loadSnapshotIntoActiveWorksheet(selectedHistoricalReport);
                    }}
                    className="px-4 py-2 border border-slate-750 hover:bg-slate-800 text-xs font-bold text-indigo-305 rounded-xl cursor-pointer transition flex items-center gap-1.5"
                  >
                    <RefreshCw className="h-4 w-4 text-indigo-400" />
                    Restore to Active Worksheet
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-755 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow transition"
                  >
                    <Printer className="h-4 w-4" />
                    Print this report
                  </button>
                  <button
                    onClick={() => setSelectedHistoricalReport(null)}
                    className="px-3.5 py-2 border border-slate-750 hover:bg-slate-800 text-xs text-slate-350 hover:text-white rounded-xl transition"
                  >
                    Back to History List
                  </button>
                </div>
              </div>

              {/* Grid with audit snapshot table data */}
              <div className="bg-white border border-slate-104 shadow-md rounded-2xl overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-750 uppercase">Captured physical inventory</span>
                  <div className="flex gap-4 font-mono text-xs">
                    <div>
                      <span className="text-slate-400 text-[10.5px]">On-Hand Value:</span> <strong className="text-slate-850 font-black">{formatCurrency(selectedHistoricalReport.totalValue)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10.5px]">Order Budget:</span> <strong className="text-indigo-650 font-black">{formatCurrency(selectedHistoricalReport.purchaseCost)}</strong>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-505 font-bold uppercase text-[9px] border-b border-slate-100">
                        <th className="px-5 py-2.5">Ingredient</th>
                        <th className="px-4 py-2.5">Purchase Unit</th>
                        <th className="px-4 py-2.5 text-right">Unit Price</th>
                        <th className="px-4 py-2.5 text-center">Par Stock</th>
                        <th className="px-4 py-2.5 text-center">Actual Physical Stock</th>
                        <th className="px-4 py-2.5 text-right">Captured Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ingredients.map((ing) => {
                        const snapState = selectedHistoricalReport.inventoryState[ing.id] || { parStock: 0, currentStock: 0 };
                        if (snapState.parStock === 0 && snapState.currentStock === 0) return null; // skip untouched for view clarity

                        return (
                          <tr key={ing.id} className="hover:bg-slate-50/30">
                            <td className="px-5 py-2.5 font-bold text-slate-850">{ing.name}</td>
                            <td className="px-4 py-2.5 text-slate-505">{ing.baseQuantity} {ing.baseUnit}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-slate-650">{formatCurrency(ing.baseCost)}</td>
                            <td className="px-4 py-2.5 text-center font-mono">{snapState.parStock} units</td>
                            <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-800">{snapState.currentStock} units</td>
                            <td className="px-4 py-2.5 text-right font-mono font-extrabold text-slate-900">{formatCurrency(snapState.currentStock * ing.baseCost)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-3 shadow-inner">
              <div className="inline-flex p-4 bg-slate-55 text-slate-405 rounded-xl">
                <Clock className="h-8 w-8 text-slate-500" />
              </div>
              <h4 className="text-base font-black text-slate-900">Audit History is Empty</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                You haven't saved any historical audit snapshots yet. Once you complete your inventory worksheet, click <strong>"Save Audit Close"</strong> above to freeze today's counts in time.
              </p>
            </div>
          ) : (
            /* Historical audits list */
            <div className="space-y-3">
              {history.map((report) => (
                <div
                  key={report.id}
                  className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-left hover:border-indigo-150 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-650 font-extrabold uppercase px-2 py-0.5 rounded">
                        <Calendar className="h-3 w-3" /> Audit Closure Report
                      </span>
                      <span className="text-slate-350 text-xs font-bold font-mono">{report.date}</span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 tracking-tight">{report.name}</h4>
                    <p className="text-[10.5px] text-slate-500">
                      Measured items: <strong>{Object.keys(report.inventoryState).filter(k=>report.inventoryState[k].currentStock > 0 || report.inventoryState[k].parStock >0).length} items</strong> out of {report.itemsCount} total.
                    </p>
                  </div>

                  {/* Financial snapshot counts */}
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-4 select-none font-mono text-right text-xs">
                    <div className="space-y-0.5 border-r border-slate-100 pr-4">
                      <span className="text-[9.5px] text-slate-400 uppercase tracking-widest block font-sans">On-Hand Value</span>
                      <span className="font-extrabold text-slate-800">{formatCurrency(report.totalValue)}</span>
                    </div>
                    <div className="space-y-0.5 pl-1.5">
                      <span className="text-[9.5px] text-slate-400 uppercase tracking-widest block font-sans">Order Budget</span>
                      <span className="font-extrabold text-indigo-705">{formatCurrency(report.purchaseCost)}</span>
                    </div>
                  </div>

                  {/* Operational triggers */}
                  <div className="flex items-center gap-2 self-stretch md:self-auto justify-end border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                    <button
                      onClick={() => setSelectedHistoricalReport(report)}
                      className="px-3 py-2 bg-slate-5/80 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="h-4 w-4" /> View Details
                    </button>
                    <button
                      onClick={() => deleteSnapshot(report.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                      title="Delete Report"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* 5. HEAVILY OPTIMIZED PRINTABLE SECTION (HIDDEN ON DESKTOP INTERACTIVES, ONLY VISIBLE TO browser print engines!) */}
      {/* This layout perfectly paginates under print media controls to render beautiful reports */}
      <div className="hidden print-sheet-compilation" id="printable-sheet-auditor-workspace">
        
        {/* Render for Active Shopping list printing */}
        {activeTab === 'shopping' && !selectedHistoricalReport && (
          <div className="p-8 sm:p-12 md:p-16 bg-white max-w-4xl mx-auto space-y-8 font-sans printable-section text-black bg-white">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
              <div>
                <div className="text-[10px] font-black tracking-widest text-indigo-600 uppercase">F&B Cost Control Operations Worksheet</div>
                <h1 className="text-xl font-black text-slate-950 tracking-tight">SUGGESTED PURCHASE REORDER</h1>
                <p className="text-slate-500 text-[11px]">Venue: {tenantName} • Consolidated monthly supplier shopping sheet</p>
              </div>
              <div className="text-right font-mono text-[10px] text-slate-400 space-y-0.5">
                <div>Document Class: PRE-ORDER</div>
                <div>Issued: {new Date().toLocaleDateString('en-US')}</div>
              </div>
            </div>

            {/* KPI grid row */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-150 text-xs">
              <div>
                <span className="text-[9px] text-slate-450 uppercase font-black">Acquisition Budget</span>
                <div className="text-xs font-bold text-emerald-800 mt-1 font-mono">{formatCurrency(calculatedMetrics.totalPurchaseCost)}</div>
              </div>
              <div>
                <span className="text-[9px] text-slate-450 uppercase font-black">Vendor Items to buy</span>
                <div className="text-xs font-bold text-slate-800 mt-1 font-mono">{shoppingList.length} items</div>
              </div>
              <div>
                <span className="text-[9px] text-slate-450 uppercase font-black font-sans">Authorized By</span>
                <div className="text-[10.5px] font-semibold text-slate-705 mt-1">Finance Admin</div>
              </div>
            </div>

            {/* Ingredients list */}
            <div>
              <table className="w-full text-xs text-left border">
                <thead>
                  <tr className="bg-slate-100 border-b font-extrabold uppercase text-[9px] text-slate-700">
                    <th className="px-3 py-2">Item Name / Category</th>
                    <th className="px-3 py-2">Unit size</th>
                    <th className="px-3 py-2 text-right">Pack cost</th>
                    <th className="px-3 py-2 text-center">In Stock</th>
                    <th className="px-3 py-2 text-center">Target stocks</th>
                    <th className="px-3 py-2 text-center bg-slate-50">To Purchase</th>
                    <th className="px-3 py-2 text-right">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shoppingList.map(({ ingredient, currentStock, parStock, missingStock, targetPurchaseCost }) => (
                    <tr key={ingredient.id}>
                      <td className="px-3 py-2">
                        <span className="font-bold">{ingredient.name}</span>
                        <span className="block text-[8px] text-slate-455 uppercase">{ingredient.category || 'Other'}</span>
                      </td>
                      <td className="px-3 py-2 text-center">{ingredient.baseQuantity} {ingredient.baseUnit}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(ingredient.baseCost)}</td>
                      <td className="px-3 py-2 text-center font-mono">{currentStock}</td>
                      <td className="px-3 py-2 text-center font-mono">{parStock}</td>
                      <td className="px-3 py-2 text-center font-black bg-slate-50 font-mono">{missingStock.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-bold font-mono">{formatCurrency(targetPurchaseCost)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold border-t-2">
                    <td colSpan={5} className="px-3 py-2.5 font-black text-slate-700">TOTAL EST. REORDER VALUE</td>
                    <td className="px-3 py-2.5 text-center font-mono">{shoppingList.reduce((acc, item)=>acc + item.missingStock, 0).toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-950">{formatCurrency(calculatedMetrics.totalPurchaseCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Signature validation */}
            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-4">
                <div className="border-b border-slate-900 mx-auto max-w-[180px] h-8"></div>
                <div>
                  <div className="font-bold">Operations / Bar Lead Signature</div>
                  <div className="text-[10px] text-slate-450">Inventory counts checked</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border-b border-slate-900 mx-auto max-w-[180px] h-8"></div>
                <div>
                  <div className="font-bold">Procurement Approval</div>
                  <div className="text-[10px] text-slate-455">Expenditure Budget Clearance</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Render for Active Audit layout sheet printing */}
        {activeTab === 'audit' && !selectedHistoricalReport && (
          <div className="p-8 sm:p-12 md:p-16 bg-white max-w-4xl mx-auto space-y-8 font-sans printable-section text-black bg-white">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
              <div>
                <div className="text-[10px] font-black tracking-widest text-indigo-600 uppercase">F&B Cost Control Operations Worksheet</div>
                <h1 className="text-xl font-black text-slate-950 tracking-tight font-sans">FULL PHYSICAL INVENTORY RECORD</h1>
                <p className="text-slate-500 text-[11px]">Venue: {tenantName} • On-premise liquid inventory valuation sheet</p>
              </div>
              <div className="text-right font-mono text-[10px] text-slate-400 space-y-0.5">
                <div>Document Class: AUDIT_PLANILLA</div>
                <div>Issued: {new Date().toLocaleDateString('en-US')}</div>
              </div>
            </div>

            {/* KPI grid row */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-150 text-xs">
              <div>
                <span className="text-[9px] text-slate-450 uppercase font-black font-sans">Liquid stock Value</span>
                <div className="text-xs font-bold text-slate-800 mt-1 font-mono">{formatCurrency(calculatedMetrics.totalValueOnDecimal)}</div>
              </div>
              <div>
                <span className="text-[9px] text-slate-450 uppercase font-black font-sans">Scanned Ingredients</span>
                <div className="text-xs font-bold text-slate-800 mt-1 font-mono">{calculatedMetrics.activeScansCount} items</div>
              </div>
              <div>
                <span className="text-[9px] text-slate-450 uppercase font-black font-sans">Missing Targets</span>
                <div className="text-xs font-bold text-red-800 mt-1 font-mono">{calculatedMetrics.totalShortages} shortages</div>
              </div>
            </div>

            {/* Full grid table of active counts */}
            <div>
              <table className="w-full text-xs text-left border">
                <thead>
                  <tr className="bg-slate-100 border-b font-extrabold uppercase text-[9px] text-slate-750">
                    <th className="px-3 py-2">Item Name / Category</th>
                    <th className="px-3 py-2">Unit Format</th>
                    <th className="px-3 py-2 text-right">Pack Unit Price</th>
                    <th className="px-3 py-2 text-center">Par Stock Target</th>
                    <th className="px-3 py-2 text-center">Physical Stock On Hand</th>
                    <th className="px-3 py-2 text-right">Valuation on hand</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ingredients.map((ing) => {
                    const params = inventoryState[ing.id] || { parStock: 0, currentStock: 0 };
                    if (params.parStock === 0 && params.currentStock === 0) return null; // hide empty to keep sheets concise in print

                    return (
                      <tr key={ing.id}>
                        <td className="px-3 py-2">
                          <span className="font-bold">{ing.name}</span>
                          <span className="block text-[8px] text-slate-455 uppercase">{ing.category || 'Other'}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{ing.baseQuantity} {ing.baseUnit}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(ing.baseCost)}</td>
                        <td className="px-3 py-2 text-center font-mono">{params.parStock} units</td>
                        <td className="px-3 py-2 text-center font-bold font-mono text-slate-900">{params.currentStock} units</td>
                        <td className="px-3 py-2 text-right font-black font-mono">{formatCurrency(params.currentStock * ing.baseCost)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-100 font-bold border-t-2">
                    <td colSpan={5} className="px-3 py-2.5 font-bold text-slate-700">TOTAL BODEGA STOCK VALUATION</td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-slate-950">{formatCurrency(calculatedMetrics.totalValueOnDecimal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Render for Historical Snapshot view printing */}
        {selectedHistoricalReport && (
          <div className="p-8 sm:p-12 md:p-16 bg-white max-w-4xl mx-auto space-y-8 font-sans printable-section text-black bg-white">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
              <div>
                <div className="text-[10px] font-black tracking-widest text-indigo-600 uppercase">F&B Cost Control Operations Archive</div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight font-sans">CLOSED PHYSICAL AUDIT RECORD</h1>
                <p className="text-slate-500 text-[11px]">Venue: {tenantName} • Completed historical closed inventory valuation report</p>
              </div>
              <div className="text-right font-mono text-[10px] text-slate-400 space-y-0.5">
                <div>Document Class: AUDIT_STAMPED_RECORD</div>
                <div>Snapshot ID: {selectedHistoricalReport.id}</div>
                <div>Closed On: {selectedHistoricalReport.date}</div>
              </div>
            </div>

            {/* KPI grid row */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-150 text-xs">
              <div>
                <span className="text-[9px] text-slate-450 uppercase font-black">Historical Bodega Value</span>
                <div className="text-xs font-bold text-slate-800 mt-1 font-mono">{formatCurrency(selectedHistoricalReport.totalValue)}</div>
              </div>
              <div>
                <span className="text-[9px] text-slate-455 uppercase font-black">Required Acquisitions</span>
                <div className="text-xs font-bold text-slate-800 mt-1 font-mono">{formatCurrency(selectedHistoricalReport.purchaseCost)}</div>
              </div>
              <div>
                <span className="text-[9px] text-slate-450 tracking-wider uppercase font-black font-sans">Review Audit Status</span>
                <div className="text-[10px] text-emerald-800 font-extrabold mt-1">ARCHIVED / SECURED</div>
              </div>
            </div>

            {/* Sheet ingredient list */}
            <div>
              <table className="w-full text-xs text-left border">
                <thead>
                  <tr className="bg-slate-100 border-b font-extrabold uppercase text-[9px] text-slate-750">
                    <th className="px-3 py-2">Item Name</th>
                    <th className="px-3 py-2">Bottle format</th>
                    <th className="px-3 py-2 text-right">Pack cost</th>
                    <th className="px-3 py-2 text-center">Par stock</th>
                    <th className="px-3 py-2 text-center">Physical stock</th>
                    <th className="px-3 py-2 text-right">Captured valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ingredients.map((ing) => {
                    const snapState = selectedHistoricalReport.inventoryState[ing.id] || { parStock: 0, currentStock: 0 };
                    if (snapState.parStock === 0 && snapState.currentStock === 0) return null;

                    return (
                      <tr key={ing.id}>
                        <td className="px-3 py-2">
                          <span className="font-bold">{ing.name}</span>
                          <span className="block text-[8px] text-slate-455 uppercase">{ing.category || 'Other'}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{ing.baseQuantity} {ing.baseUnit}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(ing.baseCost)}</td>
                        <td className="px-3 py-2 text-center font-mono">{snapState.parStock}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-slate-900">{snapState.currentStock}</td>
                        <td className="px-3 py-2 text-right font-bold font-mono">{formatCurrency(snapState.currentStock * ing.baseCost)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-100 font-bold border-t-2">
                    <td colSpan={5} className="px-3 py-2.5 font-bold text-slate-750">TOTAL STAMPED HISTORICAL VALUE</td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-slate-950">{formatCurrency(selectedHistoricalReport.totalValue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>


      {/* 6. SAVE AUDIT REPORT MODAL (No Print) */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-950/65 flex items-center justify-center p-4 z-50 animate-fadeIn" id="audit-save-modal-backdrop">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-2xl max-w-md w-full text-left space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Save className="h-5 w-5 text-indigo-500" />
                Save Audit Snapshot
              </h3>
              <button 
                onClick={() => setShowSaveModal(false)}
                className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-650 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={triggerSaveSnapshot} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                  Report Name / Closing Period
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. May 2026 Close, Monthly Audit, etc."
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="w-full text-xs font-bold p-3 border border-slate-205 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-800"
                />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
                <span className="font-bold text-slate-800 block">📊 Snapshot Summary to Close:</span>
                <p className="text-slate-600 text-xs mt-1">
                  • <strong>Total Measured Ingredients:</strong> {ingredients.length} items<br />
                  • <strong>Physical On-Hand Value:</strong> {formatCurrency(calculatedMetrics.totalValueOnDecimal)}<br />
                  • <strong>Suggested Purchase Budget:</strong> {formatCurrency(calculatedMetrics.totalPurchaseCost)}
                </p>
                <p className="text-[10px] text-slate-400 pt-2 border-t leading-normal mt-2.5">
                  Once saved, this snapshot will be archived under the <strong>"Audit History & Logs"</strong> tab. You will be able to restore or reprint this record at any time without affecting your active stock take values.
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3.5">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-650 hover:bg-indigo-755 text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
