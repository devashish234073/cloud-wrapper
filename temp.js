const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();

// store uploads in ./uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.static("public\\ui"));
app.use("/uploads", express.static("uploads")); // serve uploaded videos

// upload endpoint


app.listen(3000, () => console.log("Server running at http://localhost:3000"));
