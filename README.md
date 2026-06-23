# 🩺 Queue Cure '26

> Real-time clinic queue management system built for the Queue Cure '26 Hackathon on Wooble.

76% of India's 1.5 million clinics still run on paper token slips and shouting. Patients wait 2–3 hours with zero visibility. Queue Cure fixes that with a live, two-screen queue system that updates instantly across all devices — no refresh needed.

---

## 🖥️ Live Demo

- **Receptionist view:** [queue-cure-26.vercel.app/receptionist.html](#) *(link after deployment)*
- **Patient view:** [queue-cure-26.vercel.app/patient.html](#) *(link after deployment)*

---

## ✨ Features

**Receptionist Screen**
- Register patients by name — token numbers assigned automatically
- Call next patient with one click — live across all screens instantly
- Skip no-shows — patients appear in a Skipped section, not deleted
- Recall skipped patients back into the queue when they return
- Undo the last call within one action — misclick rescue
- Set average consultation time seed — system learns from real data thereafter

**Patient Screen**
- Large departure-board style token display
- Pulse animation when the token changes — visible from across a waiting room
- Live estimated wait time — computed from real measured consultations, not hardcoded
- Patients ahead count updates instantly on every Call Next

**System**
- Server-authoritative architecture — server owns the single source of truth
- Full queue snapshot broadcast after every mutation — no client-side reconciliation
- Exponentially weighted moving average (EWMA) wait-time learning
- Concurrency guard — rapid double-clicks never skip a patient
- Skipped patients tracked separately — never lost, always recallable

---

## 🏗️ Architecture
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐

│  Receptionist   │─────────│   Node.js Server  │─────────│ Patient Screen  │

│  (browser tab)  │ Socket  │  (source of truth)│ Socket  │ (browser tab)   │

└─────────────────┘  .IO    └──────────────────┘  .IO    └─────────────────┘

**Why server-authoritative?**
All queue mutations happen on the server. After every change, the server broadcasts a full state snapshot to every connected client. Clients never compute the canonical queue — they only render what the server sends. This makes live sync trivially correct, reconnection a non-event, and concurrency bugs impossible.

**Wait-time formula:**
newAvg = 0.3 × (measured duration) + 0.7 × (previous avg)

estimatedWait = tokensAhead × learnedAvg
The seed value (set by receptionist) is used only before any real consultations are measured. The moment the first patient is called and the next is promoted, real clock-measured durations replace the seed via EWMA.

---

## 🔌 Socket Events

| Direction | Event | Payload | Description |
|---|---|---|---|
| Client → Server | `add_patient` | `name: string` | Register a new patient |
| Client → Server | `call_next` | — | Finish current, promote next |
| Client → Server | `skip_patient` | — | Mark current as no-show |
| Client → Server | `recall_patient` | `number: int` | Return skipped patient to queue |
| Client → Server | `undo_call` | — | Restore state before last call |
| Client → Server | `set_avg_time` | `minutes: number` | Update the seed average |
| Server → Client | `queue_state` | Full snapshot | Broadcast after every mutation |

---

## 🚀 Running Locally

**Prerequisites:** Node.js v18+, npm

```bash
# 1. Clone the repo
git clone https://github.com/shobali8/queue-cure-26.git
cd queue-cure-26

# 2. Install server dependencies
cd server
npm install

# 3. Start the server
node index.js
# → Server running at http://localhost:4000

# 4. Open the screens
# Double-click client/receptionist.html in your file explorer
# Double-click client/patient.html in your file explorer
```

---

## 🧠 Edge Cases Handled

| Scenario | How it's handled |
|---|---|
| Rapid double-click on Call Next | `isProcessing` lock — second click ignored until first completes |
| Accidental call | Undo restores full previous state in one click |
| Patient no-show | Skip moves them to Skipped section — not deleted |
| Skipped patient returns | Recall re-adds them to the waiting queue |
| Empty queue, Call Next clicked | Server sets `nowServing` to null gracefully — no crash |
| Client reconnects after dropout | Server sends full snapshot on every new connection |
| Skipped patient's time | Not fed into EWMA — a no-show isn't a real consultation |

---

## 🗂️ Project Structure
queue-cure-26/

├── server/

│   ├── index.js          # Express + Socket.IO server

│   └── package.json

├── client/

│   ├── receptionist.html # Receptionist screen

│   └── patient.html      # Patient waiting room screen

└── README.md

---

## 👤 Built by

**Shabali Murari** — built for Queue Cure '26 on [Wooble](https://wooble.org)