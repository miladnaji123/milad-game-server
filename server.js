const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 10000;

// صفحه تست سرور
app.get("/", (req, res) => {
    res.send("🎲 Milad Game Server is running!");
});

// نگهداری اتاق‌ها
const rooms = {};

// ساخت کد ۶ رقمی
function createRoomCode() {
    let code;

    do {
        code = Math.floor(
            100000 + Math.random() * 900000
        ).toString();
    } while (rooms[code]);

    return code;
}

// وضعیت اولیه تخته
function createInitialGame() {
    return {
        points: [
            ["white", "white"],
            [],
            [],
            [],
            [],
            ["black", "black", "black", "black", "black"],
            [],
            ["black", "black", "black"],
            [],
            [],
            [],
            ["white", "white", "white", "white", "white"],
            ["black", "black", "black", "black", "black"],
            [],
            [],
            [],
            ["white", "white", "white"],
            ["white", "white", "white", "white", "white"],
            [],
            [],
            [],
            [],
            [],
            ["black", "black"]
        ],

        currentPlayer: "white",

        dice: [],

        barWhite: 0,

        barBlack: 0,

        offWhite: 0,

        offBlack: 0
    };
}

io.on("connection", (socket) => {

    console.log("🔌 Player connected:", socket.id);

    // ساخت اتاق
    socket.on("createRoom", () => {

        const roomCode = createRoomCode();

        rooms[roomCode] = {
            players: [],
            game: createInitialGame(),
            messages: []
        };

        rooms[roomCode].players.push({
            id: socket.id,
            color: "white"
        });

        socket.join(roomCode);

        socket.roomCode = roomCode;
        socket.color = "white";

        socket.emit("roomCreated", {
            roomCode: roomCode,
            color: "white",
            game: rooms[roomCode].game
        });

        console.log(
            "🏠 Room created:",
            roomCode
        );

    });


    // ورود به اتاق
    socket.on("joinRoom", (roomCode) => {

        roomCode = String(roomCode).trim();

        const room = rooms[roomCode];

        if (!room) {

            socket.emit(
                "errorMessage",
                "❌ این اتاق وجود ندارد."
            );

            return;
        }

        if (room.players.length >= 2) {

            socket.emit(
                "errorMessage",
                "❌ این اتاق پر است."
            );

            return;
        }

        room.players.push({
            id: socket.id,
            color: "black"
        });

        socket.join(roomCode);

        socket.roomCode = roomCode;
        socket.color = "black";

        socket.emit("roomJoined", {
            roomCode: roomCode,
            color: "black",
            game: room.game
        });

        io.to(roomCode).emit(
            "playersUpdate",
            {
                count: room.players.length
            }
        );

        console.log(
            "👥 Player joined room:",
            roomCode
        );

    });


    // درخواست وضعیت بازی
    socket.on("getGameState", () => {

        const roomCode = socket.roomCode;

        if (!roomCode || !rooms[roomCode]) {
            return;
        }

        socket.emit(
            "gameState",
            rooms[roomCode].game
        );

    });


    // انداختن تاس
    socket.on("rollDice", () => {

        const roomCode = socket.roomCode;

        if (!roomCode || !rooms[roomCode]) {
            return;
        }

        const room = rooms[roomCode];

        if (room.players.length < 2) {

            socket.emit(
                "errorMessage",
                "⏳ هنوز بازیکن دوم وارد اتاق نشده است."
            );

            return;
        }

        if (
            room.game.currentPlayer !==
            socket.color
        ) {

            socket.emit(
                "errorMessage",
                "❌ الان نوبت شما نیست."
            );

            return;
        }

        if (
            room.game.dice.length > 0
        ) {

            socket.emit(
                "errorMessage",
                "🎲 هنوز تاس‌های قبلی استفاده نشده‌اند."
            );

            return;
        }

        const d1 =
            Math.floor(
                Math.random() * 6
            ) + 1;

        const d2 =
            Math.floor(
                Math.random() * 6
            ) + 1;

        if (d1 === d2) {

            room.game.dice = [
                d1,
                d1,
                d1,
                d1
            ];

        } else {

            room.game.dice = [
                d1,
                d2
            ];

        }

        io.to(roomCode).emit(
            "diceRolled",
            {
                d1: d1,
                d2: d2,
                dice: room.game.dice,
                player: room.game.currentPlayer
            }
        );

    });


    // حرکت مهره
    socket.on("movePiece", (data) => {

        const roomCode = socket.roomCode;

        if (!roomCode || !rooms[roomCode]) {
            return;
        }

        const room = rooms[roomCode];

        const game = room.game;

        const from =
            Number(data.from);

        const to =
            Number(data.to);

        const distance =
            Number(data.distance);

        const color =
            socket.color;

        if (
            game.currentPlayer !== color
        ) {

            socket.emit(
                "errorMessage",
                "❌ الان نوبت شما نیست."
            );

            return;
        }

        if (
            from < 0 ||
            from > 23 ||
            to < 0 ||
            to > 23
        ) {

            return;
        }

        if (
            !Number.isInteger(distance) ||
            distance < 1 ||
            distance > 6
        ) {

            return;
        }

        if (
            !game.dice.includes(distance)
        ) {

            socket.emit(
                "errorMessage",
                "❌ این حرکت با تاس شما هماهنگ نیست."
            );

            return;
        }

        const source =
            game.points[from];

        const destination =
            game.points[to];

        if (
            !source ||
            source.length === 0
        ) {

            return;
        }

        if (
            source[source.length - 1] !== color
        ) {

            socket.emit(
                "errorMessage",
                "❌ این مهره متعلق به شما نیست."
            );

            return;
        }

        // بررسی جهت حرکت
        if (color === "white") {

            if (
                to <= from ||
                to - from !== distance
            ) {

                socket.emit(
                    "errorMessage",
                    "❌ جهت حرکت سفید اشتباه است."
                );

                return;
            }

        } else {

            if (
                to >= from ||
                from - to !== distance
            ) {

                socket.emit(
                    "errorMessage",
                    "❌ جهت حرکت سیاه اشتباه است."
                );

                return;
            }

        }

        const opponent =
            color === "white"
            ? "black"
            : "white";

        const opponentCount =
            destination.filter(
                p => p === opponent
            ).length;

        // خانه بسته
        if (
            opponentCount >= 2
        ) {

            socket.emit(
                "errorMessage",
                "❌ این خانه توسط دو مهره یا بیشتر بسته شده است."
            );

            return;
        }

        // برداشتن مهره
        const moving =
            source.pop();

        // زدن مهره حریف
        if (
            destination.length === 1 &&
            destination[0] === opponent
        ) {

            destination.pop();

            if (
                opponent === "white"
            ) {

                game.barWhite++;

            } else {

                game.barBlack++;

            }

        }

        destination.push(moving);

        // مصرف تاس
        const diceIndex =
            game.dice.indexOf(distance);

        if (
            diceIndex !== -1
        ) {

            game.dice.splice(
                diceIndex,
                1
            );

        }

        // اگر تمام تاس‌ها مصرف شد
        if (
            game.dice.length === 0
        ) {

            game.currentPlayer =
                game.currentPlayer === "white"
                ? "black"
                : "white";

        }

        // ارسال وضعیت جدید به هر دو بازیکن
        io.to(roomCode).emit(
            "gameUpdated",
            {
                game: game
            }
        );

    });


    // چت
    socket.on("chatMessage", (text) => {

        const roomCode =
            socket.roomCode;

        if (
            !roomCode ||
            !rooms[roomCode]
        ) {

            return;
        }

        text =
            String(text || "")
            .trim();

        if (!text) {
            return;
        }

        if (text.length > 500) {
            text = text.substring(
                0,
                500
            );
        }

        const message = {
            color: socket.color,
            text: text,
            time: new Date().toISOString()
        };

        rooms[roomCode]
        .messages
        .push(message);

        io.to(roomCode).emit(
            "chatMessage",
            message
        );

    });


    // شروع بازی جدید
    socket.on("newGame", () => {

        const roomCode =
            socket.roomCode;

        if (
            !roomCode ||
            !rooms[roomCode]
        ) {

            return;
        }

        rooms[roomCode].game =
            createInitialGame();

        io.to(roomCode).emit(
            "gameReset",
            rooms[roomCode].game
        );

    });


    // قطع اتصال
    socket.on("disconnect", () => {

        console.log(
            "🔌 Player disconnected:",
            socket.id
        );

        const roomCode =
            socket.roomCode;

        if (
            !roomCode ||
            !rooms[roomCode]
        ) {

            return;
        }

        const room =
            rooms[roomCode];

        room.players =
            room.players.filter(
                player =>
                    player.id !== socket.id
            );

        io.to(roomCode).emit(
            "playerDisconnected"
        );

        // اگر هیچ بازیکنی نماند
        if (
            room.players.length === 0
        ) {

            delete rooms[roomCode];

            console.log(
                "🗑️ Room deleted:",
                roomCode
            );

        }

    });

});


server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🎲 Milad Game Server running on port ${PORT}`
        );

    }
);
