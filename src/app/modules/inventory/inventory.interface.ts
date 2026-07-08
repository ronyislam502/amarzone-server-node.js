import { Types } from "mongoose"

export type TSeller = {
    vendor: Types.ObjectId;
    price: number;
    quantity: number,
    isStock: boolean;
    fulfillmentBy: string;
    shippingTime: number;
    isBuyBoxWinner?: boolean;
}


export type TListProduct = {
    product: Types.ObjectId;
    asin: string;
    seller: TSeller;
    isDeleted: boolean;
}