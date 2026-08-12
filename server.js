const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

const allowedOrigins = [
    "https://miladnaji123.github.io",
    "https://milad-game-server.onrender.com",
    "http://localhost:3000",
    "http://localhost:5500"
];

app.use(
    cors({
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    })
);

app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

// صفحه اصلی سرور
app.get("/", (req, res) => {
    res.status(200).send(`
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Milad Game Server</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 50px;
                    background: #f5f5f5;
                }

                .box {
                    max-width: 500px;
                    margin: auto;
                    padding: 30px;
                    background: white;
                    border-radius: 15px;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                }

                h1 {
                    color: #222;
                }

                .ok {
                    color: green;
                    font-weight: bold;
                }
            </style>
        </head>

        <body>
            <div class="box">
                <h1>🎲 Milad Game Server</h1>
                <p class="ok">✅ سرور با موفقیت فعال است</p>
                <p>Socket.IO آماده دریافت بازیکنان است.</p>
                <p>Server Port: ${PORT}</p>
            </div>
        </body>
        </html>
    `);
});

// بررسی سلامت سرور
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Milad Game Server is running!",
        time: new Date().toISOString()
    });
});

// اتاق‌های بازی
const rooms = new Map();

// ساخت کد ۶ رقمی اتاق
function createRoomCode() {
    let code;

    do {
        code = Math.floor(
            100000 + Math.random() * 900000
        ).toString();
    } while (rooms.has(code));

    return code;
}

// اتصال بازیکن
io.on("connection", (socket) => {

    console.log("Player connected:", socket.id);

    // ساخت اتاق
    socket.on("createRoom", () => {

        const roomCode = createRoomCode();

        rooms.set(roomCode, {
            players: [socket.id],
            createdAt: Date.now()
        });

        socket.join(roomCode);
        socket.roomCode = roomCode;

        socket.emit("roomCreated", {
            roomCode: roomCode
        });

        console.log(
            "Room created:",
            roomCode
        );
    });

    // ورود به اتاق
    socket.on("joinRoom", (roomCode) => {

        roomCode = String(
            roomCode || ""
        ).trim();

        const room = rooms.get(roomCode);

        if (!room) {

            socket.emit("joinError", {
                message: "اتاق پیدا نشد."
            });

            return;
        }

        if (room.players.length >= 2) {

            socket.emit("joinError", {
                message: "این اتاق پر است."
            });

            return;
        }

        room.players.push(socket.id);

        socket.join(roomCode);
        socket.roomCode = roomCode;

        socket.emit("joinedRoom", {
            roomCode: roomCode
        });

        io.to(roomCode).emit(
            "playersUpdate",
            {
                players: room.players.length
            }
        );

        if (room.players.length === 2) {

            io.to(roomCode).emit(
                "gameReady",
                {
                    message:
                        "هر دو بازیکن وارد شدند. بازی آماده است."
                }
            );
        }

        console.log(
            "Player joined:",
            socket.id,
            "Room:",
            roomCode
        );
    });

    // ارسال حرکت بازی
    socket.on("gameMove", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        socket
            .to(roomCode)
            .emit("gameMove", data);
    });

    // ارسال وضعیت کامل بازی
    socket.on("gameState", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        socket
            .to(roomCode)
            .emit("gameState", data);
    });

    // ارسال تاس
    socket.on("diceRolled", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        socket
            .to(roomCode)
            .emit("diceRolled", data);
    });

    // چت
    socket.on("chatMessage", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        const message = {
            text: String(
                data?.text || ""
            ).slice(0, 500),

            sender: socket.id,

            time: new Date().toISOString()
        };

        io.to(roomCode).emit(
            "chatMessage",
            message
        );
    });

    // قطع اتصال بازیکن
    socket.on("disconnect", () => {

        console.log(
            "Player disconnected:",
            socket.id
        );

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        const room = rooms.get(roomCode);

        if (!room) return;

        room.players = room.players.filter(
            id => id !== socket.id
        );

        io.to(roomCode).emit(
            "playerDisconnected"
        );

        if (room.players.length === 0) {

            rooms.delete(roomCode);

            console.log(
                "Room deleted:",
                roomCode
            );

        } else {

            io.to(roomCode).emit(
                "playersUpdate",
                {
                    players: room.players.length
                }
            );
        }
    });

});

// اجرای سرور
server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Milad Game Server running on port ${PORT}`
        );

    }
);
