const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get("/", (req, res) => {
    res.status(200).send("🎲 Milad Game Server is running!");
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        port: PORT
    });
});

io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("Player disconnected:", socket.id);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log("=================================");
    console.log("🎲 Milad Game Server Started");
    console.log("PORT:", PORT);
    console.log("Host: 0.0.0.0");
    console.log("=================================");
});