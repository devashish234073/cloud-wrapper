const express = require('express');
const path = require('path');
const fs = require('fs');
const objectStore = require('./objectStore');
const user = require('./user');
const region = require('./region');
const ai = require('./ai');
const compute = require('./compute');
const launchCmdRouter = require('./launchCmd');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });


// API Routes
app.use('/api/objectStore', objectStore.router);
app.use('/api/user', user);
app.use('/api/region', region);
app.use('/api/ai', ai);
app.use('/api/compute', compute);
app.use('/api/launch-cmd', launchCmdRouter);

app.post("/api/upload", upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  res.json({ videoUrl: "/uploads/" + req.file.filename });
});

// UI Route
app.get('/ui/objectStore', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ui', 'objectStore.html'));
});
app.get('/ui/ai', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ui', 'ai.html'));
});
app.get('/ui/compute', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ui', 'compute.html'));
});
app.get('/ui/multi-ai', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ui', 'multi-ai.html'));
});
app.get('/ui/multi-ai-v2', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ui', 'multi-ai-v2.html'));
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ui', 'home.html'));
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});