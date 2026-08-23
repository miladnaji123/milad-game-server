const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: "*"
}));

app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// =========================
// HEALTH
// =========================

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Milad Game Server is running"
    });
});

app.get("/health1", (req, res) => {
    res.status(200).send("OK");
});


// =========================
// ROOMS
// =========================

const rooms = new Map();

function generateRoomCode() {

    let code;

    do {
        code =
            Math.floor(
                100000 + Math.random() * 900000
            ).toString();

    } while (rooms.has(code));

    return code;
}


// =========================
// CONNECTION
// =========================

io.on("connection", (socket) => {

    console.log(
        "Player connected:",
        socket.id
    );


    // =========================
    // CREATE ROOM
    // =========================

    socket.on("createRoom", () => {

        const roomCode =
            generateRoomCode();

        rooms.set(roomCode, {
            players: [socket.id],
            board: null,
            dice: [0, 0],
            turn: 0
        });

        socket.join(roomCode);

        socket.roomCode =
            roomCode;

        socket.playerIndex = 0;

        console.log(
            "Room created:",
            roomCode,
            "by",
            socket.id
        );

        socket.emit(
            "roomCreated",
            {
                roomCode: roomCode,
                playerIndex: 0
            }
        );

        io.to(roomCode).emit(
            "playersUpdate",
            {
                players: 1
            }
        );

    });


    // =========================
    // JOIN ROOM
    // =========================

    socket.on(
        "joinRoom",
        (roomCode) => {

            const code =
                String(roomCode).trim();

            const room =
                rooms.get(code);


            if (!room) {

                socket.emit(
                    "joinError",
                    {
                        message:
                            "❌ این اتاق وجود ندارد."
                    }
                );

                return;
            }


            if (room.players.length >= 2) {

                socket.emit(
                    "joinError",
                    {
                        message:
                            "❌ این اتاق پر است."
                    }
                );

                return;
            }


            room.players.push(
                socket.id
            );

            socket.join(code);

            socket.roomCode =
                code;

            socket.playerIndex = 1;


            console.log(
                "Player joined room:",
                code,
                socket.id
            );


            socket.emit(
                "joinedRoom",
                {
                    roomCode: code,
                    playerIndex: 1
                }
            );


            io.to(code).emit(
                "playersUpdate",
                {
                    players:
                        room.players.length
                }
            );


            // =========================
            // GAME READY
            // =========================

            if (
                room.players.length === 2
            ) {

                console.log(
                    "Game ready:",
                    code
                );

                io.to(code).emit(
                    "gameReady",
                    {
                        roomCode: code
                    }
                );

            }

        }
    );


    // =========================
    // GAME STATE
    // =========================

    socket.on(
        "gameState",
        (data) => {

            const roomCode =
                socket.roomCode;

            if (!roomCode)
                return;

            const room =
                rooms.get(roomCode);

            if (!room)
                return;


            if (
                Array.isArray(data.board)
            ) {

                room.board =
                    data.board.slice();

            }


            if (
                Array.isArray(data.dice)
            ) {

                room.dice =
                    data.dice.slice();

            }


            if (
                typeof data.turn ===
                "number"
            ) {

                room.turn =
                    data.turn;

            }


            socket
                .to(roomCode)
                .emit(
                    "gameState",
                    {
                        board:
                            room.board,

                        dice:
                            room.dice,

                        turn:
                            room.turn
                    }
                );

        }
    );


    // =========================
    // DICE
    // =========================

    socket.on(
        "diceRolled",
        (data) => {

            if (!socket.roomCode)
                return;

            socket
                .to(socket.roomCode)
                .emit(
                    "diceRolled",
                    data
                );

        }
    );


    // =========================
    // CHAT
    // =========================

    socket.on(
        "chatMessage",
        (data) => {

            if (!socket.roomCode)
                return;

            const text =
                String(
                    data?.text || ""
                ).trim();

            if (!text)
                return;

            if (text.length > 500)
                return;

            io
                .to(socket.roomCode)
                .emit(
                    "chatMessage",
                    {
                        text: text
                    }
                );

        }
    );


    // =========================
    // DISCONNECT
    // =========================

    socket.on(
        "disconnect",
        () => {

            console.log(
                "Player disconnected:",
                socket.id
            );


            const roomCode =
                socket.roomCode;

            if (!roomCode)
                return;


            const room =
                rooms.get(roomCode);

            if (!room)
                return;


            room.players =
                room.players.filter(
                    id => id !== socket.id
                );


            if (
                room.players.length === 0
            ) {

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
                    "gameMessage",
                    {
                        message:
                            "بازیکن مقابل از اتاق خارج شد."
                    }
                );

            }

        }
    );

});


// =========================
// START SERVER
// =========================

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
