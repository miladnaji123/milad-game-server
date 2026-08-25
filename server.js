const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "*" }));
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ===============================
// HEALTH
// ===============================

app.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "Milad Game Server is running"
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Milad Game Server is running"
    });
});

app.get("/health1", (req, res) => {
    res.send("OK");
});

// ===============================
// ROOMS
// ===============================

const rooms = new Map();

function generateRoomCode() {
    let code;

    do {
        code = Math.floor(
            100000 + Math.random() * 900000
        ).toString();
    } while (rooms.has(code));

    return code;
}

// ===============================
// SOCKET.IO
// ===============================

io.on("connection", (socket) => {

    console.log("Player connected:", socket.id);

    // ===========================
    // CREATE ROOM
    // ===========================

    socket.on("createRoom", () => {

        const roomCode = generateRoomCode();

        rooms.set(roomCode, {
            players: [socket.id],
            board: [
                 2, 0, 0, 0, 0, -5,
                 0,-3, 0, 0, 0,  5,
                -5, 0, 0, 0, 3,  0,
                 5, 0, 0, 0, 0, -2
            ],
            dice: [0, 0],
            remainingDice: [],
            turn: 0
        });

        socket.join(roomCode);

        socket.roomCode = roomCode;
        socket.playerIndex = 0;

        console.log(
            "Room created:",
            roomCode,
            socket.id
        );

        socket.emit("roomCreated", {
            roomCode: roomCode,
            playerIndex: 0
        });

        io.to(roomCode).emit("playersUpdate", {
            players: 1
        });
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
                message: "❌ این اتاق وجود ندارد."
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

        console.log(
            "Player joined room:",
            roomCode,
            socket.id
        );

        // به بازیکن دوم
        socket.emit("joinedRoom", {
            roomCode: roomCode,
            playerIndex: 1
        });

        // تعداد بازیکنان
        io.to(roomCode).emit("playersUpdate", {
            players: 2
        });

        // شروع بازی
        io.to(roomCode).emit("gameReady", {
            board: room.board,
            dice: room.dice,
            remainingDice: room.remainingDice,
            turn: room.turn
        });

        console.log(
            "Game ready:",
            roomCode
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

        if (Array.isArray(data.board)) {
            room.board = data.board.slice();
        }

        if (Array.isArray(data.dice)) {
            room.dice = data.dice.slice();
        }

        if (Array.isArray(data.remainingDice)) {
            room.remainingDice =
                data.remainingDice.slice();
        }

        if (
            data.turn === 0 ||
            data.turn === 1
        ) {
            room.turn = data.turn;
        }

        io.to(roomCode).emit("gameState", {
            board: room.board,
            dice: room.dice,
            remainingDice: room.remainingDice,
            turn: room.turn
        });
    });

    // ===========================
    // DICE
    // ===========================

    socket.on("diceRolled", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        io.to(roomCode).emit(
            "diceRolled",
            {
                dice: data.dice,
                player: socket.playerIndex
            }
        );
    });

    // ===========================
    // CHAT
    // ===========================

    socket.on("chatMessage", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode) return;

        const text =
            String(data?.text || "").trim();

        if (!text) return;

        if (text.length > 500) return;

        io.to(roomCode).emit(
            "chatMessage",
            {
                text: text,
                player: socket.playerIndex
            }
        );
    });

    // ===========================
    // DISCONNECT
    // ===========================

    socket.on("disconnect", () => {

        console.log(
            "Player disconnected:",
            socket.id
        );

        const roomCode =
            socket.roomCode;

        if (!roomCode) return;

        const room = rooms.get(roomCode);

        if (!room) return;

        room.players =
            room.players.filter(
                id => id !== socket.id
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
                    players:
                        room.players.length
                }
            );

            io.to(roomCode).emit(
                "chatMessage",
                {
                    text:
                        "⚠️ بازیکن مقابل از اتاق خارج شد."
                }
            );
        }
    });
});

// ===============================
// START SERVER
// ===============================

const PORT =
    process.env.PORT || 10000;

server.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `Milad Game Server running on port ${PORT}`
        );
    }
);
