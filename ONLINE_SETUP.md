# Fourcast — Play with friends from different locations

Fourcast is an **online multiplayer web game**. The two people can be in different countries or on different mobile networks. They do **not** need the same Wi-Fi.

## 1. Host the game on Render

1. Open **[Deploy Fourcast to Render](https://render.com/deploy?repo=https://github.com/HY0831/fourcast-number-duel)**.
2. Log in to or create your Render account. Connect your GitHub account if prompted.
3. Review the Blueprint from `render.yaml`. It creates a **single Node web service** in **Singapore**, Free plan. The server serves both the React app and Socket.IO multiplayer connections from the same URL.
4. Approve creation. When the build finishes, Render supplies a **public HTTPS link**, typically `https://fourcast-number-duel.onrender.com` (the actual assigned URL can be different; check your dashboard).
5. Open the assigned URL on **two different phones** using separate internet connections. No developer computer needs to stay on.

You can also create a Render **Web Service** manually using this repository, selecting Node, Free plan, region Singapore, build command `npm install --no-audit --no-fund && npm run build`, start command `npm start`, and health check `/health`.

**Important**: The GitHub repository is source code, not the game link. GitHub Pages or static-only hosting will not run the Socket.IO backend. A hosted Node server is necessary.

## 2. Play online

1. Player A opens the **public Render HTTPS URL** in a phone browser.
2. Enter a nickname, select **No repeats** or **Repeatable**, and tap **Create room**.
3. Copy the invite link or room code and send it through WhatsApp, Telegram, etc.
4. Player B opens the same public game URL (or the invite URL) on their own phone and joins using the six-character code.
5. Each player privately sets a four-digit number and taps **Lock my number**. Leading zeros are allowed.
6. Players alternate guesses. Feedback shows only the number of exactly correct *positions*; 4/4 wins. Start a rematch from the result screen.

A room supports two players; multiple pairs can play in different rooms simultaneously.

## 3. Important MVP limitations

- **Free instance cold starts:** Render Free instances may spin down after **15 minutes without any incoming HTTP or WebSocket activity**. Opening the website after idle can take around a minute. Playing with active connections keeps the service receiving traffic.
- **Temporary rooms:** This initial version stores rooms in **server memory**. Deployments, server restarts, and sleeping instances will lose active rooms. Create a new room if one is no longer available.
- **Reconnect:** Brief internet interruptions reconnect automatically when the game server is still running. A page refresh can restore a saved seat in the same browser.
- **One match = two players.** Larger rooms can be built in a later update.
- You need **internet**, but not necessarily Wi-Fi: mobile data works.

## 4. Developer-only setup

To test the source on a computer locally, run `npm install` and `npm run dev`. This is optional and **not required** for remote friends after the Render deployment is live.
