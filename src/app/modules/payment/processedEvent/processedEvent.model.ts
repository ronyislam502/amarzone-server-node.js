import { Schema, model } from "mongoose";
import { IProcessedEvent } from "./processedEvent.interface";

const processedEventSchema = new Schema<IProcessedEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: "7d", // TTL index to automatically clean up processed events after 7 days
    },
  }
);

export const ProcessedEvent = model<IProcessedEvent>("ProcessedEvent", processedEventSchema);
