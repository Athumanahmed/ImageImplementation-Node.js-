import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// MongoDB Connection
export const ConnectDb = async () => {
  mongoose
    .connect(process.env.MONGO_URI_LOCALLY)
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.error("MongoDB Connection Error:", err));
};
