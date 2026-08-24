const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

// ===============================
// CORS
// ===============================

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"]
}));

app.use(express.json());

// ===============================
// SOCKET.IO
// ===============================

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ["websocket", "polling"]
});

// ===============================
// TEST ROUTES
// ===============================

app.get("/", (req, res) => {
    res.status(200).send("🎲 Milad Game Server is running!");
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Milad Game Server is running",
        time: new Date().toISOString()
    });
});

app.get("/health1", (req, res) => {
    res.status(200).send("OK");
});

// ===============================
// ROOMS
// ===============================

const rooms = new Map();

function createRoomCode() {
    let code;

    do {
        code = Math.floor(
            100000 + Math.random() * 900000
        ).toString();
    } while (rooms.has(code));

    return code;
}

// ===============================
// SOCKET CONNECTION
// ===============================

io.on("connection", (socket) => {

    console.log("🟢 Player connected:", socket.id);

    // ===========================
    // CREATE ROOM
    // ===========================

    socket.on("createRoom", () => {

        const roomCode = createRoomCode();

        const room = {
            players: [socket.id],
            gameState: null,
            createdAt: Date.now()
        };

        rooms.set(roomCode, room);

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.playerIndex = 0;

        socket.emit("roomCreated", {
            roomCode: roomCode
        });

        io.to(roomCode).emit("playersUpdate", {
            players: 1
        });

        console.log(
            "🏠 Room created:",
            roomCode,
            socket.id
        );
    });

    // ===========================
    // JOIN ROOM
    // ===========================

    socket.on("joinRoom", (roomCode) => {

        roomCode = String(roomCode || "").trim();

        if (!/^\d{6}$/.test(roomCode)) {

            socket.emit("joinError", {
                message: "کد اتاق باید ۶ رقمی باشد."
            });

            return;
        }

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

        // =========================
        // GAME READY
        // =========================

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

            io.to(roomCode).emit(
                "gameReady",
                {
                    message:
                        "هر دو بازیکن وارد شدند. بازی آماده است."
                }
            );

            // ارسال وضعیت اولیه
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

    // ===========================
    // DICE
    // ===========================

    socket.on("diceRolled", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        const room = rooms.get(roomCode);

        if (!room) return;

        const dice = Array.isArray(data?.dice)
            ? data.dice.slice(0, 2)
            : [];

        room.gameState = room.gameState || {};

        room.gameState.dice = dice;

        io.to(roomCode).emit(
            "diceRolled",
            {
                dice: dice,
                player: socket.playerIndex
            }
        );
    });

    // ===========================
    // GAME STATE
    // ===========================

    socket.on("gameState", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        const room = rooms.get(roomCode);

        if (!room) return;

        room.gameState = {
            board: Array.isArray(data?.board)
                ? data.board.slice(0, 24)
                : [],

            dice: Array.isArray(data?.dice)
                ? data.dice.slice(0, 2)
                : [],

            remainingDice: Array.isArray(data?.remainingDice)
                ? data.remainingDice.slice()
                : [],

            turn:
                data?.turn === 1
                    ? 1
                    : 0
        };

        socket.to(roomCode).emit(
            "gameState",
            room.gameState
        );
    });

    // ===========================
    // GAME MOVE
    // ===========================

    socket.on("gameMove", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        socket.to(roomCode).emit(
            "gameMove",
            data
        );
    });

    // ===========================
    // CHAT
    // ===========================

    socket.on("chatMessage", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        const text =
            String(data?.text || "")
                .trim()
                .slice(0, 500);

        if (!text) return;

        const message = {
            text: text,
            sender: socket.id,
            player: socket.playerIndex,
            time: new Date().toISOString()
        };

        io.to(roomCode).emit(
            "chatMessage",
            message
        );

        console.log(
            "💬 Chat:",
            roomCode,
            text
        );
    });

    // ===========================
    // DISCONNECT
    // ===========================

    socket.on("disconnect", () => {

        console.log(
            "🔴 Player disconnected:",
            socket.id
        );

        const roomCode =
            socket.roomCode;

        if (!roomCode) return;

        const room =
            rooms.get(roomCode);

        if (!room) return;

        room.players =
            room.players.filter(
                id => id !== socket.id
            );

        io.to(roomCode).emit(
            "playerDisconnected"
        );

        io.to(roomCode).emit(
            "playersUpdate",
            {
                players:
                    room.players.length
            }
        );

        // اگر اتاق خالی شد حذف شود
        if (room.players.length === 0) {

            rooms.delete(roomCode);

            console.log(
                "🗑️ Room deleted:",
                roomCode
            );

        } else {

            console.log(
                "👤 Remaining player in room:",
                roomCode
            );
        }
    });

});

// ===============================
// START SERVER
// ===============================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🚀 Milad Game Server running on port ${PORT}`
        );

    }
);
