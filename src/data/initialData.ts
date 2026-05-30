/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MasterIngredient, Recipe } from '../types';

export const INITIAL_INGREDIENTS: MasterIngredient[] = [
  {
    id: 'ing-1',
    name: 'White Sugar',
    baseCost: 3.75,
    baseQuantity: 2.5,
    baseUnit: 'kg',
    density: 1.59, // g/ml
    category: 'Sweeteners',
    tenantId: 'global', // Available to everyone
  },
  {
    id: 'ing-2',
    name: 'Tahitian Lime (House Juice)',
    baseCost: 2.50,
    baseQuantity: 1000,
    baseUnit: 'ml',
    density: 1.03, // g/ml
    category: 'Citrus',
    tenantId: 'global', // Available to everyone
  },
  {
    id: 'ing-3',
    name: 'Absolut Premium Vodka',
    baseCost: 13.75,
    baseQuantity: 750,
    baseUnit: 'ml',
    density: 0.95, // g/ml
    category: 'Spirits',
    tenantId: 'global', // Available to everyone
  },
  {
    id: 'ing-4',
    name: 'Tanqueray Gin',
    baseCost: 21.25,
    baseQuantity: 750,
    baseUnit: 'ml',
    density: 0.94,
    category: 'Spirits',
    tenantId: 'global',
  },
  {
    id: 'ing-5',
    name: 'Purified Water',
    baseCost: 0.88,
    baseQuantity: 5,
    baseUnit: 'l',
    density: 1.0, // g/ml
    category: 'Others',
    tenantId: 'global', // Available to everyone
  },
  {
    id: 'ing-6',
    name: 'Specialty Coffee (Beans)',
    baseCost: 9.50,
    baseQuantity: 1,
    baseUnit: 'kg',
    density: 0.45,
    category: 'Coffee',
    tenantId: 'global', // Shared
  },
  {
    id: 'ing-7',
    name: 'Organic Agave Nectar',
    baseCost: 7.00,
    baseQuantity: 350,
    baseUnit: 'g',
    density: 1.4,
    category: 'Sweeteners',
    tenantId: 'rest-1', // Specific to El Atardecer
  },
  {
    id: 'ing-8',
    name: 'Angostura Bitters',
    baseCost: 11.25,
    baseQuantity: 100,
    baseUnit: 'ml',
    density: 0.98,
    category: 'Specials',
    tenantId: 'rest-2', // Specific to Speakeasy Jazz Club
  },
  {
    id: 'ing-9',
    name: 'Ceremonial Uji Matcha Powder',
    baseCost: 35.00,
    baseQuantity: 100,
    baseUnit: 'g',
    density: 0.45,
    category: 'Matcha',
    tenantId: 'thelastrawmatcha', // The Last Straw Matcha
  },
  {
    id: 'ing-10',
    name: 'Oat Milk (Barista Edition)',
    baseCost: 4.20,
    baseQuantity: 1,
    baseUnit: 'l',
    density: 1.03,
    category: 'Milks',
    tenantId: 'thelastrawmatcha',
  },
  {
    id: 'ing-11',
    name: 'Lavender Blossom Syrup',
    baseCost: 11.50,
    baseQuantity: 750,
    baseUnit: 'ml',
    density: 1.25,
    category: 'Siropos',
    tenantId: 'thelastrawmatcha',
  }
];

