import { getIO } from "./socket";

export const emitBuyBoxUpdated = (productId: string, data: Record<string, unknown>) => {
  try {
    const io = getIO();
    io.emit("buy-box-updated", { productId, ...data });
  } catch (error) {
    console.error("[Socket BuyBox] Failed to emit buy box update:", error);
  }
};

export const emitPriceUpdated = (productId: string, sellerId: string, price: number) => {
  try {
    const io = getIO();
    io.emit("price-updated", { productId, sellerId, price });
  } catch (error) {
    console.error("[Socket BuyBox] Failed to emit price update:", error);
  }
};

export const emitInventoryUpdated = (productId: string, sellerId: string, quantity: number, isStock: boolean) => {
  try {
    const io = getIO();
    io.emit("inventory-updated", { productId, sellerId, quantity, isStock });
  } catch (error) {
    console.error("[Socket BuyBox] Failed to emit inventory update:", error);
  }
};
