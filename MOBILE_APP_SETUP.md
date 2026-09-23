# Mobile App Setup & Packaging Guide: Android & iOS

This project is packaged into native mobile applications for **Android** and **iOS** using **Capacitor**, fully reusing the existing React + Vite web application without altering any UI, business logic, or backend functionality.

---

## 1. Quick Command Reference

| Action | Command |
| :--- | :--- |
| **Start Web App (Dev Server)** | `npm run dev` |
| **Build Web Production Bundle** | `npm run build` |
| **Sync Web Code to Android & iOS** | `npm run cap:sync` *(or `npx cap sync`)* |
| **Open Project in Android Studio** | `npm run cap:android` *(or `npx cap open android`)* |
| **Open Project in Xcode (Mac)** | `npm run cap:ios` *(or `npx cap open ios`)* |
| **Build Android Debug APK** | `npm run build:apk` *(or `cd android && ./gradlew assembleDebug`)* |
| **Build Android Release APK** | `cd android && ./gradlew assembleRelease` |
| **Build Android Play Store Bundle (AAB)** | `cd android && ./gradlew bundleRelease` |

---

## 2. Project Architecture & Configuration

- **App Name**: `BullionDesk`
- **Application ID / Package ID**: `com.bulliondesk.app`
- **Web Directory**: `dist`
- **Capacitor Configuration**: `capacitor.config.json`
- **Native Android Directory**: `android/`
- **Native iOS Directory**: `ios/`
- **Native Branding Assets**: `assets/` (Auto-generated across all Android mipmap densities and iOS `AppIcon.appiconset` & splash screens)

---

## 3. Android Setup & Build Instructions

### Prerequisites
1. **Android Studio**: Install [Android Studio](https://developer.android.com/studio) (Giraffe, Hedgehog, Iguana, or later).
2. **Android SDK**: In Android Studio, go to **Settings / Preferences → Languages & Frameworks → Android SDK**:
   - Ensure **Android SDK Platform 34 or 35** is installed.
   - Under **SDK Tools**, ensure **Android SDK Build-Tools**, **Android SDK Command-line Tools**, and **Android SDK Platform-Tools** are checked.
3. **Environment Variables**:
   Add to your `~/.zshrc` or `~/.bash_profile`:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
   ```

### Running on an Android Device or Emulator
1. Connect an Android phone via USB with **USB Debugging** enabled, or start an emulator in Android Studio.
2. Run:
   ```bash
   npm run cap:sync
   npm run cap:android
   ```
3. In Android Studio, click the green **Run (▶)** button in the top toolbar.

### Building APK & Play Store Bundle (AAB)

#### Debug APK (For Testing & Sideloading):
```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```
- **Generated APK Output Location**:
  `android/app/build/outputs/apk/debug/app-debug.apk`

#### Release APK (Unsigned):
```bash
cd android
./gradlew assembleRelease
```
- **Generated Output Location**:
  `android/app/build/outputs/apk/release/app-release-unsigned.apk`

#### Google Play Store Bundle (AAB):
```bash
cd android
./gradlew bundleRelease
```
- **Generated AAB Output Location**:
  `android/app/build/outputs/bundle/release/app-release.aab`

---

## 4. iOS Setup & Build Instructions (macOS Only)

### Prerequisites
1. **Xcode**: Install [Xcode](https://apps.apple.com/app/xcode/id497799835) from the Mac App Store.
2. Open Xcode once to accept the license agreement and install required components.
3. Configure Xcode Command Line Tools:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```

### Running on iOS Simulator or Physical iPhone
1. Open the project in Xcode:
   ```bash
   npm run cap:sync
   npm run cap:ios
   ```
2. In Xcode:
   - Select the target **App** at the top.
   - Choose your target device (e.g., **iPhone 16 Pro Simulator** or your plugged-in iPhone).
   - Click the **Run (▶)** button.

### Creating an iOS Release Archive (.ipa / App Store)
1. In Xcode, select the **App** project root in the left sidebar.
2. Under the **Signing & Capabilities** tab:
   - Check **Automatically manage signing**.
   - Select your **Apple Developer Team**.
3. Select **Product → Destination → Any iOS Device (arm64)**.
4. Select **Product → Archive**.
5. Once the Organizer window appears:
   - Click **Distribute App**.
   - Choose **App Store Connect** (for TestFlight / App Store) or **Ad-Hoc / Enterprise** for internal distribution.

---

## 5. Production Signing Credentials (Do Not Commit)

> [!IMPORTANT]
> Never commit keystores, passwords, or Apple private keys to git. Perform signing locally.

### Android Release Signing Setup:
1. Generate your release keystore (run in a secure folder):
   ```bash
   keytool -genkey -v -keystore bulliondesk-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias bulliondesk
   ```
2. Configure credentials in `android/keystore.properties` (this file is gitignored):
   ```properties
   storeFile=bulliondesk-release.jks
   storePassword=YOUR_STORE_PASSWORD
   keyAlias=bulliondesk
   keyPassword=YOUR_KEY_PASSWORD
   ```
3. Reference `keystore.properties` in `android/app/build.gradle` under `signingConfigs`.

### iOS Signing Setup:
- Managed directly through Xcode with your Apple Developer Account under **Signing & Capabilities**.

---

## 6. Troubleshooting

### 1. Web Changes Not Reflected in the App
Always run `npm run cap:sync` (or `npx cap sync`) after making changes to the React code. Capacitor copies files from `dist` into native assets.

### 2. Network / API Access Inside Native WebViews
- Android: `android:usesCleartextTraffic="true"` and `<uses-permission android:name="android.permission.INTERNET" />` are pre-configured in `android/app/src/main/AndroidManifest.xml`.
- If connecting to a local Node.js development server from an Android emulator, use `http://10.0.2.2:3001` (special loopback alias for host machine `localhost`). On physical devices, use your machine's local Wi-Fi IP (e.g. `http://192.168.1.x:3001`).

### 3. Gradle Timeout or Download Errors
The Gradle wrapper network timeout has been raised to 120 seconds in `android/gradle/wrapper/gradle-wrapper.properties`. Opening the project directly in Android Studio will handle all SDK licensing and dependencies automatically.
