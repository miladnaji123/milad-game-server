const express = require("express");
const http = require("http");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
    res.status(200).send("🎲 Milad Game Server is ONLINE!");
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Milad Game Server is running"
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log("🎲 Milad Game Server Started");
    console.log("PORT:", PORT);
});
