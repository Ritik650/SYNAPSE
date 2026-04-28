# 🔥 NETWORK ACCESS FIX GUIDE

## Problem
Remote devices can't reach http://10.15.26.249:5173 and http://10.15.26.249:8000

## Root Cause
Windows Firewall is blocking inbound traffic on ports 5173 and 8000

## Solution 1: Allow Docker Ports in Windows Firewall (RECOMMENDED)

**Option A: Using PowerShell (Run as Administrator)**

```powershell
# Allow frontend port 5173
New-NetFirewallRule -DisplayName "Synapse Frontend (5173)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -Profile Domain,Private,Public

# Allow backend port 8000  
New-NetFirewallRule -DisplayName "Synapse Backend (8000)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -Profile Domain,Private,Public
```

**Option B: Using GUI**

1. Open **Windows Defender Firewall with Advanced Security**
2. Click **Inbound Rules** → **New Rule**
3. Select **Port** → **Next**
4. Select **TCP**, enter port **5173** → **Next**
5. Select **Allow the connection** → **Next**
6. Check all profiles (Domain, Private, Public) → **Next**
7. Name: "Synapse Frontend" → **Finish**
8. Repeat for port **8000** with name "Synapse Backend"

## Solution 2: Disable Firewall (NOT RECOMMENDED - USE ONLY FOR TESTING)

```powershell
# Temporarily disable firewall
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled $false

# Re-enable it later
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled $true
```

## Verify Network Access Works

After applying firewall rules, test from another device:

```bash
# Test frontend
curl http://10.15.26.249:5173

# Test backend
curl http://10.15.26.249:8000/api/v1/health
```

## Alternative: If Firewall Fix Doesn't Work

Check if ports are actually listening:

```powershell
netstat -ano | findstr :5173
netstat -ano | findstr :8000
```

Both should show entries for 0.0.0.0 (listening on all interfaces).

---

**After applying firewall rules, judges can access from their devices:**
- Frontend: http://10.15.26.249:5173
- Backend: http://10.15.26.249:8000/api/v1
- Demo: aarav@synapse.demo / synapse-demo-2024
