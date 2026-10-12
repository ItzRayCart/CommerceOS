export const productCollections = ['premium', 'hot', 'best-selling'] as const;
export type ProductCollection = (typeof productCollections)[number];
