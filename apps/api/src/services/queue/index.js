import EventEmitter from "events";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { env } from "../../config/env.js";

// Mode A: In-Memory Asynchronous Queue (Zero Redis Local Dev)
class MemoryQueueProvider extends EventEmitter {
  constructor() {
    super();
    this.handlers = new Map();
  }

  registerWorker(handler) {
    this.on("process", async (payload) => {
      try {
        await handler(payload);
      } catch (err) {
        console.error("MemoryQueue worker error:", err);
      }
    });
  }

  async addJob(jobName, payload) {
    setImmediate(() => this.emit("process", { name: jobName, data: payload }));
  }
}

// Mode B: Production Redis / BullMQ Queue
class BullMQProvider {
  constructor() {
    const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue("media-generation-queue", { connection });
  }

  registerWorker(handler) {
    // Registered in worker process
  }

  async addJob(jobName, payload) {
    await this.queue.add(jobName, payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 }
    });
  }
}

export const queueService = env.queueProvider === "redis" ? new BullMQProvider() : new MemoryQueueProvider();
