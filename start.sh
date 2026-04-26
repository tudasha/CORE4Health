#!/usr/bin/env bash
set -e

# ── Colors ─────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

# ── Banner ─────────────────────────────────────────────────────
echo -e "${GREEN}"
echo "   ██████╗ ██████╗ ██████╗ ███████╗ ██╗  ██╗"
echo "  ██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██║  ██║"
echo "  ██║     ██║   ██║██████╔╝█████╗   ███████║"
echo "  ██║     ██║   ██║██╔══██╗██╔══╝   ╚════██║"
echo "  ╚██████╗╚██████╔╝██║  ██║███████╗      ██║"
echo "   ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝      ╚═╝"
echo -e "${NC}"
echo -e "${GREEN}  🏃 Core4Health — Local Dev Starter${NC}"
echo ""

# ── Mode selection ─────────────────────────────────────────────
# Pass --local-backend to also spin up the hub-backend locally
# Default: frontend only (pointing to Render backend via .env)
LOCAL_BACKEND=false
if [[ "$1" == "--local-backend" ]]; then
  LOCAL_BACKEND=true
fi

# ── Dependency checks ──────────────────────────────────────────
command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js not found. Install Node.js 20+.${NC}"; exit 1; }

if [ "$LOCAL_BACKEND" = true ]; then
  command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker not found (required for local DB). Install Docker Desktop.${NC}"; exit 1; }
fi

# ── Clean up stray processes ───────────────────────────────────
echo -e "${YELLOW}🧹 Freeing ports...${NC}"
kill -9 $(lsof -t -i:5200) 2>/dev/null || true
if [ "$LOCAL_BACKEND" = true ]; then
  kill -9 $(lsof -t -i:3000) 2>/dev/null || true
fi

# ── .env setup ────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo -e "${YELLOW}⚙️  No .env found — creating from .env.example...${NC}"
  cp .env.example .env
  echo -e "${YELLOW}   ✏️  Edit .env to set VITE_API_URL and VITE_WS_URL${NC}"
fi

# ── Frontend dependencies ──────────────────────────────────────
if [ ! -d node_modules ]; then
  echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
  npm install --silent
else
  echo -e "${GREEN}✅ node_modules found, skipping install${NC}"
fi

# ── Optional: local backend mode ──────────────────────────────
BACKEND_PID=""
if [ "$LOCAL_BACKEND" = true ]; then
  BACKEND_DIR="../PoliHack-v19/hub-backend"

  if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Cannot find hub-backend at: $BACKEND_DIR${NC}"
    echo    "   Run without --local-backend to use the Render backend."
    exit 1
  fi

  # Install backend deps if needed
  if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
    (cd "$BACKEND_DIR" && npm install --silent)
  fi

  # Start PostgreSQL via Docker (from PoliHack-v19 compose)
  echo -e "${BLUE}🐳 Starting PostgreSQL via Docker...${NC}"
  (cd ../PoliHack-v19 && sudo docker compose up -d hub-db)
  sleep 2
  echo -e "${GREEN}✅ PostgreSQL running on port 5435${NC}"

  # Override .env to point to local backend
  sed -i 's|^VITE_API_URL=.*|VITE_API_URL=http://localhost:3000|' .env
  sed -i 's|^VITE_WS_URL=.*|VITE_WS_URL=ws://localhost:3000|' .env
  echo -e "${YELLOW}⚙️  .env updated to point to local backend${NC}"

  echo -e "${BLUE}🚀 Starting hub-backend...${NC}"
  (cd "$BACKEND_DIR" && node index.js) &
  BACKEND_PID=$!
  sleep 2
  echo -e "${GREEN}✅ Backend running at http://localhost:3000${NC}"
fi

# ── Start Vite dev server ──────────────────────────────────────
echo -e "${BLUE}⚡ Starting Core4Health frontend...${NC}"
npm run dev -- --port 5200 &
FRONTEND_PID=$!
sleep 2

# ── Summary ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Core4Health is running!${NC}"
echo -e "${CYAN}  🌐 App:      http://localhost:5200${NC}"
if [ "$LOCAL_BACKEND" = true ]; then
  echo -e "${CYAN}  🔧 Backend:  http://localhost:3000${NC}"
  echo -e "${CYAN}  🐘 Database: localhost:5435${NC}"
else
  echo -e "${CYAN}  🔧 Backend:  ${VITE_API_URL:-https://smarthub-backend-09he.onrender.com} (Render)${NC}"
fi
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}💡 Tip:${NC} run ${CYAN}./start.sh --local-backend${NC} to use local hub-backend + DB"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

# ── Cleanup on exit ────────────────────────────────────────────
cleanup() {
  echo -e "\n${YELLOW}🛑 Shutting down Core4Health...${NC}"
  kill $FRONTEND_PID 2>/dev/null || true
  if [ -n "$BACKEND_PID" ]; then
    kill $BACKEND_PID 2>/dev/null || true
    (cd ../PoliHack-v19 && sudo docker compose stop hub-db 2>/dev/null) || true
  fi
  echo -e "${GREEN}✅ All services stopped.${NC}"
}

trap cleanup SIGINT SIGTERM
wait $FRONTEND_PID
