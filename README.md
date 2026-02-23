<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Mossy AI Assistant

Mossy: Your step-by-step desktop companion for creative workflows, modding, and system integration.

View your app in AI Studio: https://ai.studio/apps/drive/1uEKBzDjU2KgB6zleJiVhy7QNGs4OwkjZ

---

## Run Locally (Web)

**Prerequisites:** Node.js

1. Install dependencies:
   ```
   npm install
   ```
2. Set the `GEMINI_API_KEY` in `.env.local`:
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. Run the dev server:
   ```
   npm run dev
   ```

---

## Testing

Run the comprehensive test suite (44 tests across types, logic, routing, and packaging):

```
npm test
```

Run with coverage report:

```
npm run test:coverage
```

---

## Desktop App — Run in Electron (Dev)

Preview the app in a native desktop window without building an installer:

```
npm run electron:dev
```

This starts the Vite dev server and launches Electron pointing to `localhost:3000`.

---

## Desktop App — Build Installer

Build the React app and package it into a platform installer:

```
npm run electron:build
```

Output installers are saved to the `release/` folder:

| Platform | Output |
|----------|--------|
| Windows  | `release/Mossy AI Assistant Setup x.x.x.exe` (NSIS installer) |
| macOS    | `release/Mossy AI Assistant-x.x.x.dmg` |
| Linux    | `release/Mossy AI Assistant-x.x.x.AppImage` / `.deb` |

### Quick directory-only pack (no installer, faster):

```
npm run electron:pack
```

### Important: Gemini API Key

The app requires a Gemini API key to use AI features.  
Set `GEMINI_API_KEY` in a `.env.local` file before running any build command:

```
GEMINI_API_KEY=your_key_here
```

---

## Desktop Bridge (Optional)

The **Neural Interconnect** tab (`/bridge`) lets Mossy interact with your local system.

1. Open the app and navigate to **Neural Interconnect**.
2. Click **Get Server (.py)** and **Get Launcher (.bat)**.
3. Save both files to a folder on your PC.
4. Double-click `start_mossy.bat` to start the local bridge server (requires Python 3.10+).
5. The bridge status indicator turns green when connected.
