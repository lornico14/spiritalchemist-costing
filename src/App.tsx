/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Recipe, MasterIngredient, RecipeVersion, YieldUnit, RecipeIngredient, User, Tenant } from './types';
import { INITIAL_INGREDIENTS, INITIAL_RECIPES } from './data/initialData';
import { auth, googleSignIn, logout as firebaseLogout, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { calculateIngredientCost, calculateVersionCostWithSubrecipes, getRecipeTotalCost } from './utils/conversions';
import IngredientCatalog from './components/IngredientCatalog';
import RecipeCostingWorkspace from './components/RecipeCostingWorkspace';
import EnterpriseAdminConsole from './components/EnterpriseAdminConsole';
import {
  Beaker,
  Coins,
  Search,
  Plus,
  ArrowRight,
  TrendingUp,
  BarChart2,
  FolderOpen,
  Wine,
  Settings,
  HelpCircle,
  Clock,
  Sparkles,
  Info,
  X,
  Zap,
  Bookmark,
  LogIn,
  LogOut,
  UserCheck,
  Building,
  Lock,
  Grid,
  AlertCircle,
  Trash
} from 'lucide-react';

const INITIAL_TENANTS: Tenant[] = [
  { id: 'global', name: 'Corporate Standard / Global' },
  { id: 'rest-1', name: 'Sunset Bar' },
  { id: 'rest-2', name: 'Speakeasy Jazz Club' },
  { id: 'thelastrawmatcha', name: 'The Last Straw Matcha' }
];

const MOCK_USERS: { email: string; pass: string; user: User }[] = [
  {
    email: 'admin@beveragecosting.com',
    pass: 'admin123',
    user: {
      id: 'usr-admin',
      email: 'admin@beveragecosting.com',
      name: 'Corporate General Admin',
      role: 'superadmin',
      tenantId: 'global'
    }
  },
  {
    email: 'atardecer@bar.com',
    pass: 'bar123',
    user: {
      id: 'usr-atardecer',
      email: 'atardecer@bar.com',
      name: 'Luis (Sunset Bar)',
      role: 'client',
      tenantId: 'rest-1'
    }
  },
  {
    email: 'jazz@speakeasy.com',
    pass: 'jazz123',
    user: {
      id: 'usr-jazz',
      email: 'jazz@speakeasy.com',
      name: 'Sophia (Speakeasy Club)',
      role: 'client',
      tenantId: 'rest-2'
    }
  },
  {
    email: 'cameron@thelastrawmatcha.com',
    pass: 'matcha123',
    user: {
      id: 'usr-cameron',
      email: 'cameron@thelastrawmatcha.com',
      name: 'Cameron (The Last Straw Matcha)',
      role: 'client',
      tenantId: 'thelastrawmatcha'
    }
  }
];

function getTenantFromEmail(email: string): { id: string; name: string } {
  const lowerEmail = email.toLowerCase().trim();
  
  // Superadmins
  if (
    lowerEmail === 'nico@spiritalchemistllc.com' ||
    lowerEmail === 'nikolaslorenzo@gmail.com' ||
    lowerEmail === 'admin@beveragecosting.com'
  ) {
    return { id: 'global', name: 'Corporate Standard / Global' };
  }
  
  // Pre-seed mock mappings
  if (lowerEmail === 'atardecer@bar.com') {
    return { id: 'rest-1', name: 'Sunset Bar' };
  }
  if (lowerEmail === 'jazz@speakeasy.com') {
    return { id: 'rest-2', name: 'Speakeasy Jazz Club' };
  }
  if (lowerEmail === 'cameron@thelastrawmatcha.com') {
    return { id: 'thelastrawmatcha', name: 'The Last Straw Matcha' };
  }

  // Generic Dynamic Extraction
  const parts = lowerEmail.split('@');
  if (parts.length < 2) {
    return { id: 'rest-1', name: 'Sunset Bar' };
  }
  
  const domain = parts[1];
  const publicDomains = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'live.com', 'msn.com'];
  
  if (publicDomains.includes(domain)) {
    const prefix = parts[0];
    const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, '');
    return { 
      id: `personal-${cleanPrefix}`, 
      name: `Personal Workspace (${prefix.charAt(0).toUpperCase() + prefix.slice(1)})` 
    };
  }

  // Custom enterprise domain
  const domainBase = domain.split('.')[0];
  const tenantId = domainBase.replace(/[^a-zA-Z0-9]/g, '');

  // Specialized formatting (e.g. thelastrawmatcha)
  let tenantName = '';
  if (tenantId === 'thelastrawmatcha') {
    tenantName = 'The Last Straw Matcha';
  } else {
    // Camel case / Title case
    tenantName = tenantId
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return { id: tenantId, name: tenantName };
}

