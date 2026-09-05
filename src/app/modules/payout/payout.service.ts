import { Payout } from "./payout.model";

const createPayoutRequest = async (payload: any) => {
    const newPayoutRequest = await Payout.create(payload);
    return newPayoutRequest;
};

const getAllPayoutRequests = async (query: Record<string, unknown>) => {
    const payouts = await Payout.find().populate("vendor");
    return payouts;
};

export const PayoutServices = {
    createPayoutRequest,
    getAllPayoutRequests
}