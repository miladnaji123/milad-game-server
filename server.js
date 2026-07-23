const express = require("express");
const path = require("path");

const app = express();

// Render پورت را از متغیر PORT می‌دهد
const PORT = process.env.PORT || 10000;

// فایل‌های پروژه را از پوشه اصلی سرو می‌کند
app.use(express.static(__dirname));

// مسیر اصلی سایت
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// تست سلامت سرور
app.get("/health", (req, res) => {
    res.status(200).send("Milad Game Server is running!");
});

// اجرای سرور
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Milad Game Server running on port ${PORT}`);
});
