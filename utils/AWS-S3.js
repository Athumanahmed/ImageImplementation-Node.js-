import S3 from "aws-sdk/clients/s3";
import dotenv from "dotenv";
dotenv.config();

// aws configuration
const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const s3 = new S3({});
