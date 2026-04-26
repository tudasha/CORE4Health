# Core4Health 🏃‍♂️

A **mobile Android health app** (.apk) built with React + Vite + Capacitor, connected to the same PostgreSQL backend as SmartHub (PoliHack-v19).

## Features

| Feature | Details |
|---|---|
| **Step Counter** | Native accelerometer via `@capacitor/motion` — real-time counting, km walked, kcal burned |
| **Food Log** | FatSecret API food search with auto-filled macros (protein / carbs / fat) |
| **Dashboard** | Animated rings, macro progress bars, weekly step chart, live WebSocket feed |
| **Auth** | Same accounts as SmartHub — login / register with the Render backend |

---

## 🚀 Getting the APK (GitHub Actions — no Android Studio needed)

1. Push to `main` branch
2. Go to **Actions** tab → Select the latest `Build Android APK` run
3. Download the `core4health-debug-*` artifact (ZIP containing the `.apk`)

### GitHub Secrets required

Set these in **Settings → Secrets → Actions**:

| Secret | Value |
|---|---|
| `VITE_API_URL` | `https://smarthub-backend-09he.onrender.com` |
| `VITE_WS_URL` | `wss://smarthub-backend-09he.onrender.com` |

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Run in browser (full hot-reload)
npm run dev

# Build + sync to Android (after changes)
npm run cap:sync

# Open in Android Studio (optional)
npm run cap:open
```

---

## 📦 Backend Changes (hub-backend)

Two new tables are auto-created on backend start:

- **`health_steps`** — stores daily step counts per user
- **`health_meals`** — stores meal entries with calories + macros

New API routes added to `hub-backend/index.js`:

```
POST /api/health/steps    — save step count
GET  /api/health/steps    — get 7-day history
POST /api/health/meals    — log a meal
GET  /api/health/meals    — today's meals
DELETE /api/health/meals/:id
GET  /api/food/search?q=  — FatSecret proxy (OAuth signed server-side)
GET  /api/food/:id        — FatSecret food details
```

### Render env vars to add

```
FATSECRET_CONSUMER_KEY=be666fcad9fb4c558194f47f519dce3e
FATSECRET_CONSUMER_SECRET=<your_secret>
```

> ⚠️ You only provided the consumer **key**. You need the **secret** too — find it in your [FatSecret Platform dashboard](https://platform.fatsecret.com).

---

## 🏗️ Project Structure

```
polihack-core4health/
├── .github/workflows/build-apk.yml   ← GitHub Actions CI/CD
├── android/                           ← Capacitor Android project
├── src/
│   ├── context/AuthContext.jsx        ← JWT auth (shared with SmartHub)
│   ├── hooks/
│   │   ├── useHealth.js               ← meals + steps API + FatSecret search
│   │   └── useWebSocket.js            ← live HEALTH_UPDATE feed
│   ├── components/BottomNav.jsx       ← Mobile tab navigation
│   └── pages/
│       ├── Login.jsx                  ← Auth (login + register)
│       ├── Dashboard.jsx              ← Rings, macros, weekly chart
│       ├── StepCounter.jsx            ← Native pedometer + sync
│       └── FoodLog.jsx                ← Food search + macro logger
├── capacitor.config.json
└── vite.config.js
```
