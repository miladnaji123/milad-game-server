const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 10000;

// اتاق‌های فعال
const rooms = {};

// صفحه اصلی سرور
app.get("/", (req, res) => {
  res.send("🎲 Milad Game Server is running!");
});

// وضعیت سرور
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "milad-game-server",
    rooms: Object.keys(rooms).length
  });
});

// ساخت کد ۶ رقمی اتاق
function generateRoomCode() {
  let code;

  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms[code]);

  return code;
}

// اتصال بازیکن
io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // ساخت اتاق
  socket.on("createRoom", () => {
    const roomCode = generateRoomCode();

    rooms[roomCode] = {
      players: [socket.id],
      board: null,
      messages: []
    };

    socket.join(roomCode);

    socket.roomCode = roomCode;

    socket.emit("roomCreated", {
      roomCode: roomCode,
      playerNumber: 1
    });

    console.log("Room created:", roomCode);
  });

  // ورود به اتاق
  socket.on("joinRoom", (roomCode) => {
    const code = String(roomCode || "").trim();

    if (!/^[0-9]{6}$/.test(code)) {
      socket.emit("joinError", "کد اتاق باید ۶ رقمی باشد.");
      return;
    }

    if (!rooms[code]) {
      socket.emit("joinError", "این اتاق وجود ندارد.");
      return;
    }

    if (rooms[code].players.length >= 2) {
      socket.emit("joinError", "این اتاق پر است.");
      return;
    }

    rooms[code].players.push(socket.id);

    socket.join(code);
    socket.roomCode = code;

    socket.emit("roomJoined", {
      roomCode: code,
      playerNumber: 2
    });

    io.to(code).emit("playersUpdate", {
      count: rooms[code].players.length
    });

    console.log("Player joined room:", code);
  });

  // ارسال پیام چت
  socket.on("chatMessage",
