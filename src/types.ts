/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WeightUnit = 'g' | 'kg' | 'lb' | 'oz';
export type VolumeUnit = 'ml' | 'l' | 'fl_oz';
export type CountableUnit = 'each' | 'u';
export type MeasurementUnit = WeightUnit | VolumeUnit | CountableUnit;

// Yield units for the final recipe output
export type YieldUnit = 'ml' | 'oz' | 'fl_oz' | 'g' | 'porciones' | 'botellas' | 'batch';

export interface Tenant {
  id: string;
  name: string;
  contactEmail?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'client';
  tenantId: string; // references Tenant.id. If 'global' / superadmin can view everything and administer
}

export interface MasterIngredient {
  id: string;
  name: string;
  baseCost: number;       // e.g., $15.000 COP
  baseQuantity: number;   // e.g., 2.5
  baseUnit: MeasurementUnit; // e.g., 'kg'
  density: number;        // g/ml (used when converting weight to volume, default 1.0)
  category: string;       // e.g., 'Licores', 'Siropos', 'Frutas', 'Otros'
  tenantId: string;       // Owner tenant, or 'global'
  sku?: string;           // Optional product SKU
  productUrl?: string;    // Optional product link / URL
}

export interface RecipeIngredient {
  id: string; // unique ID for this row
  ingredientId: string; // link to MasterIngredient.id OR another Recipe.id
  isSubRecipe?: boolean; // True if it references a sub-recipe instead of a standard ingredient
  quantity: number; // e.g., 45
  unit: MeasurementUnit; // unit used in the recipe (e.g., 'g', 'ml', 'oz', 'fl_oz')
}

export interface RecipeVersion {
  version: number;
  updatedAt: string; // ISO timestamp
  note: string; // e.g., "Ajuste de costo de azúcar" or "Creación inicial"
  ingredients: RecipeIngredient[];
  batchYieldValue: number; // manual net production amount
  batchYieldUnit: YieldUnit; // yield unit
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  type: 'bebida' | 'sub_receta'; // Whether this is a full ready drink or a multi-ingredient component (sub-recipe)
  currentVersion: number;
  versions: RecipeVersion[]; // sorted by version descending/ascending
  tenantId: string; // Owner tenant, or 'global'
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

