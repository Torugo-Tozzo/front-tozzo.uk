export const CATEGORY_SEEDS = {
  HAMBURGUERIA: ['Lanches', 'Bebidas', 'Porções', 'Sobremesas'],
  PIZZARIA: ['Pizzas', 'Bebidas', 'Entradas', 'Sobremesas'],
  SORVETERIA: ['Sorvetes', 'Açaí', 'Coberturas', 'Bebidas'],
  CAFETERIA: ['Cafés', 'Bebidas', 'Salgados', 'Doces'],
  LANCHONETE: ['Lanches', 'Bebidas', 'Porções', 'Doces'],
  OUTRO: ['Produtos', 'Bebidas', 'Serviços', 'Outros'],
} as const

export type EstablishmentCategory = keyof typeof CATEGORY_SEEDS

export const ESTABLISHMENT_CATEGORIES: EstablishmentCategory[] = [
  'HAMBURGUERIA',
  'PIZZARIA',
  'SORVETERIA',
  'CAFETERIA',
  'LANCHONETE',
  'OUTRO',
]
