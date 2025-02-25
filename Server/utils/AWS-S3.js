import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
dotenv.config();

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const s3 = new S3Client({
  region,
  accessKeyId,
  secretAccessKey,
});

const getContentType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream"; // Default for unknown types
};

export const uploadFileToS3 = async (fileBuffer, fileName) => {
  const contentType = getContentType(fileName);

  const params = {
    Bucket: bucketName,
    Key: fileName, // Dynamic file name
    Body: fileBuffer, // Image buffer
    ContentType: contentType,
  };

  try {
    const command = new PutObjectCommand(params);
    const response = await s3.send(command);

    // Construct the image URL using the S3 bucket and file name
    const imageUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;

    return { Location: imageUrl }; // Return the URL of the uploaded image
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
};

export const deleteFileFromS3 = async (fileKey) => {
  const params = {
    Bucket: bucketName,
    Key: fileKey, // File key in S3
  };

  try {
    const command = new DeleteObjectCommand(params);
    await s3.send(command);
    console.log(`Successfully deleted ${fileKey} from S3`);
    return { message: "File deleted successfully from S3" };
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw error;
  }
};
