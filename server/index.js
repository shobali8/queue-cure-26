// index.js — Queue Cure server (Step 8: skipped list + recall)

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ---- Queue state ----
let tokens = [];
let nextNumber = 1;
let nowServing = null;

// ---- Wait-time learning ----
let seedMinutes = 10;
let learnedAvg = 10;
let consultsMeasured = 0;
const ALPHA = 0.3;

// ---- Concurrency guard ----
let isProcessing = false;

// ---- Undo snapshot ----
let lastSnapshot = null;

const round1 = (n) => Math.round(n * 10) / 10;

function getQueueState() {
  const waiting = tokens.filter((t) => t.status === "waiting");
  const skipped = tokens.filter((t) => t.status === "skipped");
  return {
    nowServing,
    waiting,
    skipped,                 // patients who didn't show — kept, not deleted
    tokensAhead: waiting.length,
    learnedAvg: round1(learnedAvg),
    consultsMeasured,
    estimatedWait: round1(waiting.length * learnedAvg),
    canUndo: lastSnapshot !== null,
  };
}

function broadcastQueue() {
  io.emit("queue_state", getQueueState());
}

function saveSnapshot() {
  lastSnapshot = {
    tokens: JSON.parse(JSON.stringify(tokens)),
    nowServingNumber: nowServing ? nowServing.number : null,
    learnedAvg,
    consultsMeasured,
  };
}

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
  socket.emit("queue_state", getQueueState());

  socket.on("add_patient", (name) => {
    tokens.push({ number: nextNumber, name: name || "Patient", status: "waiting" });
    nextNumber++;
    broadcastQueue();
  });

  socket.on("call_next", () => {
    if (isProcessing) return;
    isProcessing = true;
    try {
      saveSnapshot();
      const now = Date.now();
      if (nowServing && nowServing.calledAt) {
        const durationMin = (now - nowServing.calledAt) / 60000;
        if (consultsMeasured === 0) learnedAvg = durationMin;
        else learnedAvg = ALPHA * durationMin + (1 - ALPHA) * learnedAvg;
        consultsMeasured++;
        nowServing.status = "done";
      }
      const next = tokens.find((t) => t.status === "waiting");
      if (next) {
        next.status = "serving";
        next.calledAt = now;
        nowServing = next;
      } else {
        nowServing = null;
      }
      broadcastQueue();
    } finally {
      isProcessing = false;
    }
  });

  socket.on("undo_call", () => {
    if (!lastSnapshot) return;
    tokens = lastSnapshot.tokens;
    learnedAvg = lastSnapshot.learnedAvg;
    consultsMeasured = lastSnapshot.consultsMeasured;
    nowServing = lastSnapshot.nowServingNumber
      ? tokens.find((t) => t.number === lastSnapshot.nowServingNumber)
      : null;
    lastSnapshot = null;
    broadcastQueue();
  });

  socket.on("skip_patient", () => {
    if (isProcessing) return;
    isProcessing = true;
    try {
      saveSnapshot();
      if (nowServing) nowServing.status = "skipped";   // kept in tokens, just flagged
      const next = tokens.find((t) => t.status === "waiting");
      if (next) {
        next.status = "serving";
        next.calledAt = Date.now();
        nowServing = next;
      } else {
        nowServing = null;
      }
      broadcastQueue();
    } finally {
      isProcessing = false;
    }
  });

  // RECALL: a skipped patient came back — put them back into the waiting queue
  socket.on("recall_patient", (number) => {
    const p = tokens.find((t) => t.number === number && t.status === "skipped");
    if (p) {
      p.status = "waiting";
      broadcastQueue();
    }
  });

  socket.on("set_avg_time", (minutes) => {
    seedMinutes = Number(minutes) || seedMinutes;
    if (consultsMeasured === 0) learnedAvg = seedMinutes;
    broadcastQueue();
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});