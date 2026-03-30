const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";

// CORS для HTTP
app.use(
  cors({
    origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: false
  })
);

app.use(express.json());

// Проверка жив ли сервер
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "wintozo_servers" });
});

// Пример API
app.get("/api/ping", (req, res) => {
  res.json({ message: "pong" });
});

// Socket.io CORS
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
    credentials: false
  },
  transports: ["websocket", "polling"]
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("chat:message", (payload) => {
    io.emit("chat:message", payload);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

const PORT = Number(process.env.PORT) || 10000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started on port ${PORT}`);
});
