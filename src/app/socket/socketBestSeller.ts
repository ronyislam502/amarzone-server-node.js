import { getIO } from "./socket";

export const emitBestSellerUpdated = (productId: string, isBestSeller: boolean) => {
  try {
    const io = getIO();
    io.emit("best-seller-updated", { productId, isBestSeller });
  } catch (error) {
    console.error("[Socket BestSeller] Failed to emit best seller update:", error);
  }
};

export const emitCategoryBestSellerUpdated = (categoryId: string, bestSellerProducts: string[]) => {
  try {
    const io = getIO();
    io.emit("category-best-seller-updated", { categoryId, bestSellerProducts });
  } catch (error) {
    console.error("[Socket BestSeller] Failed to emit category best seller update:", error);
  }
};
