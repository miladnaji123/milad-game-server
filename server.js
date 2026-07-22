const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

app.get("/", (req, res) => {
  res.send("Milad Game Server is running 🎲");
});

const rooms = {};

io.on("connection", (socket) => {

  console.log("Player connected:", socket.id);

  socket.on("createRoom", () => {

    const roomCode =
      Math.floor(100000 + Math.random() * 900000).toString();

    rooms[roomCode] = {
      players: [socket.id]
    };

    socket.join(roomCode);

    socket.emit("roomCreated", roomCode);

  });


  socket.on("joinRoom", (roomCode) => {

    if (!rooms[roomCode]) {

      socket.emit(
        "roomError",
        "این اتاق وجود ندارد."
      );

      return;
    }

    if (rooms[roomCode].players.length >= 2) {

      socket.emit(
        "roomError",
        "این اتاق پر است."
      );

      return;
    }

    rooms[roomCode].players.push(socket.id);

    socket.join(roomCode);

    socket.emit(
      "roomJoined",
      roomCode
    );

    io.to(roomCode).emit(
      "playerJoined",
      {
        players:
        rooms[roomCode].players.length
      }
    );

  });


  socket.on("chatMessage", (data) => {

    io.to(data.roomCode).emit(
      "chatMessage",
      {
        message: data.message,
        player: socket.id
      }
    );

  });


  socket.on("gameMove", (data) => {

    socket.to(data.roomCode).emit(
      "gameMove",
      data
    );

  });


  socket.on("diceRoll", (data) => {

    const dice1 =
      Math.floor(Math.random() * 6) + 1;

    const dice2 =
      Math.floor(Math.random() * 6) + 1;

    io.to(data.roomCode).emit(
      "diceResult",
      {
        dice1: dice1,
        dice2: dice2
      }
    );

  });


  socket.on("disconnect", () => {

    console.log(
      "Player disconnected:",
      socket.id
    );

    for (const roomCode in rooms) {

      rooms[roomCode].players =
        rooms[roomCode].players.filter(
          id => id !== socket.id
        );

      if (
        rooms[roomCode].players.length === 0
      ) {

        delete rooms[roomCode];

      }

    }

  });

});

const PORT =
  process.env.PORT || 3000;

server.listen(
  PORT,
  () => {

    console.log(
      `Milad Game Server running on port ${PORT}`
    );

  }
);
