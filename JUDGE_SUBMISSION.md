# 🩺 SYNAPSE - Health Intelligence Platform

## 📋 Judge Submission

**Project**: Synapse - AI-Powered Personal Health Intelligence System  
**Team**: Ritik Yadav  
**Date**: April 28, 2026

---

## ✅ **STATUS: LIVE AND READY**

**Network IP**: 10.15.26.249 ✓ Active  
**Backend**: Running (http://10.15.26.249:8000) ✓ Responding  
**Frontend**: Running (http://10.15.26.249:5173) ✓ Serving  
**CORS Configuration**: Updated for network access ✓ Configured  

---

## 🔗 **LIVE DEMO LINKS**

### ✅ **Option 1: Local Network Access** (Use this!)
**If accessing from the same office/WiFi network:**

- **Frontend (React UI)**: http://10.15.26.249:5173
- **Backend (FastAPI)**: http://10.15.26.249:8000
- **API Documentation**: http://10.15.26.249:8000/docs

### 💻 **Option 2: Localhost** (Same Computer)
**If running on this machine:**

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### 🌐 **Option 3: Remote Access** (GitHub + Alternative Deployments)
- **GitHub Repository**: https://github.com/Ritik650/SYNAPSE
- **Frontend (Vercel)**: https://synapse-seven-tau.vercel.app
- **Backend (Railway)**: https://synapse-backend-production-a42b.up.railway.app

---

## 👤 **Demo Account Credentials**

```
Email:    aarav@synapse.demo
Password: synapse-demo-2024
```

**Pre-loaded Data**: 120 days of synthetic health metrics ready to explore

---

## 🚀 **How to Run Locally**

### Prerequisites:
- Docker & Docker Compose installed
- Access to the same network (10.15.26.249)

### Steps:

1. **Navigate to project:**
   ```bash
   cd c:\Users\ry981\Downloads\Synapse
   ```

2. **Start services:**
   ```bash
   docker compose up -d
   ```

3. **Verify services are running:**
   ```bash
   docker compose ps
   ```
   
   Should show:
   ```
   synapse-backend-1  (0.0.0.0:8000->8000/tcp)
   synapse-frontend-1 (0.0.0.0:5173->5173/tcp)
   ```

4. **Access application:**
   - Open: http://10.15.26.249:5173 in any browser
   - Login with demo credentials above
   - Explore the dashboard!

5. **Stop services:**
   ```bash
   docker compose down
   ```

---

## ✨ **Key Features to Demo**

### 1️⃣ **Authentication**
- ✓ Secure login system
- ✓ JWT-based token auth
- ✓ Pre-seeded demo account

### 2️⃣ **Dashboard**
- ✓ Real-time health metrics visualization
- ✓ 120 days of historical data
- ✓ Multiple health dimensions tracked

### 3️⃣ **AI-Powered Insights**
- ✓ Claude Sonnet 4.5 integration
- ✓ Intelligent health analysis
- ✓ Personalized recommendations

### 4️⃣ **Data Visualization**
- ✓ Interactive Recharts visualizations
- ✓ Responsive design
- ✓ Real-time updates

### 5️⃣ **API Documentation**
- ✓ Full Swagger/OpenAPI docs
- ✓ 20+ endpoints
- ✓ Try-it-out functionality

---

## 🛠️ **Tech Stack**

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Recharts |
| **Backend** | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| **AI** | Anthropic Claude Sonnet 4.5 |
| **Database** | SQLite (dev), PostgreSQL (prod) |
| **Containerization** | Docker & Docker Compose |
| **Deployment** | Vercel (frontend), Railway (backend) |
| **Authentication** | JWT with bcrypt hashing |

---

## 📊 **Project Structure**

```
Synapse/
├── frontend/                 # React UI
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom hooks
│   │   └── lib/             # Utilities & API calls
│   └── Dockerfile
├── backend/                  # FastAPI server
│   ├── app/
│   │   ├── api/             # API endpoints
│   │   ├── models/          # Database models
│   │   ├── services/        # Business logic
│   │   ├── intelligence/    # AI integration
│   │   └── core/            # Configuration
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.yml        # Local development setup
└── README.md
```

---

## 🔑 **API Endpoints** (Sample)

- `POST /api/v1/auth/login` - User authentication
- `GET /api/v1/health` - Health check
- `POST /api/v1/seed` - Seed demo data
- `GET /api/v1/health-metrics` - Get user metrics
- `GET /api/v1/intelligence/brief` - AI health brief
- `GET /api/v1/timeline` - Health timeline

**Full docs available at**: http://10.15.26.249:8000/docs

---

## ❓ **Troubleshooting**

### Services not starting?
```bash
docker compose logs backend
docker compose logs frontend
```

### Can't connect to http://10.15.26.249:5173?
- Verify you're on the same WiFi network
- Check firewall settings
- Try localhost instead: http://localhost:5173

### Demo login fails?
- Seed data first: `curl -X POST http://10.15.26.249:8000/api/v1/seed`
- Check backend logs: `docker compose logs backend`

### Ports already in use?
```bash
docker compose down
# Wait 10 seconds
docker compose up -d
```

---

## 📞 **Support**

- **Repository**: https://github.com/Ritik650/SYNAPSE
- **Author**: Ritik Yadav
- **Email**: ry9812262@gmail.com

---

## 📝 **Submission Notes**

✅ Application is fully functional and ready for evaluation  
✅ Demo data is pre-seeded with 120 days of health metrics  
✅ All core features implemented and tested  
✅ Responsive design works on desktop browsers  
✅ API documentation complete and interactive  

**Enjoy exploring Synapse! 🚀**
