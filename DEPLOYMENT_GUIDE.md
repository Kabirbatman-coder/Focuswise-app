# FocusWise Deployment Guide

This guide will help you:
1. Build the APK locally
2. Upload to Google Drive
3. Push to GitHub with Apache License 2.0

## Prerequisites

### 1. Install Java 11 or Higher

Your system currently has Java 8, but the build requires Java 11+.

**Option A: Install Java 11+ (Recommended)**
1. Download Java 11 or newer from: https://adoptium.net/ (or Oracle JDK)
2. Install it
3. Set JAVA_HOME environment variable:
   - Open System Properties → Environment Variables
   - Add new System Variable:
     - Name: `JAVA_HOME`
     - Value: `C:\Program Files\Java\jdk-11` (or your Java 11+ installation path)
   - Update PATH to include: `%JAVA_HOME%\bin`
4. Restart your terminal/PowerShell

**Option B: Use Android Studio's JDK**
If you have Android Studio installed, you can use its bundled JDK:
- Usually located at: `C:\Program Files\Android\Android Studio\jbr`
- Set JAVA_HOME to this path

### 2. Verify Java Version
```powershell
java -version
```
Should show version 11 or higher.

## Step 1: Build APK Locally

### Method 1: Using Gradle (Recommended)

1. Navigate to the android directory:
   ```powershell
   cd android
   ```

2. Build the debug APK:
   ```powershell
   .\gradlew assembleDebug
   ```

3. The APK will be located at:
   ```
   android\app\build\outputs\apk\debug\app-debug.apk
   ```

4. Build the release APK (for distribution):
   ```powershell
   .\gradlew assembleRelease
   ```
   
   The release APK will be at:
   ```
   android\app\build\outputs\apk\release\app-release.apk
   ```

### Method 2: Using Expo (Alternative)

If you have an Android device or emulator connected:
```powershell
npx expo run:android --variant release
```

## Step 2: Upload APK to Google Drive

1. **Locate your APK file:**
   - Debug: `android\app\build\outputs\apk\debug\app-debug.apk`
   - Release: `android\app\build\outputs\apk\release\app-release.apk`

2. **Upload to Google Drive:**
   - Go to https://drive.google.com
   - Click "New" → "File upload"
   - Select your APK file
   - Wait for upload to complete

3. **Set Sharing Permissions:**
   - Right-click on the uploaded APK file
   - Click "Share" or "Get link"
   - Under "General access", change to "Anyone with the link"
   - Set permission to "Viewer" (read-only)
   - Click "Copy link"
   - Click "Done"

4. **Test the link:**
   - Open the link in an incognito/private browser window
   - Verify you can download the APK without signing in

## Step 3: Push to GitHub

### 1. Prepare Your Repository

The LICENSE file (Apache 2.0) has already been created. Make sure all your changes are ready:

```powershell
# Check status
git status

# Add all files (or selectively add what you want)
git add .

# Commit your changes
git commit -m "Add Apache License 2.0 and prepare for release"
```

### 2. Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `FocusWise` (or your preferred name)
3. Description: "A productivity and focus management app built with Expo"
4. Set to **Public** (if you want it open source) or **Private**
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### 3. Push to GitHub

GitHub will show you commands. Use these:

```powershell
# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/FocusWise.git

# Or if you prefer SSH:
# git remote add origin git@github.com:YOUR_USERNAME/FocusWise.git

# Rename branch to main if needed (GitHub uses 'main' by default)
git branch -M main

# Push to GitHub
git push -u origin main
```

### 4. Verify License on GitHub

1. Go to your repository on GitHub
2. The LICENSE file should be visible in the root
3. GitHub will automatically detect it as Apache License 2.0
4. You can verify by checking the repository's "About" section

## Quick Reference

### APK Location After Build
- **Debug APK**: `FocusWise\android\app\build\outputs\apk\debug\app-debug.apk`
- **Release APK**: `FocusWise\android\app\build\outputs\apk\release\app-release.apk`

### Google Drive Sharing
- Link format: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
- Make sure sharing is set to "Anyone with the link"

### GitHub Repository
- Should include: LICENSE (Apache 2.0), README.md, and all source code
- The LICENSE file is already in place at the root

## Troubleshooting

### Java Version Issues
- Make sure JAVA_HOME points to Java 11+
- Restart terminal after setting JAVA_HOME
- Verify with: `java -version` and `echo $env:JAVA_HOME`

### Gradle Build Fails
- Clean build: `.\gradlew clean`
- Try again: `.\gradlew assembleDebug`
- Check Android SDK is properly configured

### Git Push Issues
- Make sure you're authenticated with GitHub
- Use personal access token if 2FA is enabled
- Check remote URL: `git remote -v`

## Next Steps

After completing these steps:
1. ✅ APK uploaded to Google Drive with public link
2. ✅ Code pushed to GitHub with Apache License 2.0
3. Update your README.md with the Google Drive link
4. Consider adding a releases section in GitHub

