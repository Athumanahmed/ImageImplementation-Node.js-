import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import imageRouter from "./routes/image.js";
import cors from "cors";
import multer from "multer";
import path from "path";
import { ConnectDb } from "./config/Db.js";
import Image from "./models/Image.models.js";
import fs from "fs";
dotenv.config();

const PORT = process.env.PORT || 8090;
const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set up storage engine for Multer
const storage = multer.diskStorage({
  destination: "./ImageUploads/", // Folder where files will be saved
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Rename file
  },
});

// Initialize Multer
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extName = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimeType = allowedTypes.test(file.mimetype);

    if (extName && mimeType) {
      return cb(null, true);
    } else {
      cb(new Error("Only images (jpeg, jpg, png, pdf) are allowed."));
    }
  },
});

// Serve static files (Uploaded images)
app.use("/ImageUploads", express.static("ImageUploads"));

// Connect to MongoDB
ConnectDb();

//  routes

app.get("/api/all-images", async (req, res) => {
  try {
    const images = await Image.find().sort({ uploadedAt: -1 });
    res.status(200).json({
      message: "Images retrieved successfully",
      Images: images,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message:
        "Internal server error,Failed to retrieve images. Please try again later",
    });
  }
});

app.post("/api/upload-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload an image" });
    }

    const fileUrl = `http://localhost:8090/ImageUploads/${req.file.filename}`;
    res.status(201).json({
      message: "Image uploaded",
      ImageUrl: fileUrl,
    });

    // Save image to database
    const image = new Image({
      imageName: req.file.filename,
      imageUrl: fileUrl,
    });

    await image.save();
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal server error, Please try again later" });
  }
});

app.get("/api/image/:id", async (req, res) => {
  try {
    const image = await Image.findById(req.params.id).lean(); // ✅ Add `await`

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    res.status(200).json({ message: "Image found", image });
  } catch (error) {
    console.error("Error fetching image:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.put("/api/update-image/:id", upload.single("image"), async (req, res) => {
  try {
    // 1️⃣ Find the existing image by ID
    const image = await Image.findById(req.params.id);

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // 2️⃣ Delete the old image file from storage
    const oldFilePath = `./ImageUploads/${image.imageName}`;
    fs.unlink(oldFilePath, (err) => {
      if (err) {
        console.error("Error deleting old file:", err);
      }
    });

    // 3️⃣ Check if a new image file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: "Please upload a new image" });
    }

    // 4️⃣ Update the image record in MongoDB
    const newFileUrl = `http://localhost:8090/ImageUploads/${req.file.filename}`;

    image.imageName = req.file.filename;
    image.imageUrl = newFileUrl;
    await image.save();

    res.status(200).json({
      message: "Image updated successfully",
      image: {
        id: image._id,
        imageUrl: newFileUrl,
      },
    });
  } catch (error) {
    console.error("Error updating image:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.delete("/api/delete-image/:id", async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // Delete the image file from the uploads folder
    const filePath = `./ImageUploads/${image.imageName}`;

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return res.status(500).json({ message: "Failed to delete file" });
      }
    });

    // Remove image document from the database
    await Image.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

//  routes
app.listen(PORT, () => {
  console.log("Server is running on port 8090");
});

export default app;
