# FocusWise

A productivity and focus management app built with Expo.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Google OAuth Setup

FocusWise uses backend-driven OAuth for Google Calendar integration. See [OAuth Testing Guide](doc/oauth-testing.md) for detailed setup instructions.

### Quick Start

1. **Set up backend environment**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Start ngrok** (for local development):
   ```bash
   ngrok http 3000
   ```

3. **Configure Google Cloud Console**:
   - Add redirect URI: `https://your-ngrok-url.ngrok-free.dev/api/auth/google/callback`
   - Enable Calendar API and required scopes

4. **Start backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```

5. **Test OAuth flow**:
   - Use debug endpoint: `http://localhost:3000/api/auth/debug/oauth`
   - Or trigger sign-in from mobile app

For complete setup instructions, see [doc/oauth-testing.md](doc/oauth-testing.md).

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
