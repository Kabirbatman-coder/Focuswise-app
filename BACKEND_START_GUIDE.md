# 🔴 BACKEND SERVER NOT RUNNING - QUICK FIX

## The Problem
You're getting "Unable to connect to localhost:3000" because **the backend server is not running**.

## ✅ SOLUTION - Start the Backend Server

### **Step 1: Open a Terminal**

Open a **NEW terminal window** (keep it open!).

### **Step 2: Navigate to Backend Folder**

```bash
cd C:\Users\kabir\Music\FocusWise\FocusWise\backend
```

### **Step 3: Start the Server**

```bash
npm run start
```

### **Step 4: You Should See**

```
[INFO] ts-node-dev ver. 2.0.0
Server running on port 3000
```

### **Step 5: Verify It's Working**

Open your browser and go to: `http://localhost:3000`

You should see: **"FocusWise Backend is running"**

---

## 🚨 IMPORTANT

**Keep the terminal window open!** The server must keep running while you test the app.

If you close the terminal, the server stops and you'll get the connection error again.

---

## 🔧 If Server Still Won't Start

1. **Check for errors in the terminal** - Read the error message
2. **Make sure .env file exists** in `backend/` folder
3. **Try installing dependencies:**
   ```bash
   cd FocusWise/backend
   npm install
   ```

---

## 📱 Testing the App

1. ✅ **Start backend server** (keep terminal open)
2. ✅ **Start Expo app** in another terminal: `cd FocusWise && npx expo start`
3. ✅ **Open app on device/emulator**
4. ✅ **Go to Settings → Toggle "Connect Google Calendar"**

The backend server MUST be running for Google Calendar login to work!

