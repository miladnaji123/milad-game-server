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
  },
  transports: ["websocket", "polling"]
});

let waitingPlayer = null;
const games = new Map();

const START_BOARD = [
   2, 0, 0, 0, 0,-5,
   0,-3, 0, 0, 0, 5,
  -5, 0, 0, 0, 3, 0,
   5, 0, 0, 0, 0,-2
];

function createGame(p1, p2) {
  const id = `${p1.id}_${p2.id}_${Date.now()}`;

  const game = {
    id,
    players: [p1.id, p2.id],
    turn: p1.id,
    board: [...START_BOARD],
    dice: [],
    remainingMoves: [],
    bar: {
      1: 0,
      2: 0
    },
    borneOff: {
      1: 0,
      2: 0
    }
  };

  games.set(id, game);

  p1.join(id);
  p2.join(id);

  return game;
}

function sendState(game) {
  io.to(game.id).emit("gameState", {
    gameId: game.id,
    board: game.board,
    dice: game.dice,
    remainingMoves: game.remainingMoves,
    turn: game.turn,
    bar: game.bar,
    borneOff: game.borneOff
  });
}

io.on("connection", socket => {
  console.log("Player connected:", socket.id);

  socket.on("quickJoin", () => {

    if (waitingPlayer && waitingPlayer.id !== socket.id) {

      const p1 = waitingPlayer;
      const p2 = socket;

      waitingPlayer = null;

      const game = createGame(p1, p2);

      p1.emit("matched", {
        gameId: game.id,
        player: 1
      });

      p2.emit("matched", {
        gameId: game.id,
        player: 2
      });

      io.to(game.id).emit("playersUpdate", {
        count: 2
      });

      io.to(game.id).emit("gameReady", {
        gameId: game.id,
        player1: p1.id,
        player2: p2.id,
        turn: game.turn,
        board: game.board,
        dice: [],
        remainingMoves: [],
        bar: game.bar,
        borneOff: game.borneOff
      });

      console.log("Game created:", game.id);

    } else {

      waitingPlayer = socket;

      socket.emit("waiting", {
        message: "⏳ منتظر پیدا شدن حریف هستید..."
      });

      console.log("Player waiting:", socket.id);
    }
  });

  socket.on("rollDice", data => {

    if (!data || !data.gameId) return;

    const game = games.get(data.gameId);

    if (!game) return;

    if (!game.players.includes(socket.id)) return;

    if (game.turn !== socket.id) return;

    if (game.remainingMoves.length > 0) return;

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;

    game.dice = [d1, d2];

    if (d1 === d2) {
      game.remainingMoves = [
        d1,
        d1,
        d1,
        d1
      ];
    } else {
      game.remainingMoves = [
        d1,
        d2
      ];
    }

    sendState(game);

    console.log(
      "Dice:",
      socket.id,
      game.dice
    );
  });

  socket.on("move", data => {

    if (!data || !data.gameId) return;

    const game = games.get(data.gameId);

    if (!game) return;

    if (!game.players.includes(socket.id)) return;

    if (game.turn !== socket.id) return;

    const from = Number(data.from);
    const to = Number(data.to);

    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      from > 23 ||
      to < 0 ||
      to > 23
    ) {
      return;
    }

    const player =
      game.players[0] === socket.id ? 1 : 2;

    const mine = player === 1 ? 1 : -1;

    if (game.board[from] * mine <= 0) {
      socket.emit("moveError", {
        message: "این مهره متعلق به شما نیست."
      });
      return;
    }

    let distance;

    if (player === 1) {
      distance = to - from;
    } else {
      distance = from - to;
    }

    if (distance <= 0) {
      socket.emit("moveError", {
        message: "جهت حرکت اشتباه است."
      });
      return;
    }

    const moveIndex =
      game.remainingMoves.indexOf(distance);

    if (moveIndex === -1) {
      socket.emit("moveError", {
        message: "این حرکت با تاس شما هماهنگ نیست."
      });
      return;
    }

    const target = game.board[to];

    if (
      target * mine < 0 &&
      Math.abs(target) >= 2
    ) {
      socket.emit("moveError", {
        message: "این خانه بسته است."
      });
      return;
    }

    game.board[from] -= mine;

    if (target * mine < 0) {

      game.board[to] = mine;

      const opponent =
        player === 1 ? 2 : 1;

      game.bar[opponent]++;

    } else {

      game.board[to] += mine;
    }

    game.remainingMoves.splice(moveIndex, 1);

    if (game.remainingMoves.length === 0) {

      game.dice = [];

      game.turn =
        game.turn === game.players[0]
          ? game.players[1]
          : game.players[0];
    }

    sendState(game);
  });

  socket.on("chatMessage", data => {

    if (!data || !data.gameId || !data.message) {
      return;
    }

    const game = games.get(data.gameId);

    if (!game) return;

    if (!game.players.includes(socket.id)) {
      return;
    }

    io.to(data.gameId).emit("chatMessage", {
      sender: socket.id,
      message: String(data.message).slice(0, 500),
      time: Date.now()
    });
  });

  socket.on("disconnect", () => {

    console.log(
      "Player disconnected:",
      socket.id
    );

    if (
      waitingPlayer &&
      waitingPlayer.id === socket.id
    ) {
      waitingPlayer = null;
    }

    for (const [gameId, game] of games.entries()) {

      if (game.players.includes(socket.id)) {

        socket.to(gameId).emit(
          "opponentDisconnected",
          {
            message: "⚠️ حریف از بازی خارج شد."
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
