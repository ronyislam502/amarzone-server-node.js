import { Product } from "../modules/product/product.model";

const toCode = (name: string) =>
    name
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 2);

const generateUniquePart = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from(
        { length: 6 },
        () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
};

export const generateASIN = async (
    department: string,
    category: string
): Promise<string> => {
    const deptCode = toCode(department);
    const catCode = toCode(category);

    let asin: string;

    do {
        asin = `${deptCode}${catCode}${generateUniquePart()}`; // ELMO + 6-char random
    } while (await Product.exists({ asin }));

    return asin;
};