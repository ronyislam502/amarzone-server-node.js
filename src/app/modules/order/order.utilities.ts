import { Order } from "./order.model";

const findLastOrderNo = async (
  datePrefix: string
): Promise<string | undefined> => {
  const lastOrder = await Order.findOne(
    { orderNo: { $regex: `^${datePrefix}` } },
    { orderNo: 1, _id: 0 }
  )
    .sort({ orderNo: -1 })
    .lean();

  return lastOrder?.orderNo;
};

const generateOrderNo = async (): Promise<string> => {
  const today = new Date();

  const year = today.getFullYear().toString();
  const month = (today.getMonth() + 1).toString().padStart(2, "0");
  const date = today.getDate().toString().padStart(2, "0");

  const datePrefix = `${year}${month}${date}`;

  const lastOrderNo = await findLastOrderNo(datePrefix);

  let incrementNumber = 1;

  if (lastOrderNo) {
    const lastIncrementStr = lastOrderNo.substring(8);
    const lastIncrementNum = Number(lastIncrementStr);
    incrementNumber = lastIncrementNum + 1;
  }

  const incrementStr = incrementNumber.toString().padStart(4, "0");

  return `${datePrefix}${incrementStr}`;
};
