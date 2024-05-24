const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const Redis = require("redis");

const app = express();
const server = http.createServer(app);

//i have to add time limit to key generated and also limit the maximum number of players to two

const io = socketIo(server, {
  cors: {
    origin: `https://chess-blue-seven.vercel.app`,
    methods: ["GET", "POST"],
  },
});

require("dotenv").config();

const redisClient = Redis.createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});
redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});
redisClient.connect().catch(console.error);

app.use(cors());
app.use(express.json());

app.post("/api/set-key", async (req, res) => {
  console.log("post request on redis");
  const { key } = req.body;
  const ttl = 24 * 60 * 60;

  try {
    const answer = await redisClient.SET(key, 0);
    await redisClient.expire(key, ttl);
    console.log(answer);
    res.status(200).json({ message: "Key set successfully" });
    console.log("succesfulllll");
  } catch (err) {
    res.status(500).json({ error: "Failed to set key in Redis" });
    console.log("failed");
  }
});

app.get("/api/enter-key", async (req, res) => {
  const key = req.query.key;
  try {
    const result = await redisClient.GET(key);
    if (result) {
      const currentValue = parseInt(result);
      if (currentValue >= 2) {
        res.status(200).json({ exists: true, full: true });
      } else {
        res.status(200).json({ exists: true, full: false });
      }
    } else {
      res.status(404).json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/", async (req, res) => {
  return res.send("This is backend of chess-Redis...");
});

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("join", async (uniqueKey) => {
    try {
      let playersCount = await redisClient.INCR(uniqueKey);
      console.log("counted players are :", playersCount);
      if (playersCount > 2) {
        await redisClient.DECR(uniqueKey);
        socket.emit("room full");
        return;
      }
      socket.join(uniqueKey);
      console.log(`User joined room: ${uniqueKey}`);
    } catch (err) {
      console.error("Error incrementing player count in Redis:", err);
    }
  });

  socket.on(
    "move",
    (uniqueKey, updatedBoardAfterMoving, turnData, winData, checkData) => {
      socket
        .to(uniqueKey)
        .emit("move", updatedBoardAfterMoving, turnData, winData, checkData);
    }
  );

  socket.on("restart", (uniqueKey) => {
    socket.to(uniqueKey).emit("restart");
  });

  socket.on("new game", (uniqueKey) => {
    socket.to(uniqueKey).emit("new game");
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

server.listen(3001, () => {
  console.log("Server is running on port 3001");
});
