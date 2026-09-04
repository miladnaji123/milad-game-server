const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

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

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let waitingPlayer = null;
const games = new Map();

const initialBoard = [
  2, 0, 0, 0, 0, -5,
  0, -3, 0, 0, 0, 5,
  -5, 0, 0, 0, 3, 0,
  5, 0, 0, 0, 0, -2
];

function createGame(player1, player2) {
  const gameId =
    `${player1.id}_${player2.id}_${Date.now()}`;

  const game = {
    id: gameId,
    players: [player1.id, player2.id],
    turn: player1.id,
    board: [...initialBoard],
    dice: []
  };

  games.set(gameId, game);

  player1.join(gameId);
  player2.join(gameId);

  return game;
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // =========================================
  // ورود سریع بدون کد اتاق
  // =========================================
  socket.on("quickJoin", () => {

    // اگر بازیکن دیگری منتظر باشد
    if (waitingPlayer) {

      const player1 = waitingPlayer;
      const player2 = socket;

      waitingPlayer = null;

      const game = createGame(player1, player2);

      player1.emit("matched", {
        gameId: game.id,
        player: 1,
        message: "حریف پیدا شد 🎲"
      });

      player2.emit("matched", {
        gameId: game.id,
        player: 2,
        message: "حریف پیدا شد 🎲"
      });

      io.to(game.id).emit("playersUpdate", {
        count: 2
      });

      io.to(game.id).emit("gameReady", {
        gameId: game.id,
        player1: player1.id,
        player2: player2.id,
        turn: game.turn,
        board: game.board
      });

      console.log(
        "Game created:",
        game.id
      );

    } else {

      // اولین بازیکن وارد صف انتظار می‌شود
      waitingPlayer = socket;

      socket.emit("waiting", {
        message: "منتظر پیدا شدن حریف هستید... ⏳"
      });

      console.log(
        "Player waiting:",
        socket.id
      );
    }
  });

  // =========================================
  // وضعیت بازی
  // =========================================
  socket.on("gameState", (data) => {

    if (!data || !data.gameId) return;

    const game = games.get(data.gameId);

    if (!game) return;

    if (!game.players.includes(socket.id)) return;

    if (data.board) {
      game.board = data.board;
    }

    if (data.dice) {
      game.dice = data.dice;
    }

    if (data.turn) {
      game.turn = data.turn;
    }

    socket.to(data.gameId).emit("gameState", {
      board: game.board,
      dice: game.dice,
      turn: game.turn
    });
  });

  // =========================================
  // تاس
  // =========================================
  socket.on("diceRolled", (data) => {

    if (!data || !data.gameId) return;

    const game = games.get(data.gameId);

    if (!game) return;

    if (!game.players.includes(socket.id)) return;

    game.dice = data.dice || [];

    socket.to(data.gameId).emit("diceRolled", {
      dice: game.dice
    });
  });

  // =========================================
  // چت
  // =========================================
  socket.on("chatMessage", (data) => {

    if (!data) return;
    if (!data.gameId) return;
    if (!data.message) return;

    const game = games.get(data.gameId);

    if (!game) return;

    if (!game.players.includes(socket.id)) return;

    const message = {
      sender: socket.id,
      message: String(data.message).slice(0, 500),
      time: Date.now()
    };

    io.to(data.gameId).emit(
      "chatMessage",
      message
    );
  });

  // =========================================
  // خروج بازیکن
  // =========================================
  socket.on("disconnect", () => {

    console.log(
      "Player disconnected:",
      socket.id
    );

    // حذف از صف انتظار
    if (
      waitingPlayer &&
      waitingPlayer.id === socket.id
    ) {
      waitingPlayer = null;
    }

    // پیدا کردن بازی بازیکن
    for (const [gameId, game] of games.entries()) {

      if (game.players.includes(socket.id)) {

        socket.to(gameId).emit(
          "opponentDisconnected",
          {
            message: "حریف از بازی خارج شد."
          }
        );

        games.delete(gameId);

        console.log(
          "Game deleted:",
          gameId
        );
      }
    }
  });
});

// =========================================
// شروع سرور
// =========================================
const PORT = process.env.PORT || 10000;

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Milad Game Server running on port ${PORT}`
    );
  }
);
