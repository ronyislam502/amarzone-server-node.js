import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import bcrypt from "bcrypt";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import { User } from "../app/modules/user/user.model";
import { Vendor } from "../app/modules/vendor/vendor.model";
import { USER_ROLE } from "../app/interface/common";

const NEW_PASSWORD = "vendor123";

async function updateVendorPasswords() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(dbUrl);
  console.log("Connected to MongoDB successfully.");

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
  console.log(`Hashing password "${NEW_PASSWORD}" with ${saltRounds} bcrypt salt rounds...`);
  const hashedPassword = await bcrypt.hash(NEW_PASSWORD, saltRounds);

  const isMatch = await bcrypt.compare(NEW_PASSWORD, hashedPassword);
  if (!isMatch) {
    throw new Error("Password hash verification failed!");
  }
  console.log("Password hash successfully verified.");

  // 1. Find all vendors in the Vendor collection
  const vendors = await Vendor.find({});
  console.log(`Found ${vendors.length} vendor documents in the Vendor collection.`);

  const vendorUserIds = vendors
    .map((v) => v.user)
    .filter((uid) => uid && mongoose.Types.ObjectId.isValid(uid.toString()))
    .map((uid) => uid.toString());

  const vendorEmails = vendors
    .map((v) => v.email?.trim().toLowerCase())
    .filter(Boolean);

  // 2. Find all User documents matching:
  // - role is VENDOR
  // - OR _id is in vendorUserIds
  // - OR email is in vendorEmails
  const vendorUsers = await User.find({
    $or: [
      { role: USER_ROLE.VENDOR },
      { _id: { $in: vendorUserIds } },
      { email: { $in: vendorEmails } },
    ],
  });

  console.log(`Found ${vendorUsers.length} user accounts belonging to vendors.`);

  if (vendorUsers.length === 0) {
    console.log("No vendor user accounts found in database.");
    await mongoose.disconnect();
    return;
  }

  // 3. Update password for every vendor user
  const userIdsToUpdate = vendorUsers.map((u) => u._id);

  const updateResult = await User.updateMany(
    { _id: { $in: userIdsToUpdate } },
    {
      $set: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
      },
    }
  );

  console.log(`Successfully updated ${updateResult.modifiedCount} vendor user password(s).`);

  // 4. Verification check on sample vendor users
  const sampleUser = await User.findById(userIdsToUpdate[0]);
  if (sampleUser) {
    const verified = await bcrypt.compare(NEW_PASSWORD, sampleUser.password);
    console.log(`Verification on vendor user (${sampleUser.email}): ${verified ? "SUCCESS [PASS]" : "FAILED [FAIL]"}`);
  }

  // Print summary of updated vendor users (email and role)
  console.log("\nSummary of updated vendor accounts:");
  vendorUsers.slice(0, 15).forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.email} (Role: ${u.role}, ID: ${u._id})`);
  });
  if (vendorUsers.length > 15) {
    console.log(`  ... and ${vendorUsers.length - 15} more vendor accounts.`);
  }

  console.log(`\nAll ${vendorUsers.length} vendor accounts now have the password: "${NEW_PASSWORD}"`);

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
}

updateVendorPasswords().catch((err) => {
  console.error("Error updating vendor passwords:", err);
  process.exit(1);
});