export const INITIAL_RECIPES: Recipe[] = [
  // --- SUB-RECIPES ---
  {
    id: 'rec-sub-1',
    name: 'Simple Syrup 1:1 (House)',
    description: 'Classic sugar syrup prepared in equal parts of purified water and sugar under hot temperature.',
    type: 'sub_receta',
    currentVersion: 1,
    tenantId: 'global', // Corporate standard sub-recipe
    versions: [
      {
        version: 1,
        updatedAt: '2026-05-20T08:00:00Z',
        note: 'Standard ratio of 1kg sugar + 1L water for a net yield of 1.6L.',
        batchYieldValue: 1600,
        batchYieldUnit: 'ml',
        ingredients: [
          {
            id: 'sub1-row-1',
            ingredientId: 'ing-1', // White Sugar
            quantity: 1,
            unit: 'kg',
          },
          {
            id: 'sub1-row-2',
            ingredientId: 'ing-5', // Purified Water
            quantity: 1,
            unit: 'l',
          }
        ]
      }
    ]
  },
  {
    id: 'rec-sub-2',
    name: 'Ginger & Lime Cordial',
    description: 'Spicy house cordial for signature cocktails.',
    type: 'sub_receta',
    currentVersion: 1,
    tenantId: 'rest-1', // Atardecer specific cordial
    versions: [
      {
        version: 1,
        updatedAt: '2026-05-25T14:20:00Z',
        note: 'Concentrated yield made using simple syrup and house lime juice.',
        batchYieldValue: 500,
        batchYieldUnit: 'ml',
        ingredients: [
          {
            id: 'sub2-row-1',
            ingredientId: 'rec-sub-1', // References nested sub-recipe
            isSubRecipe: true,
            quantity: 300,
            unit: 'ml',
          },
          {
            id: 'sub2-row-2',
            ingredientId: 'ing-2', // Tahitian Lime (House Juice)
            quantity: 200,
            unit: 'ml',
          }
        ]
      }
    ]
  },
  {
    id: 'rec-sub-3',
    name: 'Uji Matcha Pure Whisked Base',
    description: 'Highly concentrated, smooth whisked Ceremonial Matcha base for beverages.',
    type: 'sub_receta',
    currentVersion: 1,
    tenantId: 'thelastrawmatcha',
    versions: [
      {
        version: 1,
        updatedAt: '2026-05-29T23:00:00Z',
        note: 'Standard recipe whisking 4g Ceremonial Uji Matcha into 60ml warm water.',
        batchYieldValue: 60,
        batchYieldUnit: 'ml',
        ingredients: [
          {
            id: 'sub3-row-1',
            ingredientId: 'ing-9', // Ceremonial Uji Matcha Powder
            quantity: 4,
            unit: 'g',
          },
          {
            id: 'sub3-row-2',
            ingredientId: 'ing-5', // Purified Water
            quantity: 60,
            unit: 'ml',
          }
        ]
      }
    ]
  },

  // --- FINAL DRINKS (BEBIDAS) ---
  {
    id: 'rec-1',
    name: 'Imperial House Mojito',
    description: 'Premium cocktail crafted with fresh lime juice, refined gin, and sweetened with corporate Simple Syrup.',
    type: 'bebida',
    currentVersion: 2,
    tenantId: 'global',
    versions: [
      {
        version: 2,
        updatedAt: '2026-05-29T22:45:00Z',
        note: 'Adjusted Gin dosage and integrated House Simple Syrup to standardize costs.',
        batchYieldValue: 350,
        batchYieldUnit: 'ml',
        ingredients: [
          {
            id: 'row-1',
            ingredientId: 'ing-4', // Tanqueray Gin
            quantity: 60,
            unit: 'ml',
          },
          {
            id: 'row-2',
            ingredientId: 'ing-2', // Tahitian Lime (House Juice)
            quantity: 45,
            unit: 'ml',
          },
          {
            id: 'row-3',
            ingredientId: 'rec-sub-1', // References Sub-recipe! Almíbar simple 1:1
            isSubRecipe: true,
            quantity: 30, // 30 ml of our house syrup
            unit: 'ml',
          },
          {
            id: 'row-4',
            ingredientId: 'ing-5', // Purified Water
            quantity: 215,
            unit: 'ml',
          }
        ],
      },
      {
        version: 1,
        updatedAt: '2026-05-15T18:00:00Z',
        note: 'Original creation directly using raw granulated sugar (no syrup sub-recipe).',
        batchYieldValue: 300,
        batchYieldUnit: 'ml',
        ingredients: [
          {
            id: 'row-1-v1',
            ingredientId: 'ing-4',
            quantity: 45,
            unit: 'ml',
          },
          {
            id: 'row-2-v1',
            ingredientId: 'ing-2',
            quantity: 30,
            unit: 'ml',
          },
          {
            id: 'row-3-v1',
            ingredientId: 'ing-1', // Raw White Sugar
            quantity: 30,
            unit: 'g',
          },
          {
            id: 'row-4-v1',
            ingredientId: 'ing-5',
            quantity: 195,
            unit: 'ml',
          }
        ],
      }
    ],
  },
  {
    id: 'rec-2',
    name: 'Specialty Gin & Tonic',
    description: 'Signature drink featuring a double shot of floating specialty coffee espresso over Tanqueray Gin.',
    type: 'bebida',
    currentVersion: 1,
    tenantId: 'rest-2', // Speakeasy specific
    versions: [
      {
        version: 1,
        updatedAt: '2026-05-20T10:30:00Z',
        note: 'Signature coffee cocktail served at the jazz lounge.',
        batchYieldValue: 280,
        batchYieldUnit: 'ml',
        ingredients: [
          {
            id: 'gnt-row-1',
            ingredientId: 'ing-4', // Tanqueray Gin
            quantity: 50,
            unit: 'ml',
          },
          {
            id: 'gnt-row-2',
            ingredientId: 'ing-6', // Specialty Coffee (Beans)
            quantity: 18,
            unit: 'g',
          },
          {
            id: 'gnt-row-3',
            ingredientId: 'ing-5', // Purified Water (ice / espresso extraction)
            quantity: 212,
            unit: 'ml',
          }
        ],
      }
    ],
  },
  {
    id: 'rec-3',
    name: 'Lavender Blossom Matcha Latte',
    description: 'Beautiful, layered signature recipe. Whisked ceremonial Japanese matcha over cold velvet barista oat milk with organic lavender sweetener.',
    type: 'bebida',
    currentVersion: 1,
    tenantId: 'thelastrawmatcha',
    versions: [
      {
        version: 1,
        updatedAt: '2026-05-29T23:05:00Z',
        note: 'Original formulation for "The Last Straw Matcha" launch menu.',
        batchYieldValue: 350,
        batchYieldUnit: 'ml',
        ingredients: [
          {
            id: 'matcha-row-1',
            ingredientId: 'rec-sub-3', // Whisked matcha base
            isSubRecipe: true,
            quantity: 60,
            unit: 'ml',
          },
          {
            id: 'matcha-row-2',
            ingredientId: 'ing-10', // Oat milk
            quantity: 260,
            unit: 'ml',
          },
          {
            id: 'matcha-row-3',
            ingredientId: 'ing-11', // Lavender syrup
            quantity: 30,
            unit: 'ml',
          }
        ]
      }
    ]
  }
];
