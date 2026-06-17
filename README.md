# Healthcare Assistant — CareBot

An AI-powered, WhatsApp-based post-operative recovery assistant that helps patients manage their recovery journey. Built with TypeScript, **Baileys** (WhatsApp Web API), **Agenda** (MongoDB-backed job scheduling), and the **Kimi K2.5** language model.

CareBot sends scheduled medication reminders, recovery tips, and appointment notifications directly to patients' WhatsApp. It maintains a full conversation history, tracks patient context, logs all message deliveries, and allows patients to update their recovery notes — all through natural conversation.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
  - [Quick Start with Docker](#quick-start-with-docker)
  - [Manual Setup](#manual-setup)
- [Environment Variables](#environment-variables)
- [Onboarding a New Patient](#onboarding-a-new-patient)
- [Deployment to Production (AWS EC2)](#deployment-to-production-aws-ec2)
  - [1. Create the EC2 Instance](#1-create-the-ec2-instance)
  - [2. Allocate Elastic IP](#2-allocate-elastic-ip)
  - [3. Create IAM Role & S3 Bucket](#3-create-iam-role--s3-bucket)
  - [4. SSH & Run Bootstrap](#4-ssh--run-bootstrap)
  - [5. Configure .env & Build](#5-configure-env--build)
  - [6. Authenticate WhatsApp](#6-authenticate-whatsapp)
  - [7. Start with PM2](#7-start-with-pm2)
  - [8. GitHub Actions Auto-Deploy](#8-github-actions-auto-deploy)
- [API Endpoints](#api-endpoints)
- [Data Models](#data-models)
- [Scheduling & Reminders](#scheduling--reminders)
- [Security](#security)
- [Disaster Recovery](#disaster-recovery)
- [Cost Estimate](#cost-estimate)
- [Known Limitations](#known-limitations)

---

## Features

- **🤖 AI-Powered Conversations** — Patients chat naturally with CareBot about their recovery. The AI understands patient context, provides post-op guidance (with appropriate medical disclaimers), and answers recovery questions.
- **📅 Smart Reminders** — Patients can schedule medication reminders, appointment alerts, and recovery milestones using natural language ("remind me every day at 9am to take my painkillers"). Powered by **Agenda** with MongoDB persistence.
- **📝 Patient Notes** — CareBot can update recovery notes and medical history in the patient's record after confirming with the patient.
- **📊 Audit Trail** — All scheduled message deliveries are logged with status (success/failed/missed), retry counts, and timestamps for compliance.
- **🔁 Automatic Retry** — Failed message deliveries retry up to 3 times with exponential backoff (1min → 5min → 30min) before notifying the user.
- **📱 WhatsApp Native** — Uses the **Baileys** library to connect as a regular WhatsApp account — no expensive Business API required.
- **🛡️ Allowlist** — Only pre-approved phone numbers can interact with the bot, preventing unauthorized access.
- **☁️ Production Ready** — Docker Compose for local dev, PM2 for production process management, GitHub Actions for CI/CD, and MongoDB backup to S3.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Single Process                          │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │  WhatsApp Bot   │    │  Agenda Engine  │    │  AI (LLM)   │ │
│  │  (Baileys)      │    │  (Mongoose)     │    │  Tool calls │ │
│  └────────┬────────┘    └────────┬────────┘    └─────┬───────┘ │
│           │                     │                     │         │
│           ▼                     ▼                     ▼         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    MongoDB                                │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │ │
│  │  │ agendaJobs │  │ CronJobs   │  │ JobAuditLogs       │  │ │
│  │  │ (Agenda)   │  │ (Custom)   │  │ (Compliance)       │  │ │
│  │  └────────────┘  └────────────┘  └────────────────────┘  │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │ │
│  │  │ Patients   │  │ AllowList  │  │ Context            │  │ │
│  │  └────────────┘  └────────────┘  └────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    WhatsAppService                        │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Singleton holding Baileys WASocket                 │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Deployment** | Single-process monolith | WhatsApp socket is a singleton — cannot horizontally scale |
| **Database** | MongoDB (local) | Agenda's native backend, simple ops, no managed DB cost |
| **Scheduling** | Agenda v6.2.4 | Persistence across restarts, retry, audit, 10k+ jobs capable |
| **WhatsApp** | Baileys (Web API) | Free, no Business API cost, but requires periodic re-auth |
| **AI Model** | Kimi K2.5 (Moonshot) | Large context window (256K), reasoning-capable |
| **Concurrency** | Agenda capped at 50 | Prevents WhatsApp rate-limit bans |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Language** | TypeScript (NodeNext modules) |
| **Runtime** | Node.js 20 |
| **WhatsApp** | [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) v7 |
| **Scheduler** | [`agenda`](https://github.com/agenda/agenda) v6.2.4 |
| **Database** | MongoDB 7.0 via Mongoose 9 |
| **AI SDK** | [`@mariozechner/pi-ai`](https://github.com/mariozechner/pi-ai) |
| **LLM** | Kimi K2.5 (Moonshot API) |
| **Web Server** | Express 5 |
| **Process Manager** | PM2 (production) |
| **Containerization** | Docker Compose (local dev) |
| **CI/CD** | GitHub Actions |
| **Backups** | S3 (via AWS CLI + cron) |

---

## Project Structure

```
healthcare_assistant/
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions auto-deploy
├── src/
│   ├── index.ts                # Entry point — connects DB, starts WhatsApp or CLI
│   ├── server.ts               # Express server with health endpoint & patient registration API
│   ├── conversation.ts         # Message router — loads context, assembles tools, runs AI
│   ├── database/
│   │   ├── connection.ts       # Mongoose connection manager
│   │   ├── index.ts            # Barrel export for all models
│   │   └── models/
│   │       ├── Patient.ts      # Patient info (name, procedure, date, history, notes)
│   │       ├── AllowList.ts    # Authorized phone numbers
│   │       ├── Context.ts      # Conversation history per user
│   │       ├── CronJob.ts      # Scheduled reminders metadata
│   │       └── JobAuditLog.ts  # Compliance audit log for all job executions
│   └── modules/
│       ├── model.ts            # AI model configuration (Kimi K2.5)
│       ├── converse.ts         # AI conversation loop with streaming + tool execution
│       ├── whatsapp.ts         # WhatsApp client (Baileys) — auth, QR, messages
│       ├── whatsappRunner.ts   # Startup orchestrator — connects WhatsApp + Agenda
│       ├── whatsappService.ts  # Singleton socket holder for cron job delivery
│       ├── cliRunner.ts        # CLI mode for testing without WhatsApp
│       ├── agenda.ts           # Agenda singleton — init, start, stop, job helpers
│       ├── agendaJobDefinitions.ts  # 'send-whatsapp-message' job handler w/ retry & audit
│       ├── cronService.ts      # CRUD for cron jobs (create/list/delete/update)
│       ├── cronTools.ts        # AI tool definitions for scheduling + tool executors
│       ├── patientRegistration.ts  # Registers a new patient in the DB
│       ├── patientTools.ts     # AI tool for updating patient notes/history
│       ├── patientContext.ts   # Builds system prompt from patient data
│       ├── contextManager.ts   # Loads/saves conversation context from MongoDB
│       ├── allowlist_manager.ts    # Allowlist check & add
│       └── tools/index.ts      # Combined tool definitions
├── routes/
│   └── registerPatient.ts      # POST /api/register-patient endpoint
├── scripts/
│   ├── setup-ec2.sh            # Bootstrap script for fresh EC2 instance
│   └── backup-mongo.sh         # MongoDB backup to S3 (called by cron)
├── docker-compose.yml          # Local dev: MongoDB + app with hot-reload
├── Dockerfile                  # Production container (not used on EC2)
├── ecosystem.config.js         # PM2 process config
├── PRD.md                      # Product requirements doc
└── DEPLOY.md                   # Detailed deployment guide
```

---

## Prerequisites

- **Node.js** 20.x or later
- **npm** 10.x or later
- **MongoDB** 7.0 (or Docker for local MongoDB)
- **A Moonshot API key** (for Kimi K2.5 LLM) — get one at https://platform.moonshot.cn
- **A WhatsApp account** (for the bot number)

---

## Local Development

### Quick Start with Docker

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd healthcare_assistant

# 2. Create .env file
cp .env.example .env     # or create manually (see Environment Variables below)

# 3. Start everything
docker compose up --build
```

Docker Compose starts:
- **MongoDB 7.0** on port 27017
- **The app** on port 3000, with TypeScript watch mode (`--watch` rebuilds on source changes)

The `auth_info_baileys` directory is mounted as a volume so WhatsApp session persists across container restarts.

### Manual Setup

```bash
# 1. Install MongoDB locally and start it
#    (Homebrew: brew install mongodb-community && brew services start mongodb-community)

# 2. Clone and install
git clone <your-repo-url>
cd healthcare_assistant
npm install

# 3. Create .env (see below)
nano .env

# 4. Build TypeScript
npm run build

# 5. Run in WhatsApp mode
USE_WHATSAPP=true node dist/index.js

# 6. Scan the QR code or enter pairing code when prompted
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
# MongoDB connection URI
MONGODB_URI=mongodb://localhost:27017/healthcare_assistant

# Port for the Express server
SERVERPORT=3000

# Set to 'true' to run in WhatsApp mode, 'false' for CLI mode
USE_WHATSAPP=true

# Moonshot API key for the Kimi K2.5 LLM
KIMI_API_KEY=sk-your_api_key_here
```

---

## Onboarding a New Patient

Onboarding a patient is a **two-step process**: register them in the system (via API), then they can start chatting with CareBot on WhatsApp.

### Step 1: Register the Patient via API

Send a `POST` request to `/api/register-patient` with the patient's details:

```bash
curl -X POST http://localhost:3000/api/register-patient \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "number": "12345678901",
    "procedure": "Knee Replacement Surgery",
    "procedureDate": "2026-06-10T10:00:00Z",
    "history": "Patient has hypertension, controlled with medication. Allergic to penicillin.",
    "notes": "Initial recovery plan shared with patient. Follow-up scheduled for 2 weeks post-op."
  }'
```

**Required fields:**
- `name` — Patient's full name
- `number` — WhatsApp phone number (with country code, no `+` prefix)
- `procedure` — The medical procedure performed
- `procedureDate` — ISO 8601 datetime of the procedure

**Optional fields:**
- `history` — Relevant medical history (allergies, pre-existing conditions, etc.)
- `notes` — Clinical notes or recovery instructions

### Step 2: The Patient Chats on WhatsApp

Once registered, the patient can message the bot's WhatsApp number. CareBot will:

1. **Greet them warmly** using their name and procedure details.
2. **Provide post-op guidance** — recovery tips, wound care basics, gentle movement suggestions.
3. **Answer recovery questions** — what symptoms are normal, when to call the doctor.
4. **Schedule reminders** — medication timers, appointment alerts, hydration reminders.
5. **Take notes** — update recovery progress in their clinical record (with confirmation).
6. **Track milestones** — help the patient keep a recovery journal.

**How to update medical history or notes via chat:**

The patient can say something like:

> "I've been having some swelling in my knee today. Can you note that down?"

CareBot will **confirm** before updating:

> "I'll add that to your recovery notes: 'Patient reports mild swelling in the knee on June 17th.' Should I go ahead and save this?"

After the patient confirms, the notes are saved to their MongoDB record.

### Step 3: Automatic Allowlisting

When a patient is registered via the API, their phone number is **automatically added to the allowlist**. This means they can immediately message the bot. The allowlist acts as a security gate — only registered patients can receive replies.

> **Note:** The number used for `POST /api/register-patient` must match the WhatsApp number the patient will message from.

### Postman Collection

A ready-to-use Postman collection is available in the [`postman/`](./postman) directory:

- `Healthcare_Assistant_Collection.json` — All API endpoints
- `Healthcare_Assistant_Environment.json` — Environment variables (base URL, etc.)

Import both into Postman to get started quickly.

---

## Deployment to Production (AWS EC2)

This section is a condensed version of the full deployment guide in [`DEPLOY.md`](./DEPLOY.md). For detailed step-by-step instructions, refer to that document.

### Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│  EC2 t3.small (Ubuntu 24.04)                            │
│  Elastic IP (static IPv4)                               │
│                                                         │
│  ┌─────────────────┐    ┌───────────────────────────┐  │
│  │  Node.js 20     │    │  MongoDB 7.0 (localhost)  │  │
│  │  + PM2          │◄──►│  + mongodump backups      │  │
│  │  + Baileys      │    │                           │  │
│  │  + Agenda       │    │  auth_info_baileys/       │  │
│  │  + Express      │    │  (WhatsApp session)       │  │
│  └─────────────────┘    └───────────────────────────┘  │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  S3 Bucket (daily MongoDB backups)              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Estimated monthly cost:** ~$16–$21/month (t3.small, EBS, S3 backups).

### 1. Create the EC2 Instance

- **AMI:** Ubuntu Server 24.04 LTS
- **Type:** t3.small (2 vCPU, 2 GB RAM)
- **Storage:** 8 GB gp3 (or 20 GB for heavy audit logs)
- **Security Group:**
  | Type | Port | Source |
  |------|------|--------|
  | SSH | 22 | Your IP only |
  | Custom TCP | 3000 | Your IP only |

### 2. Allocate Elastic IP

Attach a static Elastic IP to the instance so the address doesn't change on restart.

### 3. Create IAM Role & S3 Bucket

- **IAM Role:** `HealthcareAssistantEC2Role` with an inline policy for `s3:PutObject`, `s3:GetObject`, etc. on your backup bucket.
- **S3 Bucket:** `healthcare-assistant-prod-backups-<random-suffix>` (globally unique).

Attach the IAM role to the EC2 instance.

### 4. SSH & Run Bootstrap

```bash
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP

# Clone the repo
git clone https://github.com/YOUR_USERNAME/healthcare_assistant.git ~/healthcare_assistant
cd ~/healthcare_assistant

# Run setup (installs Node.js 20, MongoDB 7.0, PM2, swap file, backup cron)
chmod +x scripts/setup-ec2.sh
./scripts/setup-ec2.sh healthcare-assistant-prod-backups-YOUR_SUFFIX
```

### 5. Configure .env & Build

```bash
cd ~/healthcare_assistant
nano .env
```

```env
MONGODB_URI=mongodb://localhost:27017/healthcare_assistant
SERVERPORT=3000
USE_WHATSAPP=true
KIMI_API_KEY=sk-your_rotated_api_key_here
```

```bash
npm run build
```

### 6. Authenticate WhatsApp

**⚠️ CRITICAL:** This step requires a TTY and **cannot** be done under PM2.

```bash
cd ~/healthcare_assistant
node dist/index.js
```

Scan the QR code or enter the pairing code. Wait for `✅ WhatsApp connected successfully!`, then press **Ctrl+C**.

### 7. Start with PM2

```bash
cd ~/healthcare_assistant
pm2 start ecosystem.config.js
pm2 save
```

Verify: `curl http://localhost:3000/health` should return `{"status":"ok"}`.

### 8. GitHub Actions Auto-Deploy

Add these **repository secrets** in GitHub → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `EC2_HOST` | Your Elastic IP |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Contents of your `.pem` key file |

Every push to `main` will:
1. SSH into the EC2 instance
2. `git pull && npm ci && npm run build`
3. `pm2 reload` (zero-downtime)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `{"status":"ok","timestamp":"..."}` |
| `POST` | `/api/register-patient` | Register a new patient (see [Onboarding](#onboarding-a-new-patient)) |
| `GET` | `/api/register-patient` | (Future use — see Postman collection) |

### POST /api/register-patient

**Request body:**
```json
{
  "name": "John Doe",
  "number": "12345678901",
  "procedure": "Knee Replacement Surgery",
  "procedureDate": "2026-06-10T10:00:00Z",
  "history": "Optional medical history",
  "notes": "Optional clinical notes"
}
```

**Response (201):**
```json
{
  "message": "Patient registered successfully",
  "name": "John Doe"
}
```

---

## Data Models

### Patient
| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | Unique ID (`name:number:random`) |
| `name` | String | Patient's full name |
| `number` | String | WhatsApp phone number |
| `procedure` | String | Medical procedure name |
| `procedureDate` | Date | Date/time of the procedure |
| `history` | String | Medical history (optional) |
| `notes` | String | Clinical notes (optional) |

### CronJob
| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | Patient's phone number (scoped) |
| `name` | String | Unique job name per user |
| `naturalSchedule` | String | Original user phrasing (e.g., "every day at 9am") |
| `cronExpression` | String | Cron syntax or `once:YYYY-MM-DD HH:mm:ss` |
| `timezone` | String | IANA timezone |
| `message` | String | WhatsApp message to send |
| `enabled` | Boolean | Active status |

### JobAuditLog
| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | Patient's phone number |
| `jobId` | String | CronJob reference |
| `jobName` | String | Job name |
| `message` | String | Message that was sent |
| `status` | Enum | `success`, `failed`, or `missed` |
| `retryCount` | Number | How many retries were attempted |
| `deliveredAt` | Date | When delivered |
| `errorMessage` | String | Failure reason (if applicable) |

### AllowList
| Field | Type | Description |
|-------|------|-------------|
| `number` | String | Allowed WhatsApp phone number (unique) |

### Context
| Field | Type | Description |
|-------|------|-------------|
| `phoneNumber` | String | User's phone number (unique) |
| `messages` | Array | Conversation history with the AI |

---

## Scheduling & Reminders

CareBot can schedule three types of reminders through natural conversation:

### Recurring Reminders
> "Remind me every day at 9am to take my painkillers"
> "Send me a weekly check-in every Monday at 10am"

The AI converts natural language to cron expressions and uses `agenda.every()`.

### One-Off Reminders
> "Remind me tomorrow at 3pm to call the doctor"
> "Send me a reminder on Friday at 7pm for my physio appointment"

The AI uses `agenda.schedule()` with a specific date/time.

### Updating & Deleting Reminders
Patients can manage their reminders through chat:
> "Cancel my painkiller reminder"
> "Change my daily reminder to 10am instead of 9am"
> "What reminders do I have set?"

### Reliability Features
- **Persistence:** All jobs survive server restarts (stored in MongoDB via Agenda)
- **Retry:** Up to 3 attempts with exponential backoff (1min → 5min → 30min)
- **Failure notification:** Patient is notified after 3 consecutive failures
- **Audit:** Every execution is logged to `JobAuditLog`
- **Concurrency cap:** Maximum 50 simultaneous message deliveries

---

## Security

| Risk | Mitigation |
|------|------------|
| **Unauthorized access** | Allowlist restricts bot replies to registered patients only |
| **API key exposure** | `.env` is gitignored; rotate immediately if ever committed |
| **MongoDB exposure** | Binds to `127.0.0.1` only in production |
| **Port 3000 exposure** | Security Group restricts to your IP only |
| **SSH brute force** | Security Group restricts port 22 to your IP only |
| **S3 backups** | Bucket is private, no public access |
| **Medical data** | No TLS on port 3000 (acceptable as it's not internet-facing) |

---

## Disaster Recovery

### Instance Terminated
1. Launch a new EC2 instance with same specs
2. Attach the same Elastic IP
3. Run `setup-ec2.sh`
4. Restore MongoDB from the latest S3 backup
5. Create `.env`, re-authenticate WhatsApp, start PM2

### App Crash
PM2 auto-restarts the process. Check `pm2 logs` for errors.

### WhatsApp Disconnected (Not Logged Out)
PM2 restarts the app, and Baileys auto-reconnects using saved session files.

### WhatsApp Logged Out (401/405)
1. `rm -rf ~/healthcare_assistant/auth_info_baileys`
2. Run `node dist/index.js` interactively
3. Re-authenticate (QR/pairing code)
4. Start PM2 again

---

## Cost Estimate (Production)

| Service | Cost |
|---------|------|
| EC2 t3.small (on-demand) | ~$15/month |
| Elastic IP (attached) | $0 |
| EBS 8 GB gp3 | ~$0.64/month |
| S3 backups (~1 GB) | ~$0.02/month |
| Data transfer | ~$0–$5/month |
| **Total** | **~$16–$21/month** |

---

## Known Limitations

| Limitation | Impact |
|------------|--------|
| **No monitoring/alerting** | Bot could be down for hours until manually checked |
| **WhatsApp re-auth on instance loss** | If the EC2 instance is terminated, session files are lost and must be re-authenticated |
| **Single point of failure** | One EC2, one MongoDB, no failover |
| **No horizontal scaling** | WhatsApp socket is a singleton |
| **t3.small RAM is tight** | Upgrade to t3.medium if patient/job count grows significantly |
| **No TLS/HTTPS** | API endpoints are HTTP only (acceptable for internal-only access) |

---

## License

ISC

## Author

**Wahid Ejaz** — [wahidejaz324@gmail.com](mailto:wahidejaz324@gmail.com)