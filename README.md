# Scalable-Website-Screenshot

**Scalable-Website-Screenshot** is a scalable web application that generates full-page screenshots of websites. It leverages a distributed architecture for handling multiple screenshot requests simultaneously, providing real-time updates and efficient task management.


## Demo Video
https://github.com/user-attachments/assets/50819078-08a2-470a-b896-03b425b9e3d2

---

## Low-Level Design
<p align="center">
  <img src="https://github.com/user-attachments/assets/48bbbe8d-a8e6-415e-8325-570a3d7a4d7f" alt="Low-Level Design Diagram">
</p>


## Tech Stack

- **Next.js** (Frontend): React-based framework for building the user interface.
- **Redis**: Used for caching the screenshots and real-time communication (Pub/Sub).
- **Fastify**: A fast and lightweight backend framework for handling HTTP requests.
- **WebSocket**: Real-time updates are provided via WebSocket for job completion notifications.
- **RabbitMQ**: Message queue used to handle the distribution of tasks to multiple workers.

---

## Installation

### Docker 
Start Redis and RabbitMQ Services
```bash
docker-compose up
```

### 1. **Frontend (Next.js)**

To set up the frontend, navigate to the `NextJS/frontend` directory and install the dependencies:

```bash
cd NextJS/frontend
pnpm install && npm run dev
```

This will start the Next.js server in development mode. You can access the application on `http://localhost:3000`.

---

### 2. **Backend & Worker**

To install the backend server and worker dependencies, run the following:

```bash
pnpm install
```

---

### 3. **Running the Server**

To start the backend server, run:

```bash
node index.js
```

This will start the Fastify server and make the API endpoints available for screenshot requests.

---

### 4. **Running the Worker(s)**

To start the worker(s) that process screenshot requests, run:

```bash
node worker.js
```

#### Note:
You can run **multiple workers** depending on the number of parallel tasks you want to handle. The more workers you run, the more tasks can be processed simultaneously. For example:

```bash
# Run 5 workers in parallel:
node worker.js
node worker.js
node worker.js
node worker.js
node worker.js
```

Each worker is responsible for fetching a task from RabbitMQ, processing the screenshot, and saving caching it to Redis. Multiple workers will increase the throughput of screenshot generation, allowing the system to scale efficiently with higher load.

---

## How It Works

1. **Frontend (Next.js)**: Users provide a URL via the frontend, and the request is sent to the Fastify backend.
   
2. **Backend (Fastify)**: Fastify checks Redis for a cached screenshot. If it's not found, the request is added to the RabbitMQ queue as a new task.

3. **RabbitMQ**: The task is picked up by one of the available workers for processing.

4. **Workers**: Workers use libraries like Puppeteer to generate the screenshot of the given URL. Once the screenshot is captured, it's saved and path cached in Redis for quick retrieval.

5. **Redis (Pub/Sub)**: After the task is completed, the worker publishes an update to Redis, which the frontend subscribes to using WebSocket to provide real-time status updates to the user.

6. **WebSocket**: Once the task is completed, the frontend is notified via WebSocket, and the screenshot is served to the user.

---

## Notes

- **Scaling Workers**: You can increase the number of workers to process more tasks in parallel. The system is designed to scale horizontally by adding more worker instances.
- **Redis Caching**: Once a screenshot is generated for a specific URL, it will be cached in Redis, reducing the load for future requests.
  
The more workers you run, the more tasks can be processed simultaneously, improving throughput and system performance.

---

## License

[MIT License](LICENSE)
