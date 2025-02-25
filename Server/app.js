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
import { uploadFileToS3, deleteFileFromS3 } from "./utils/AWS-S3.js";

dotenv.config();

const PORT = process.env.PORT || 8090;
const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ============= for local storage file using multer ================

// // Set up storage engine for Multer
// const storage = multer.diskStorage({
//   destination: "./ImageUploads/", // Folder where files will be saved
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname)); // Rename file
//   },
// });

// // Initialize Multer
// const upload = multer({
//   storage: storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file limit
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = /jpeg|jpg|png|pdf/;
//     const extName = allowedTypes.test(
//       path.extname(file.originalname).toLowerCase()
//     );
//     const mimeType = allowedTypes.test(file.mimetype);

//     if (extName && mimeType) {
//       return cb(null, true);
//     } else {
//       cb(new Error("Only images (jpeg, jpg, png, pdf) are allowed."));
//     }
//   },
// });

// // Serve static files (Uploaded images)
// app.use("/ImageUploads", express.static("ImageUploads"));

// ============= for local storage file using multer ================

// ============= for AWS S3 storage file using multer ================

const storage = multer.memoryStorage(); // Store file in memory
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

// ============= for AWS S3 storage file using multer ================

// Connect to MongoDB
ConnectDb();

//  local image upload routes

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

    // Upload file to S3
    const uploadedImage = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname
    );

    // Save image URL in database
    const image = new Image({
      imageName: req.file.originalname,
      imageUrl: uploadedImage.Location, // Use the URL returned from S3
    });

    await image.save();

    // Respond with the image URL
    res.status(201).json({
      message: "Image uploaded successfully",
      ImageUrl: uploadedImage.Location,
    });
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

// AWS S3 image upload routes

app.get("/api/s3/all-images", async (req, res) => {
  try {
    // Fetch all images from MongoDB
    const images = await Image.find();

    if (images.length === 0) {
      return res.status(404).json({ message: "No images found" });
    }

    res.status(200).json({
      message: "Retrieved images from S3 and database",
      images, // Send all images
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message:
        "Internal server error, Failed to retrieve images. Please try again later",
    });
  }
});

app.get("/api/s3/image/:id", async (req, res) => {
  try {
    const { id } = req.params; // Extract the image ID from the request

    // Find image by ID in MongoDB
    const image = await Image.findById(id);

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    res.status(200).json({
      message: "Image retrieved successfully",
      image,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message:
        "Internal server error, Failed to retrieve image. Please try again later",
    });
  }
});

app.post("/api/s3/upload-image", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Please upload an image" });
  }

  if (req.file.buffer.length === 0) {
    return res
      .status(400)
      .json({ message: "Empty file buffer, something went wrong" });
  }

  try {
    // Upload the file to S3
    const uploadedImage = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname
    );

    const imageUrl = uploadedImage.Location;

    // Save image to database
    const image = new Image({
      imageName: req.file.originalname, // Use originalname instead of filename
      imageUrl: imageUrl,
    });

    await image.save();

    // Send response after saving to database
    res.status(200).json({
      message: "Uploaded image to S3 and saved in database",
      imageUrl: imageUrl,
      imageName: req.file.originalname,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal server error, Please try again later" });
  }
});

app.delete("/api/s3/delete-image/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Find image in MongoDB
    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // Extract file key from image URL
    const imageUrl = image.imageUrl;
    const imageKey = imageUrl.split("/").pop(); // Get file name from URL

    // Delete file from S3
    await deleteFileFromS3(imageKey);

    // Delete image from MongoDB
    await Image.findByIdAndDelete(id);

    res
      .status(200)
      .json({ message: "Image successfully deleted from S3 and database" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message:
        "Internal server error, Failed to delete image. Please try again later",
    });
  }
});

//  routes
app.listen(PORT, () => {
  console.log("Server is running on port 8090");
});

export default app;
