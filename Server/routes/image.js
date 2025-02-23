import express from "express";

const router = express.Router();

router.get("/all-images", (req, res) => {
  res.json({ message: "All images" });
});

router.post("/upload-image", (req, res) => {
  res.send("Upload image");
});

router.get("/image/:id", (req, res) => {
  res.send("Get image");
});

router.put("/update-image/:id", (req, res) => {
  res.send("Update image");
});

router.delete("/delete-image/:id", (req, res) => {
  res.send("Delete image");
});

export default router;
