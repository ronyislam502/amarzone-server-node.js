import { v2 as cloudinary } from "cloudinary";
import config from ".";

cloudinary.config({
  cloud_name: config.cloudinary_cloud_name,
  api_key: config.cloudinary_api_key,
  api_secret: config.cloudinary_api_secret,
});

export const cloudinaryUpload = cloudinary;


export const uploadPdfToCloudinary = (
  pdfBuffer: Buffer,
  fileName: string
): Promise<{ secure_url: string; public_id: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinaryUpload.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: "amarzone/invoices",
        public_id: `${fileName}.pdf`,
        format: "pdf",
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error("Failed to upload PDF to Cloudinary"));
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );
    uploadStream.end(pdfBuffer);
  });
};



