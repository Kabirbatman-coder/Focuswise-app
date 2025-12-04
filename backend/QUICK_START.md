# 🚀 Quick Start Guide - Backend Server

## ⚠️ IMPORTANT: The backend server MUST be running!

The error "Unable to connect to localhost:3000" means the backend server is not running.

## How to Start the Backend

### **Option 1: Using npm (Recommended)**

Open a terminal in the backend folder and run:

```bash
cd FocusWise/backend
npm run start
```

You should see:
```
Server running on port 3000
```

### **Option 2: Using ts-node-dev directly**

```bash
cd FocusWise/backend
npx ts-node-dev src/index.ts
```

## ✅ Verify Server is Running

1. Open your browser
2. Go to: `http://localhost:3000`
3. You should see: "FocusWise Backend is running"

## 🔧 Troubleshooting

### Server won't start?

**1. Check if port 3000 is already in use:**
```bash
# Windows PowerShell
netstat -ano | findstr :3000

# If something is using it, kill the process or change PORT in .env
```

**2. Check environment variables:**
Make sure `FocusWise/backend/.env` exists with:
```env
PORT=3000
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
```

**3. Install dependencies if missing:**
```bash
cd FocusWise/backend
npm install
```

**4. Check for TypeScript errors:**
```bash
cd FocusWise/backend
npm run typecheck
```

## 📱 Testing from Mobile App

**For Android Emulator:**
- Use: `http://10.0.2.2:3000` (already configured in AuthContext)

**For iOS Simulator:**
- Use: `http://localhost:3000` (already configured)

**For Physical Device:**
- Find your computer's IP address
- Update `BACKEND_URL` in `AuthContext.tsx` to use your IP instead of localhost

## 🎯 Next Steps

1. ✅ Start backend server (`npm run start`)
2. ✅ Verify it's running (`http://localhost:3000`)
3. ✅ Start Expo app (`npx expo start`)
4. ✅ Try connecting Google Calendar from Settings

---

**Remember:** Keep the backend server running while testing the app!

