const fastify = require("fastify")({ logger: false });
const path = require("path");
const amqp = require("amqplib");
const { v4: uuidv4 } = require("uuid");
const { Server } = require("socket.io");
const http = require("http");
const Redis = require("ioredis");
const fastifyCors = require("@fastify/cors");

// Redis client
const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
});

// Redis subscriber for screenshot completion events
const subscriber = new Redis({
  host: "127.0.0.1",
  port: 6379,
});

// RabbitMQ Connection
let channel;
const RABBITMQ_URL = "amqp://localhost";

// Initialize RabbitMQ
async function initRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue("screenshot_requests");
  fastify.log.info("Connected to RabbitMQ");
}

// Static file serving for screenshots
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "screenshots"),
  prefix: "/screenshots/", // Public URL prefix
});

fastify.register(fastifyCors, {
  origin: "*",
  methods: "GET, PUT, POST, DELETE",
});

// HTTP Server for Socket.IO
const server = http.createServer(fastify.server);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store connected clients in Redis instead of Map
io.on("connection", async (socket) => {
  fastify.log.info(`Client connected: ${socket.id}`);
  await redis.set(
    `socket:${socket.id}`,
    JSON.stringify({
      id: socket.id,
      connectedAt: Date.now(),
    })
  );

  socket.on("disconnect", async () => {
    await redis.del(`socket:${socket.id}`);
    fastify.log.info(`Client disconnected: ${socket.id}`);
  });
});

// Subscribe to screenshot completion events
subscriber.subscribe("screenshot-completion", (err, count) => {
  if (err) {
    fastify.log.error(
      "Failed to subscribe to screenshot-completion channel:",
      err
    );
    return;
  }
  fastify.log.info("Subscribed to screenshot-completion channel");
});

subscriber.on("message", (channel, message) => {
  if (channel === "screenshot-completion") {
    const data = JSON.parse(message);
    const { socketId } = data;
    console.log(data);
    io.to(socketId).emit("screenshot-completed", data);
  }
});


const sendToQueue = async (url, socketId, viewport, useCache = false) => {
    const jobId = uuidv4();
    await channel.sendToQueue(
      "screenshot_requests",
      Buffer.from(
        JSON.stringify({
          jobId,
          url,
          socketId,
          viewport,
          useCache,
        })
    )
  );
};

// API to accept screenshot requests
fastify.post("/screenshot", async (request, reply) => {
  // Check if request.body exists
  if (!request.body) {
    return reply.status(400).send({ error: "URL is required" });
  }

  const { url, viewport, useCache } = request.body;
  console.log(url);
  const socketId = request.headers["x-socket-id"]; // Pass socket ID via headers

  if (!url || !socketId) {
    return reply.status(400).send({ error: "URL and Socket ID are required" });
  }

  // Validate viewport dimensions
  if (
    !viewport ||
    !viewport.width ||
    !viewport.height ||
    typeof viewport.width !== "number" ||
    typeof viewport.height !== "number" ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return reply.status(400).send({ error: "Invalid viewport dimensions" });
  }

  console.log(viewport);

  // Check if socket exists in Redis
  const socketExists = await redis.exists(`socket:${socketId}`);
  if (!socketExists) {
    return reply.status(400).send({ error: "Invalid Socket ID" });
  }

  console.log(useCache)

  if (useCache) {
    const screenshot = await redis.get(`screenshot:${url}${viewport.height}x${viewport.width}`);
    console.log("loading from cache");
    if (screenshot) {
      console.log("Cache hit")

      io.to(socketId).emit("screenshot-completed", {
        socketId,
        jobId: false,
        screenshotURL: JSON.parse(screenshot).screenshot ,
        down: false,
        cache: true,
      });
    }else{
        console.log("Cache miss")
        await sendToQueue(url, socketId, viewport, useCache);
    }

  } else {
    await sendToQueue(url, socketId, viewport, useCache);
  }

  return { message: "Screenshot request received"};
});

// Start server
const startServer = async () => {
  await initRabbitMQ();
  try {
    await fastify.listen({ port: 3002, host: "0.0.0.0" });
    server.listen(3001, "0.0.0.0", () => {
      fastify.log.info("Socket.IO server listening on port 3001");
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

startServer();