export default function App() {
  // --- AUTHENTICATION STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const local = localStorage.getItem('spirit_alchemist_current_user') || localStorage.getItem('cobarra_current_user');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- TENANTS STATE ---
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    const local = localStorage.getItem('spirit_alchemist_tenants') || localStorage.getItem('cobarra_tenants');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error('Error parsing local storage tenants, resorting to defaults', e);
      }
    }
    return INITIAL_TENANTS;
  });

  const [usersList, setUsersList] = useState<{ email: string; pass: string; user: User }[]>(() => {
    const local = localStorage.getItem('spirit_alchemist_custom_users') || localStorage.getItem('cobarra_custom_users');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error('Error parsing local storage users, resorting to default users list', e);
      }
    }
    return MOCK_USERS;
  });

  useEffect(() => {
    localStorage.setItem('spirit_alchemist_custom_users', JSON.stringify(usersList));
    localStorage.setItem('cobarra_custom_users', JSON.stringify(usersList)); // backwards-compatible syncer
  }, [usersList]);

  const registerTenantIfNeeded = (tId: string, tName: string) => {
    setTenants((prev) => {
      if (prev.some((t) => t.id === tId)) {
        return prev;
      }
      return [...prev, { id: tId, name: tName }];
    });
  };

  // --- INGREDIENTS STATE ---
  const [ingredients, setIngredients] = useState<MasterIngredient[]>(() => {
    const local = localStorage.getItem('spirit_alchemist_ingredients') || localStorage.getItem('cobarra_ingredients');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error('Error parsing local storage ingredients, resorting to defaults', e);
      }
    }
    return INITIAL_INGREDIENTS;
  });

  // --- RECIPES STATE ---
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const local = localStorage.getItem('spirit_alchemist_recipes') || localStorage.getItem('cobarra_recipes');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error('Error parsing local storage recipes, resorting to defaults', e);
      }
    }
    return INITIAL_RECIPES;
  });

  // --- NAVIGATION STATE ---
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [activeCatalogMode, setActiveCatalogMode] = useState(false);
  const [activeAdminConsole, setActiveAdminConsole] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');

  // Superadmin view-filter (for auditing specific tenants)
  const [adminViewTenantId, setAdminViewTenantId] = useState<string>('all');

  // --- MODALS FLOWS ---
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);

  // Create recipe fields states
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeDesc, setNewRecipeDesc] = useState('');
  const [newRecipeType, setNewRecipeType] = useState<'bebida' | 'sub_receta'>('bebida');
  const [newRecipeYieldVal, setNewRecipeYieldVal] = useState<number>(300);
  const [newRecipeYieldUnit, setNewRecipeYieldUnit] = useState<YieldUnit>('ml');
  const [newRecipeTenant, setNewRecipeTenant] = useState<string>('global');
  const [initialIngredientsSelection, setInitialIngredientsSelection] = useState<string[]>([]);

  // Reset selected recipe when list filters or changes to avoid stale selections
  useEffect(() => {
    if (recipes.length > 0 && !selectedRecipeId && !activeCatalogMode) {
      // Find first recipe accessible in the filtered view
      const accessible = recipes.filter(r => {
        if (!currentUser) return false;
        if (currentUser.role === 'superadmin') {
          return adminViewTenantId === 'all' || r.tenantId === adminViewTenantId;
        }
        return r.tenantId === currentUser.tenantId || r.tenantId === 'global';
      });
      if (accessible.length > 0) {
        setSelectedRecipeId(accessible[0].id);
      }
    }
  }, [recipes, currentUser, adminViewTenantId, selectedRecipeId, activeCatalogMode]);

  // --- PERSISTENCE EFFECT WRITE-BACK ---
  useEffect(() => {
    localStorage.setItem('spirit_alchemist_ingredients', JSON.stringify(ingredients));
    localStorage.setItem('cobarra_ingredients', JSON.stringify(ingredients));
  }, [ingredients]);

  useEffect(() => {
    localStorage.setItem('spirit_alchemist_recipes', JSON.stringify(recipes));
    localStorage.setItem('cobarra_recipes', JSON.stringify(recipes));
  }, [recipes]);

  useEffect(() => {
    localStorage.setItem('spirit_alchemist_tenants', JSON.stringify(tenants));
    localStorage.setItem('cobarra_tenants', JSON.stringify(tenants));
  }, [tenants]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('spirit_alchemist_current_user', JSON.stringify(currentUser));
      localStorage.setItem('cobarra_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('spirit_alchemist_current_user');
      localStorage.removeItem('cobarra_current_user');
    }
  }, [currentUser]);

  // Handle Firebase Auth Persistence & State Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email || '';
        const name = firebaseUser.displayName || email.split('@')[0];
        
        const resolved = getTenantFromEmail(email);
        const emailLower = email.toLowerCase().trim();
        const existingCustom = usersList.find((u) => u.email.toLowerCase() === emailLower);

        let role: 'superadmin' | 'client' = 'client';
        if (
          emailLower === 'nico@spiritalchemistllc.com' ||
          emailLower === 'nikolaslorenzo@gmail.com' ||
          emailLower === 'admin@beveragecosting.com' ||
          (existingCustom && existingCustom.user.role === 'superadmin')
        ) {
          role = 'superadmin';
        }

        const tenantId = existingCustom ? existingCustom.user.tenantId : resolved.id;

        const appUser: User = {
          id: firebaseUser.uid,
          email,
          name: existingCustom ? existingCustom.user.name : name,
          role,
          tenantId,
        };
        
        const tenantName = existingCustom 
          ? (tenants.find((t) => t.id === tenantId)?.name || tenantId) 
          : resolved.name;

        if (tenantId !== 'global') {
          registerTenantIfNeeded(tenantId, tenantName);
        }

        // Maintain secure references in Firestore
        try {
          await setDoc(doc(db, 'users', firebaseUser.uid), appUser);
        } catch (e) {
          console.error('Error syncing user profile to Firestore:', e);
        }

        setCurrentUser(appUser);
      }
    });
    return () => unsubscribe();
  }, [usersList, tenants]);

  // --- REAL-TIME FIRESTORE SYNCHRONIZATION EFFECT ---
  useEffect(() => {
    if (!currentUser) return;

    let qIng;
    let qRec;

    if (currentUser.role === 'superadmin') {
      qIng = collection(db, 'ingredients');
      qRec = collection(db, 'recipes');
    } else {
      qIng = query(
        collection(db, 'ingredients'),
        where('tenantId', 'in', [currentUser.tenantId, 'global'])
      );
      qRec = query(
        collection(db, 'recipes'),
        where('tenantId', 'in', [currentUser.tenantId, 'global'])
      );
    }

    const unsubIng = onSnapshot(qIng, (snapshot) => {
      const list: MasterIngredient[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as MasterIngredient);
      });
      setIngredients(list);

      // Seed if empty, superadmin is logged in, and NOT manually cleared
      if (list.length === 0 && currentUser.role === 'superadmin') {
        const alreadyCleared = localStorage.getItem('spirit_alchemist_manually_cleared_ingredients') === 'true';
        if (!alreadyCleared) {
          INITIAL_INGREDIENTS.forEach(async (ing) => {
            try {
              await setDoc(doc(db, 'ingredients', ing.id), ing);
            } catch (e) {
              console.error('Seed ingredient fails:', e);
            }
          });
        }
      } else if (list.length > 0) {
        localStorage.removeItem('spirit_alchemist_manually_cleared_ingredients');
      }
    }, (error) => {
      console.warn('Firestore subscription - ingredients channel offline or unconfigured. Falling back to Local Cache:', error);
    });

    const unsubRec = onSnapshot(qRec, (snapshot) => {
      const list: Recipe[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Recipe);
      });
      setRecipes(list);

      // Seed if empty, superadmin is logged in, and NOT manually cleared
      if (list.length === 0 && currentUser.role === 'superadmin') {
        const alreadyCleared = localStorage.getItem('spirit_alchemist_manually_cleared_recipes') === 'true';
        if (!alreadyCleared) {
          INITIAL_RECIPES.forEach(async (rec) => {
            try {
              await setDoc(doc(db, 'recipes', rec.id), rec);
            } catch (e) {
              console.error('Seed recipe fails:', e);
            }
          });
        }
      } else if (list.length > 0) {
        localStorage.removeItem('spirit_alchemist_manually_cleared_recipes');
      }
    }, (error) => {
      console.warn('Firestore subscription - recipes channel offline or unconfigured. Falling back to Local Cache:', error);
    });

    return () => {
      unsubIng();
      unsubRec();
    };
  }, [currentUser]);

  // Handle ingredient catalog updates (globally recalculated)
  const handleUpdateIngredients = async (updated: MasterIngredient[]) => {
    if (!currentUser) return;

    if (updated.length === 0 && ingredients.length > 0) {
      localStorage.setItem('spirit_alchemist_manually_cleared_ingredients', 'true');
    }

    // OPTIMISTIC LOCAL STATE UPDATE - instant and persistent in browser cache
    setIngredients(updated);
    localStorage.setItem('spirit_alchemist_ingredients', JSON.stringify(updated));

    // Direct delta syncing to Firestore
    const updatedIds = new Set(updated.map((i) => i.id));
    const deleted = ingredients.filter((i) => !updatedIds.has(i.id));

    // Handle deletions in background
    for (const item of deleted) {
      try {
        await deleteDoc(doc(db, 'ingredients', item.id));
      } catch (err) {
        console.warn('Firestore fallback sync - Delete ingredient failed:', err);
      }
    }

    // Handle creations / modifications in background
    for (const item of updated) {
      const match = ingredients.find((i) => i.id === item.id);
      if (!match || JSON.stringify(match) !== JSON.stringify(item)) {
        try {
          await setDoc(doc(db, 'ingredients', item.id), item);
        } catch (err) {
          console.warn('Firestore fallback sync - Write ingredient failed:', err);
        }
      }
    }
  };

  const handleResetDemoData = async () => {
    if (!currentUser || currentUser.role !== 'superadmin') return;
    try {
      localStorage.removeItem('spirit_alchemist_manually_cleared_ingredients');
      localStorage.removeItem('spirit_alchemist_manually_cleared_recipes');

      // OPTIMISTIC LOCAL RESTORE
      setIngredients(INITIAL_INGREDIENTS);
      setRecipes(INITIAL_RECIPES);
      localStorage.setItem('spirit_alchemist_ingredients', JSON.stringify(INITIAL_INGREDIENTS));
      localStorage.setItem('spirit_alchemist_recipes', JSON.stringify(INITIAL_RECIPES));
      localStorage.setItem('cobarra_recipes', JSON.stringify(INITIAL_RECIPES));

      alert('¡Base de datos demo restablecida con éxito!');

      // Synchronize to Firestore in backgound
      for (const ing of INITIAL_INGREDIENTS) {
        try {
          await setDoc(doc(db, 'ingredients', ing.id), ing);
        } catch (e) {
          console.warn('Firestore demo seed failed:', e);
        }
      }
      for (const rec of INITIAL_RECIPES) {
        try {
          await setDoc(doc(db, 'recipes', rec.id), rec);
        } catch (e) {
          console.warn('Firestore demo seed failed:', e);
        }
      }
    } catch (e) {
      console.error(e);
      alert('Error al restableces los datos de forma local.');
    }
  };

  // Handle specific recipe changes or new version commits
  const handleUpdateRecipe = async (updated: Recipe) => {
    if (!currentUser) return;

    // OPTIMISTIC LOCAL STATE UPDATE
    const updatedRecipes = recipes.map((r) => (r.id === updated.id ? updated : r));
    setRecipes(updatedRecipes);
    localStorage.setItem('spirit_alchemist_recipes', JSON.stringify(updatedRecipes));
    localStorage.setItem('cobarra_recipes', JSON.stringify(updatedRecipes));

    try {
      await setDoc(doc(db, 'recipes', updated.id), updated);
    } catch (err) {
      console.warn('Firestore fallback sync - Write recipe failed:', err);
    }
  };

  // Find currently active chosen recipe
  const activeRecipe = useMemo(() => {
    if (activeCatalogMode || !selectedRecipeId) return null;
    return recipes.find((r) => r.id === selectedRecipeId) || null;
  }, [recipes, selectedRecipeId, activeCatalogMode]);

  // Filter recipes according to active user and admin selector
  const visibleRecipes = useMemo(() => {
    if (!currentUser) return [];

    return recipes.filter((rec) => {
      // Role scoping
      if (currentUser.role === 'superadmin') {
        if (adminViewTenantId !== 'all' && rec.tenantId !== adminViewTenantId) {
          return false;
        }
      } else {
        // Clients can see their own recipes OR shared standard recipe templates
        if (rec.tenantId !== currentUser.tenantId && rec.tenantId !== 'global') {
          return false;
        }
      }
      return true;
    });
  }, [recipes, currentUser, adminViewTenantId]);

  // Catalog items filtered by access rights
  const visibleIngredients = useMemo(() => {
    if (!currentUser) return [];

    return ingredients.filter((ing) => {
      if (currentUser.role === 'superadmin') {
        if (adminViewTenantId !== 'all' && ing.tenantId !== adminViewTenantId && ing.tenantId !== 'global') {
          return false;
        }
      } else {
        // Clients see their own AND global shared items
        if (ing.tenantId !== currentUser.tenantId && ing.tenantId !== 'global') {
          return false;
        }
      }
      return true;
    });
  }, [ingredients, currentUser, adminViewTenantId]);

  // Search filter inside side menu listing
  const searchedRecipes = useMemo(() => {
    return visibleRecipes.filter((rec) => {
      const searchLower = recipeSearch.toLowerCase();
      const matchesMeta =
        rec.name.toLowerCase().includes(searchLower) ||
        rec.description.toLowerCase().includes(searchLower);

      // Search matching within ingredients too
      const latestVersion = rec.versions.find((v) => v.version === rec.currentVersion) || rec.versions[0];
      const matchesIngredients = latestVersion?.ingredients.some((row) => {
        // Find either master ingredient name OR sub-recipe name
        let matchedName = '';
        if (row.isSubRecipe) {
          matchedName = recipes.find((r) => r.id === row.ingredientId)?.name || '';
        } else {
          matchedName = ingredients.find((m) => m.id === row.ingredientId)?.name || '';
        }
        return matchedName.toLowerCase().includes(searchLower);
      }) || false;

      return matchesMeta || matchesIngredients;
    });
  }, [visibleRecipes, recipeSearch, ingredients, recipes]);

  // --- STATS COMPILER PANEL ---
  const statisticsObj = useMemo(() => {
    let totalEstimatedInvestment = 0;
    let averageRecipeCost = 0;
    let highestCostingRecipeName = 'None';
    let highestCostingVal = 0;

    const targetList = visibleRecipes;

    if (targetList.length > 0) {
      targetList.forEach((r) => {
        const c = getRecipeTotalCost(r, recipes, ingredients);
        totalEstimatedInvestment += c;
        if (c > highestCostingVal) {
          highestCostingVal = c;
          highestCostingRecipeName = r.name;
        }
      });
      averageRecipeCost = totalEstimatedInvestment / targetList.length;
    }

    return {
      totalEstimatedInvestment,
      averageRecipeCost,
      highestCostingRecipeName,
      highestCostingVal,
    };
  }, [visibleRecipes, recipes, ingredients]);

  // Handles client or superadmin login credentials validation
  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const match = usersList.find(
      (u) => u.email.toLowerCase() === loginEmail.trim().toLowerCase() && u.pass === loginPassword
    );

    if (match) {
      setCurrentUser(match.user);
      setLoginEmail('');
      setLoginPassword('');
      // Auto select first accessible recipe
      setSelectedRecipeId(null);
      setActiveCatalogMode(false);
    } else {
      setLoginError('Incorrect credentials. Make sure you entered them correctly or pick a profile below.');
    }
  };

  // Direct mock profile login handler for easy grading/testing
  const handleQuickLogin = (email: string, pass: string) => {
    setLoginError('');
    const match = usersList.find((u) => u.email === email && u.pass === pass);
    if (match) {
      setCurrentUser(match.user);
      setSelectedRecipeId(null);
      setActiveCatalogMode(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await googleSignIn();
      if (res?.firebaseUser) {
        const email = res.firebaseUser.email || '';
        const name = res.firebaseUser.displayName || email.split('@')[0];
        
        const resolved = getTenantFromEmail(email);
        const emailLower = email.toLowerCase().trim();
        const existingCustom = usersList.find((u) => u.email.toLowerCase() === emailLower);

        let role: 'superadmin' | 'client' = 'client';
        if (
          emailLower === 'nico@spiritalchemistllc.com' ||
          emailLower === 'nikolaslorenzo@gmail.com' ||
          emailLower === 'admin@beveragecosting.com' ||
          (existingCustom && existingCustom.user.role === 'superadmin')
        ) {
          role = 'superadmin';
        }

        const tenantId = existingCustom ? existingCustom.user.tenantId : resolved.id;

        const appUser: User = {
          id: res.firebaseUser.uid,
          email,
          name: existingCustom ? existingCustom.user.name : name,
          role,
          tenantId,
        };
        
        const tenantName = existingCustom 
          ? (tenants.find((t) => t.id === tenantId)?.name || tenantId) 
          : resolved.name;

        if (tenantId !== 'global') {
          registerTenantIfNeeded(tenantId, tenantName);
        }
        
        setCurrentUser(appUser);
        setSelectedRecipeId(null);
        setActiveCatalogMode(false);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/cancelled-popup-request' || err.message?.includes('cancelled-popup-request')) {
        setLoginError('El inicio de sesión fue interrumpido. Esto ocurre si se hace doble clic o si otra pestaña interfiere. Por favor, intenta de nuevo presionando una sola vez, o abre la app en una nueva pestaña.');
      } else if (err.code === 'auth/popup-blocked' || err.message?.includes('popup-blocked')) {
        setLoginError('El popup de Google fue bloqueado por tu navegador. Por favor permite popups para esta página o abre la app en una nueva pestaña.');
      } else {
        setLoginError(err.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await firebaseLogout();
    } catch (e) {
      console.error('Error signing out from Firebase', e);
    }
    setCurrentUser(null);
    setSelectedRecipeId(null);
    setActiveCatalogMode(false);
  };

  // Create recipe callback triggered in modal
  const handleAddNewRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!newRecipeName.trim()) {
      alert('Please fill out the recipe name.');
      return;
    }

    const assignedTenantId = currentUser.role === 'superadmin' ? newRecipeTenant : currentUser.tenantId;

    // Prefilled starter lines
    const initialRows: RecipeIngredient[] = initialIngredientsSelection.map((ingId, idx) => {
      // Determine if selected ingredient was a sub-recipe
      const isSub = recipes.some((r) => r.id === ingId);
      return {
        id: `row-init-${idx}-${Date.now()}`,
        ingredientId: ingId,
        isSubRecipe: isSub,
        quantity: isSub ? 30 : 25, // default
        unit: 'ml',
      };
    });

    const newRecipeId = `rec-${Date.now()}`;
    const newRecipeObj: Recipe = {
      id: newRecipeId,
      name: newRecipeName.trim(),
      description: newRecipeDesc.trim(),
      type: newRecipeType,
      currentVersion: 1,
      tenantId: assignedTenantId,
      versions: [
        {
          version: 1,
          updatedAt: new Date().toISOString(),
          note: `Original creation of the ${newRecipeType === 'sub_receta' ? 'base sub-recipe' : 'technical drink'}`,
          batchYieldValue: newRecipeYieldVal || 100,
          batchYieldUnit: newRecipeYieldUnit,
          ingredients: initialRows,
        },
      ],
    };

    // OPTIMISTIC LOCAL STATE UPDATE
    const updatedRecipes = [...recipes, newRecipeObj];
    setRecipes(updatedRecipes);
    localStorage.setItem('spirit_alchemist_recipes', JSON.stringify(updatedRecipes));
    localStorage.setItem('cobarra_recipes', JSON.stringify(updatedRecipes));

    setSelectedRecipeId(newRecipeId);
    setActiveCatalogMode(false);
    setShowAddRecipeModal(false);

    // Reset fields
    setNewRecipeName('');
    setNewRecipeDesc('');
    setNewRecipeType('bebida');
    setNewRecipeYieldVal(300);
    setNewRecipeYieldUnit('ml');
    setInitialIngredientsSelection([]);

    // BG SYNC
    try {
      await setDoc(doc(db, 'recipes', newRecipeId), newRecipeObj);
    } catch (err) {
      console.warn('Firestore fallback sync - Write state failed:', err);
    }
  };

  const [recipeToDelete, setRecipeToDelete] = useState<{ id: string; name: string } | null>(null);

  const confirmDeleteRecipe = async () => {
    if (recipeToDelete) {
      const remainingRecipes = recipes.filter((r) => r.id !== recipeToDelete.id);

      // OPTIMISTIC LOCAL STATE UPDATE
      setRecipes(remainingRecipes);
      localStorage.setItem('spirit_alchemist_recipes', JSON.stringify(remainingRecipes));
      localStorage.setItem('cobarra_recipes', JSON.stringify(remainingRecipes));

      if (selectedRecipeId === recipeToDelete.id) {
        setSelectedRecipeId(null);
      }
      setRecipeToDelete(null);

      // BG SYNC
      try {
        if (recipes.length === 1) {
          localStorage.setItem('spirit_alchemist_manually_cleared_recipes', 'true');
        }
        await deleteDoc(doc(db, 'recipes', recipeToDelete.id));
      } catch (err) {
        console.warn('Firestore fallback sync - Delete recipe failed:', err);
      }
    }
  };

  // Unify and categorize options for prefilled chooser
  const prefillSelectorOptions = useMemo(() => {
    const rawIngs = visibleIngredients.map((i) => ({ id: i.id, name: i.name, type: 'ing' }));
    const rawSubs = visibleRecipes.filter((r) => r.type === 'sub_receta').map((r) => ({ id: r.id, name: `[Sub-Recipe] ${r.name}`, type: 'sub' }));
    return [...rawIngs, ...rawSubs];
  }, [visibleIngredients, visibleRecipes]);

  // --- RENDER LOGIN VIEW ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6" id="login-layout-wrapper">
        <div className="max-w-md w-full space-y-8 bg-slate-900 px-6 py-8 rounded-3xl border border-slate-800 shadow-2xl animate-fadeIn">
          {/* Brand header */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-indigo-650 rounded-2xl text-white shadow-lg shadow-indigo-900/40">
              <Wine className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-black font-sans tracking-tight text-white uppercase">
              Spirit Alchemist
            </h2>
            <p className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest leading-none">
              Enterprise BevCosting Suite
            </p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto pt-1">
              Multi-Tenant Beverage Formula Control, High-Precision Yield Math & Venue Access Governance
            </p>
          </div>

          <form onSubmit={handleFormLogin} className="space-y-4 pt-2 text-left">
            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xxs font-semibold">
                {loginError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xxs font-bold text-slate-400 uppercase tracking-widest block font-sans">Sign In Email</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@corporate.com"
                className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xxs font-bold text-slate-400 uppercase tracking-widest block font-sans">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogIn className="h-4 w-4" />
              Sign In to Dashboard
            </button>

            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="mx-3 text-[10px] text-slate-500 font-bold uppercase tracking-wider">o / or</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <button
              type="button"
              disabled={isLoggingIn}
              onClick={handleGoogleLogin}
              className={`w-full py-2.5 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 ${
                isLoggingIn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {isLoggingIn ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-650 border-t-transparent" />
              ) : (
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4 shrink-0">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              )}
              <span>{isLoggingIn ? 'Iniciando sesión...' : 'Iniciar sesión con Google'}</span>
            </button>

            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 text-[10px] text-slate-400 leading-relaxed mt-4">
              <span className="font-bold text-amber-400 block mb-1">💡 Sugerencia para el Navegador:</span>
              <span>Si tu navegador bloquea el popup o muestra un error, te recomendamos abrir la aplicación en una <strong>nueva pestaña</strong> pulsando el botón con la flecha en la esquina superior de la vista previa de AI Studio.</span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- ACTIVE APP LAYOUT ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-700 animate-fadeIn" id="main-dashboard-wrapper">
      {/* LEFT SIDEBAR: Search and Recipes Picker */}
      <aside className="w-full md:w-80 bg-slate-900 text-slate-150 flex flex-col shrink-0 border-r border-slate-850 p-5 space-y-5 no-print text-left">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-xl text-white">
              <Beaker className="h-5 w-5 shrink-0" />
            </div>
            <div>
              <h1 className="text-xs font-black text-white uppercase tracking-wider leading-none">
                Spirit Alchemist
              </h1>
              <p className="text-[9.5px] text-indigo-400 font-bold tracking-wider leading-none mt-1">
                {currentUser.role === 'superadmin' ? 'HQ Control Suite' : `${tenants.find(t=>t.id===currentUser.tenantId)?.name || 'Client Costing'}`}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-1.5 hover:bg-slate-800 text-slate-450 hover:text-rose-400 rounded-lg transition shrink-0 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* LOGGED USER CARD */}
        <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-xs">
            {currentUser.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-xs text-slate-200 truncate">{currentUser.name}</div>
            <div className="text-[9px] text-slate-400 truncate">{currentUser.email}</div>
          </div>
        </div>

        {/* ADMIN TENANT FILTER DROPDOWN */}
        {currentUser.role === 'superadmin' && (
          <div className="space-y-1 p-1 bg-slate-800/30 border border-slate-800 rounded-xl">
            <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest px-2 pt-1 block">Filter by Establishment</label>
            <select
              value={adminViewTenantId}
              onChange={(e) => {
                setAdminViewTenantId(e.target.value);
                setSelectedRecipeId(null);
                setActiveCatalogMode(false);
                setActiveAdminConsole(false);
              }}
              className="w-full text-xs font-semibold px-2.5 py-1.5 bg-transparent text-slate-200 border-0 focus:ring-0 cursor-pointer bg-slate-900 rounded-md"
            >
              <option value="all" className="bg-slate-900">All Establishments</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id} className="bg-slate-900">{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Superadmin headquarters link */}
        {currentUser.role === 'superadmin' && (
          <button
            onClick={() => {
              setActiveAdminConsole(true);
              setActiveCatalogMode(false);
              setSelectedRecipeId(null);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wider transition uppercase cursor-pointer ${
              activeAdminConsole
                ? 'bg-amber-600 text-slate-900 shadow-md ring-2 ring-amber-400 font-extrabold'
                : 'bg-slate-800 text-amber-400 hover:bg-slate-750'
            }`}
            id="btn-sidebar-admin-console-toggle"
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4 shrink-0" />
              Corporate Governance
            </span>
            <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${
              activeAdminConsole ? 'bg-slate-900 text-amber-400' : 'bg-slate-950/40 text-amber-500'
            }`}>
              HQ
            </span>
          </button>
        )}

        {/* Global Catalog View Toggle */}
        <button
          onClick={() => {
            setActiveCatalogMode(true);
            setSelectedRecipeId(null);
            setActiveAdminConsole(false);
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wider transition uppercase cursor-pointer ${
            activeCatalogMode
              ? 'bg-indigo-600 text-white shadow-md font-extrabold'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
          }`}
          id="btn-sidebar-catalog-toggle"
        >
          <span className="flex items-center gap-2">
            <Grid className="h-4 w-4 shrink-0" />
            Ingredient Catalog
          </span>
          <span className="px-2 py-0.5 bg-slate-950/40 text-slate-200 rounded-md font-mono text-[9px]">
            {visibleIngredients.length}
          </span>
        </button>

        <div className="h-px bg-slate-800" />

        {/* Recipes Container Section */}
        <div className="flex flex-col flex-1 space-y-3 min-h-0">
          <div className="flex items-center justify-between">
            <span className="text-xxs font-bold text-slate-400 uppercase tracking-widest">
              Recipe Batches
            </span>

            <button
              onClick={() => {
                setInitialIngredientsSelection([]);
                // If superadmin, pre-initialize the recipe tenant choice to current filter or global
                setNewRecipeTenant(adminViewTenantId === 'all' ? 'global' : adminViewTenantId);
                setShowAddRecipeModal(true);
              }}
              className="p-1 px-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-450 hover:text-white rounded-lg transition text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              title="New Recipe"
              id="btn-sidebar-add-recipe-toggle"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          </div>

          {/* Interactive Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search recipe..."
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800 hover:bg-slate-750/70 border border-slate-750 focus:border-indigo-500 focus:outline-none rounded-xl text-xs text-slate-200 placeholder-slate-500 transition font-medium"
            />
          </div>

          {/* Recipes Listing Container */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[200px]" id="recipes-scrollable-box">
            {searchedRecipes.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs italic">
                {recipeSearch ? 'No recipes found.' : 'No recipes available.'}
              </div>
            ) : (
              searchedRecipes.map((rec) => {
                const isActive = !activeCatalogMode && rec.id === selectedRecipeId;
                const dynamicCost = getRecipeTotalCost(rec, recipes, ingredients);

                return (
                  <div
                    key={rec.id}
                    onClick={() => {
                      setSelectedRecipeId(rec.id);
                      setActiveCatalogMode(false);
                      setActiveAdminConsole(false);
                    }}
                    className={`group w-full p-2.5 rounded-xl flex items-center justify-between text-left transition relative cursor-pointer border ${
                      isActive
                        ? 'bg-slate-800 text-white border-slate-700 shadow-sm'
                        : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-850/60'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 pr-1 overflow-hidden">
                      <div className="flex items-center gap-1 min-w-0">
                        {rec.type === 'sub_receta' && (
                          <span className="p-0.5 bg-amber-500/10 text-amber-500 text-[8px] font-bold rounded shrink-0 leading-none">
                            SUB
                          </span>
                        )}
                        <span className="font-extrabold text-xs font-sans block truncate group-hover:text-white">
                          {rec.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[8.5px] text-slate-500 block truncate leading-none">
                        <span>v{rec.currentVersion}</span>
                        <span>•</span>
                        <span className="uppercase tracking-widest text-[7px] bg-slate-800 px-1 py-0.2 rounded font-semibold text-slate-400 bg-slate-950">
                          {tenants.find(t=>t.id===rec.tenantId)?.name.split(' ')[0] || 'Global'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-row items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-emerald-450">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 2
                        }).format(dynamicCost)}
                      </span>

                      {/* Delete icon - permitted only if superadmin OR if recipe belongs to client's specific tenant */}
                      {(currentUser?.role === 'superadmin' || (currentUser?.role === 'client' && rec.tenantId === currentUser.tenantId)) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecipeToDelete({ id: rec.id, name: rec.name });
                          }}
                          className="p-1 hover:bg-rose-950/60 text-slate-450 hover:text-rose-450 rounded transition cursor-pointer shrink-0"
                          title="Delete recipe"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Offline notification banner */}
        <div className="p-3 bg-slate-800/30 rounded-xl border border-slate-800/40 text-[9px] text-slate-500 leading-normal flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
          <span>Technical templates with local persistent state memory for browser-safe offline costing.</span>
        </div>
      </aside>

      {/* RIGHT CONTROLLER: Workspaces Router */}
      <main className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 text-left">
        {/* Admin Router Title Header */}
        {activeAdminConsole && currentUser.role === 'superadmin' && (
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 no-print border-b border-slate-100 pb-3">
            <span className="uppercase tracking-widest text-[9px]">Administrative headquarters</span>
            <ArrowRight className="h-3 w-3 text-slate-350" />
            <span className="text-slate-800 font-extrabold text-sm text-amber-600">Enterprise Control Console</span>
          </div>
        )}

        {/* Standard View Controller Header */}
        {!activeAdminConsole && !activeCatalogMode && activeRecipe && (
          <div className="flex items-center justify-between no-print border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-400">
              <span className="uppercase tracking-widest text-[9px]">Technical Recipe</span>
              <ArrowRight className="h-3 w-3 text-slate-355" />
              <span className="text-slate-800 font-extrabold text-sm">{activeRecipe.name}</span>
            </div>

            <button
              onClick={() => {
                setActiveCatalogMode(true);
                setSelectedRecipeId(null);
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-3 py-1.5 bg-indigo-50/50 border border-indigo-100 rounded-lg cursor-pointer transition"
            >
              Manage Ingredients Catalog
            </button>
          </div>
        )}

        {!activeAdminConsole && activeCatalogMode && (
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 no-print border-b border-slate-100 pb-3">
            <span className="uppercase tracking-widest text-[9px]">Cost Center</span>
            <ArrowRight className="h-3 w-3 text-slate-350" />
            <span className="text-slate-800 font-extrabold text-sm text-indigo-600">Unified Catalog & List Prices</span>
          </div>
        )}

        {/* Dynamic Admin Console Component Panel */}
        {activeAdminConsole && currentUser.role === 'superadmin' && (
          <div className="animate-fadeIn">
            <EnterpriseAdminConsole
              tenants={tenants}
              setTenants={setTenants}
              usersList={usersList}
              setUsersList={setUsersList}
              currentUser={currentUser}
            />
          </div>
        )}

        {/* Dashboard Welcomer Summary Panel */}
        {!activeAdminConsole && !activeRecipe && !activeCatalogMode && (
          <div className="space-y-6 no-print">
            <div className="p-8 bg-slate-900 rounded-3xl text-slate-100 border border-slate-800 relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-5 transform translate-x-12 -translate-y-12 scale-150">
                <Wine className="h-64 w-64" />
              </div>

              <div className="max-w-xl space-y-3.5 relative z-10">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xxs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 uppercase tracking-wider">
                  <Sparkles className="h-3 w-3" />
                  Corporate Costing Standards
                </span>
                <h2 className="text-2xl font-black font-sans tracking-tight text-white uppercase">
                  Multi-Venue Formula Audit and Control Sheet
                </h2>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Welcome to the F&B cost auditing workplace. Register raw commercial items in grams/ounces, synthesize reusable house infusions or sub-recipes (such as simple syrups, purées), and construct complete costed signature beverages. View historical variances and save print-ready PDFs.
                </p>

                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setInitialIngredientsSelection([]);
                      setNewRecipeTenant(adminViewTenantId === 'all' ? 'global' : adminViewTenantId);
                      setShowAddRecipeModal(true);
                    }}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer"
                  >
                    Create New Recipe
                  </button>
                  <button
                    onClick={() => setActiveCatalogMode(true)}
                    className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-755 text-slate-200 rounded-lg transition cursor-pointer border border-slate-700"
                  >
                    Edit Ingredient Catalog
                  </button>
                  {currentUser.role === 'superadmin' && (
                    <button
                      onClick={handleResetDemoData}
                      className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg transition cursor-pointer"
                    >
                      Restablecer Datos Demo (HQ)
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
                <div className="p-3 bg-slate-50 text-slate-800 rounded-xl">
                  <Wine className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scoped Recipes</div>
                  <div className="text-2xl font-black text-slate-800 mt-1 font-mono">{visibleRecipes.length}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Under current view scope</div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
                <div className="p-3 bg-slate-50 text-slate-855 rounded-xl">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">Scoped Ingredients</div>
                  <div className="text-2xl font-black text-indigo-600 mt-1 font-mono">{visibleIngredients.length}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Ready to form dose lines</div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
                <div className="p-3 bg-slate-50 text-slate-800 rounded-xl">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Heaviest Batch Drink</div>
                  <div className="text-sm font-bold text-slate-850 mt-1 truncate max-w-[150px]">
                    {statisticsObj.highestCostingRecipeName}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold font-mono">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 2
                    }).format(statisticsObj.highestCostingVal)} / batch
                  </div>
                </div>
              </div>
            </div>

            {/* Empty Recipe Selector Prompt */}
            <div className="text-center p-12 bg-white border border-dashed border-slate-200 rounded-2xl space-y-3">
              <FolderOpen className="h-8 w-8 text-slate-300 mx-auto" />
              <div className="max-w-xs mx-auto space-y-1">
                <h4 className="font-bold text-slate-700 text-sm">Select or Create a Form Sheet</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Choose a signature cocktail or house syrup base from the left side panel to adjust ingredient concentrations, calculate batch yields, or audit side-by-side cost updates.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Master Catalog Mode Panel Rendering */}
        {!activeAdminConsole && activeCatalogMode && (
          <div className="no-print">
            <IngredientCatalog
              ingredients={ingredients}
              onUpdateIngredients={handleUpdateIngredients}
              currentUser={currentUser} // Pass credentials down for tenant-based client locks!
              tenants={tenants}
              onRestoreDemoData={handleResetDemoData}
            />
          </div>
        )}

        {/* Costing calculation Workspace Pane Rendering */}
        {!activeAdminConsole && !activeCatalogMode && activeRecipe && (
          <RecipeCostingWorkspace
            recipe={activeRecipe}
            recipes={recipes} // Provide references to search sub-recipes
            masterIngredients={ingredients}
            onUpdateRecipe={handleUpdateRecipe}
            onDeleteRecipe={(rec) => setRecipeToDelete({ id: rec.id, name: rec.name })}
            currentUser={currentUser}
            tenants={tenants}
            key={activeRecipe.id} // force refresh on switch
          />
        )}
      </main>

      {/* --- WORKSPACE CREATION FORM WIZARD DIALOG --- */}
      {showAddRecipeModal && (
        <div className="fixed inset-0 bg-slate-950/45 flex items-center justify-center p-4 z-50 animate-fadeIn animate-duration-150" id="add-recipe-modal">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-lg w-full space-y-5 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2">
                <Bookmark className="h-5 w-5 text-indigo-500" />
                New Recipe Form
              </h3>
              <button
                onClick={() => setShowAddRecipeModal(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewRecipe} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Commercial Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Simple Syrup, Mojito"
                    value={newRecipeName}
                    onChange={(e) => setNewRecipeName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Recipe Type *</label>
                  <select
                    value={newRecipeType}
                    onChange={(e) => setNewRecipeType(e.target.value as 'bebida' | 'sub_receta')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium font-sans"
                  >
                    <option value="bebida">🍹 Final Cocktail / Drink</option>
                    <option value="sub_receta">⭐ Sub-Recipe / Base Syrup</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Description / Preparation Steps</label>
                <textarea
                  placeholder="e.g., Heat and stir sugar in water. Let cool. Maintain refrigerated."
                  value={newRecipeDesc}
                  onChange={(e) => setNewRecipeDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 text-slate-800"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Estimated Net Yield Value *</label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    value={newRecipeYieldVal}
                    onChange={(e) => setNewRecipeYieldVal(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Yield Unit *</label>
                  <select
                    value={newRecipeYieldUnit}
                    onChange={(e) => setNewRecipeYieldUnit(e.target.value as YieldUnit)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-805 bg-white bg-transparent"
                  >
                    <option value="ml">ml (Milliliters)</option>
                    <option value="l">L (Liters)</option>
                    <option value="fl_oz">fl oz (Fluid Ounces)</option>
                    <option value="porciones">servings</option>
                    <option value="botellas">bottles</option>
                    <option value="batch">batch</option>
                    <option value="g">grams (g)</option>
                  </select>
                </div>
              </div>

              {/* Assignment if Superadmin */}
              {currentUser.role === 'superadmin' && (
                <div>
                  <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Owner Establishment (Superadmin Scope) *</label>
                  <select
                    value={newRecipeTenant}
                    onChange={(e) => setNewRecipeTenant(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 bg-transparent bg-white"
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ingredients pre-fill select list */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Initial Ingredients to Pre-populate (Optional)
                </label>
                <div className="max-h-24 overflow-y-auto border border-slate-200 rounded-xl p-2.5 space-y-1 bg-slate-50/30">
                  {prefillSelectorOptions.length === 0 ? (
                    <div className="text-slate-400 text-center py-2 text-[10px]">No ingredients available yet. Register some in the catalog first.</div>
                  ) : (
                    prefillSelectorOptions.map((opt) => {
                      const isChecked = initialIngredientsSelection.includes(opt.id);
                      return (
                        <label key={opt.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setInitialIngredientsSelection(initialIngredientsSelection.filter(i => i !== opt.id));
                              } else {
                                setInitialIngredientsSelection([...initialIngredientsSelection, opt.id]);
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span className="text-slate-700 font-medium font-sans">{opt.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRecipeModal(false)}
                  className="px-4 py-1.5 border border-slate-250 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-755 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
                >
                  Create Recipe & v1
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom React-Based Delete Recipe Confirmation Modal */}
      {recipeToDelete && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-fadeIn animate-duration-150" id="delete-recipe-modal">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-sm w-full space-y-5 text-left transform transition-all duration-200 scale-100">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl font-sans inline-flex">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">
                Delete Recipe Batch?
              </h3>
            </div>
            
            <p className="text-slate-500 text-xs leading-normal font-sans">
              Are you sure you want to delete the recipe <strong className="text-slate-800">"{recipeToDelete.name}"</strong>? This action cannot be undone and will erase all associated formula cost versions.
            </p>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 font-sans">
              <button
                type="button"
                onClick={() => setRecipeToDelete(null)}
                className="px-4 py-1.5 border border-slate-250 hover:bg-slate-55 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRecipe}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
