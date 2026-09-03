import { Types } from "mongoose";
import httpStatus from "http-status";
import AppError from "../errors/AppError";
import { User } from "../modules/user/user.model";


/**
 * Checks if a user is a participant of a given conversation.
 * Throws an AppError if not.
 */
export const checkConversationParticipant = async (
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId
) => {
    const conversation = await Conversation.findOne({
        _id: conversationId,
        isDeleted: false,
    });

    if (!conversation) {
        throw new AppError(httpStatus.NOT_FOUND, "Conversation not found");
    }

    const isParticipant = conversation.participants.some(
        (participantId) => participantId.toString() === userId.toString()
    );

    if (!isParticipant) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "Access denied. You are not a participant of this conversation."
        );
    }

    return conversation;
};

/**
 * Resolves user _id from authenticated email.
 */
export const getUserIdFromUserPayload = async (email: string) => {
    const user = await User.findOne({ email, isDeleted: false });
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, "Authenticated user not found");
    }
    return user._id;
};