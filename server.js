const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Render خودش PORT را تعیین می‌کند
const PORT = process.env.PORT || 10000;

const allowedOrigins = [
    "https://miladnaji123.github.io",
    "http://localhost:3000",
    "http://localhost:5500"
];

// ==============================
// CORS
// ==============================

app.use(cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"]
}));

app.use(express.json());

// ==============================
// Socket.IO
// ==============================

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

// ==============================
// تست سرور
// ==============================

app.get("/", (req, res) => {
    res.status(200).send(`
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Milad Game Server</title>
        </head>
        <body>
            <h1>🎲 Milad Game Server</h1>
            <p>✅ سرور با موفقیت فعال است</p>
            <p>🔌 Socket.IO آماده دریافت بازیکنان است.</p>
            <p>🌐 Port: ${PORT}</p>
        </body>
        </html>
    `);
});

// ==============================
// Health Check
// ==============================

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Milad Game Server is running!",
        time: new Date().toISOString()
    });
});

// ==============================
// اتاق‌ها
// ==============================

const rooms = new Map();

// ساخت کد ۶ رقمی
function createRoomCode() {
    let code;

    do {
        code = Math.floor(
            100000 + Math.random() * 900000
        ).toString();
    } while (rooms.has(code));

    return code;
}

// ==============================
// اتصال بازیکن
// ==============================

io.on("connection", (socket) => {

    console.log("🟢 Player connected:", socket.id);

    // ==========================
    // ساخت اتاق
    // ==========================

    socket.on("createRoom", () => {

        const roomCode = createRoomCode();

        rooms.set(roomCode, {
            players: [socket.id],
            gameState: null,
            createdAt: Date.now()
        });

        socket.join(roomCode);

        socket.roomCode = roomCode;
        socket.playerIndex = 0;

        socket.emit("roomCreated", {
            roomCode: roomCode
        });

        io.to(roomCode).emit("playersUpdate", {
            players: 1
        });

        console.log("🏠 Room created:", roomCode);
    });

    // ==========================
    // ورود به اتاق
    // ==========================

    socket.on("joinRoom", (code) => {

        const roomCode = String(code || "").trim();

        const room = rooms.get(roomCode);

        if (!room) {

            socket.emit("joinError", {
                message: "❌ اتاق پیدا نشد."
            });

            return;
        }

        if (room.players.length >= 2) {

            socket.emit("joinError", {
                message: "❌ این اتاق پر است."
            });

            return;
        }

        room.players.push(socket.id);

        socket.join(roomCode);

        socket.roomCode = roomCode;
        socket.playerIndex = 1;

        socket.emit("joinedRoom", {
            roomCode: roomCode
        });

        io.to(roomCode).emit("playersUpdate", {
            players: room.players.length
        });

        console.log(
            "👤 Player joined:",
            roomCode,
            socket.id
        );

        // ==========================
        // شروع بازی
        // ==========================

        if (room.players.length === 2) {

            room.gameState = {
                board: [
                    2, 0, 0, 0, 0, -5,
                    0, -3, 0, 0, 0, 5,
                    -5, 0, 0, 0, 3, 0,
                    5, 0, 0, 0, 0, -2
                ],

                dice: [0, 0],

                remainingDice: [],

                turn: 0
            };

            io.to(roomCode).emit("gameReady", {
                message:
                    "🎲 هر دو بازیکن وارد شدند. بازی آماده است."
            });

            io.to(roomCode).emit(
                "gameState",
                room.gameState
            );

            console.log(
                "🎮 Game ready:",
                roomCode
            );
        }
    });

    // ==========================
    // تاس
    // ==========================

    socket.on("diceRolled", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        const room = rooms.get(roomCode);

        if (!room) return;

        if (
            !Array.isArray(data?.dice) ||
            data.dice.length !== 2
        ) {
            return;
        }

        const d1 = Number(data.dice[0]);
        const d2 = Number(data.dice[1]);

        if (
            d1 < 1 || d1 > 6 ||
            d2 < 1 || d2 > 6
        ) {
            return;
        }

        io.to(roomCode).emit("diceRolled", {
            dice: [d1, d2],
            player: socket.playerIndex
        });

        console.log(
            "🎲 Dice:",
            roomCode,
            d1,
            d2
        );
    });

    // ==========================
    // وضعیت بازی
    // ==========================

    socket.on("gameState", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        const room = rooms.get(roomCode);

        if (!room) return;

        room.gameState = {

            board:
                Array.isArray(data?.board)
                    ? data.board
                    : room.gameState?.board || [],

            dice:
                Array.isArray(data?.dice)
                    ? data.dice
                    : [0, 0],

            remainingDice:
                Array.isArray(data?.remainingDice)
                    ? data.remainingDice
                    : [],

            turn:
                Number.isInteger(data?.turn)
                    ? data.turn
                    : 0
        };

        socket.to(roomCode).emit(
            "gameState",
            room.gameState
        );
    });

    // ==========================
    // حرکت مهره
    // ==========================

    socket.on("gameMove", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        const room = rooms.get(roomCode);

        if (!room) return;

        socket.to(roomCode).emit(
            "gameMove",
            data
        );

        console.log(
            "♟️ Game move:",
            roomCode
        );
    });

    // ==========================
    // چت
    // ==========================

    socket.on("chatMessage", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        const text = String(
            data?.text || ""
        )
            .trim()
            .slice(0, 500);

        if (!text) return;

        io.to(roomCode).emit(
            "chatMessage",
            {
                text: text,

                sender: socket.id,

                player:
                    socket.playerIndex,

                time:
                    new Date().toISOString()
            }
        );
    });

    // ==========================
    // قطع اتصال
    // ==========================

    socket.on("disconnect", () => {

        console.log(
            "🔴 Player disconnected:",
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
                "🗑️ Room deleted:",
                roomCode
            );

        } else {

            io.to(roomCode).emit(
                "playersUpdate",
                {
                    players:
                        room.players.length
                }
            );

            console.log(
                "👤 Remaining player:",
                room.players[0]
            );
        }
    });

});

// ==============================
// شروع سرور
// ==============================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================="
        );

        console.log(
            "🎲 Milad Game Server Started"
        );

        console.log(
            "PORT from Render:",
            process.env.PORT
        );

        console.log(
            "Using PORT:",
            PORT
        );

        console.log(
            "Host: 0.0.0.0"
        );

        console.log(
            "================================="
        );
    }
);