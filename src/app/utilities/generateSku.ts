import { TVariantAttribute } from "../modules/variant/variant.interface";

export const generateSKU = (asin: string, attributes?: TVariantAttribute[]): string => {
    const attributesString = attributes && attributes.length > 0
        ? attributes.map((a) => a.value.substring(0, 3).toUpperCase()).join("-")
        : "GEN";

    return `${asin}-${attributesString}`;
};
