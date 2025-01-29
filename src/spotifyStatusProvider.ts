import * as vscode from "vscode"
import { type LanyardClient, SpotifyData } from "./lanyardClient"

export class SpotifyStatusProvider {
  private discordId: string | undefined
  private currentPanel: vscode.WebviewView | undefined
  private updateInterval: NodeJS.Timeout | undefined

  constructor(
    private context: vscode.ExtensionContext,
    private lanyardClient: LanyardClient,
  ) {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider("spotify-lanyard.playerView", {
        resolveWebviewView: this.resolveWebviewView.bind(this),
      }),
    )
  }

  private resolveWebviewView(webviewView: vscode.WebviewView) {
    this.currentPanel = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    }

    webviewView.webview.html = this.getWebviewContent()

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "setDiscordId":
          this.updateDiscordId(message.discordId)
          break
        case "openLink":
          vscode.env.openExternal(vscode.Uri.parse(message.url))
          break
        case "changeDiscordId":
          if (this.updateInterval) {
            clearInterval(this.updateInterval)
            this.updateInterval = undefined
          }
          this.discordId = undefined
          this.context.globalState.update("discordId", undefined)
          this.showConfigView()
          break
      }
    })

    this.discordId = this.context.globalState.get<string>("discordId")
    if (this.discordId) {
      this.startUpdating()
    }
  }

  async updateDiscordId(discordId: string) {
    try {
      const data = await this.lanyardClient.fetchUserData(discordId)
      if (data.success) {
        this.discordId = discordId
        this.context.globalState.update("discordId", discordId)
        this.startUpdating()
        if (this.currentPanel) {
          this.currentPanel.webview.postMessage({ type: "idValidated" })
        }
      } else {
        if (this.currentPanel) {
          this.currentPanel.webview.postMessage({
            type: "error",
            message:
              "User not found! Make sure you're in the Lanyard Discord server: https://discord.com/invite/UrXF2cfJ7F",
          })
        }
      }
    } catch (error) {
      console.error("Failed to validate Discord ID:", error)
      if (this.currentPanel) {
        this.currentPanel.webview.postMessage({
          type: "error",
          message: "Failed to validate Discord ID. Please try again.",
        })
      }
    }
  }

  private showErrorMessage(message: string) {
    if (this.currentPanel) {
      this.currentPanel.webview.postMessage({ type: "error", message })
    }
  }

  private showConfigView() {
    if (this.currentPanel) {
      this.currentPanel.webview.postMessage({ type: "showConfig" })
    }
  }

  private startUpdating() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }

    this.updateSpotifyStatus()
    this.updateInterval = setInterval(() => this.updateSpotifyStatus(), 1000)
  }

  private async updateSpotifyStatus() {
    if (!this.discordId || !this.currentPanel) return

    try {
      const data = await this.lanyardClient.fetchUserData(this.discordId)
      if (data.data.listening_to_spotify && data.data.spotify) {
        this.currentPanel.webview.postMessage({
          type: "update",
          data: data.data.spotify,
        })
      } else {
        this.currentPanel.webview.postMessage({
          type: "notPlaying",
        })
      }
    } catch (error) {
      console.error("Failed to fetch Spotify data:", error)
      this.currentPanel.webview.postMessage({
        type: "error",
        message: "Failed to fetch Spotify data",
      })
    }
  }

  togglePlayer() {
    if (this.currentPanel) {
      this.currentPanel.show?.(true)
    }
  }

  dispose() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
  }

  private getWebviewContent() {
    const nonce = this.getNonce()

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
            <title>Spotify Player</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    padding: 16px;
                    color: #e4e4e4;
                    background-color: #1e1e1e;
                    margin: 0;
                }
                .container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    max-width: 300px;
                    margin: 0 auto;
                    opacity: 0;
                    transform: translateY(20px);
                    animation: fadeIn 0.5s ease forwards;
                }
                @keyframes fadeIn {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                #albumArt {
                    width: 100%;
                    aspect-ratio: 1;
                    max-width: 200px;
                    border-radius: 8px;
                    transition: all 0.3s ease;
                    cursor: pointer;
                    object-fit: cover;
                    opacity: 0;
                    transform: scale(0.9);
                    animation: albumAppear 0.5s ease forwards 0.3s;
                }
                @keyframes albumAppear {
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                #albumArt:hover {
                    transform: scale(1.05);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                }
                .song-info {
                    margin-top: 10px;
                    text-align: center;
                    width: 100%;
                    opacity: 0;
                    transform: translateY(10px);
                    animation: slideUp 0.5s ease forwards 0.5s;
                }
                @keyframes slideUp {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                #songTitle {
                    font-size: 16px;
                    font-weight: 500;
                    margin-bottom: 5px;
                }
                #artist {
                    font-size: 14px;
                    color: #b3b3b3;
                    cursor: pointer;
                    transition: color 0.3s ease;
                }
                #artist:hover {
                    color: #fff;
                }
                .progress-bar {
                    width: 100%;
                    height: 4px;
                    background-color: #282828;
                    border-radius: 2px;
                    margin-top: 10px;
                    overflow: hidden;
                    opacity: 0;
                    transform: scaleX(0.8);
                    animation: progressAppear 0.5s ease forwards 0.7s;
                }
                @keyframes progressAppear {
                    to {
                        opacity: 1;
                        transform: scaleX(1);
                    }
                }
                #progress {
                    width: 0%;
                    height: 100%;
                    background-color: #1db954;
                    transition: width 1s linear;
                }
                #time {
                    font-size: 12px;
                    color: #b3b3b3;
                    margin-top: 5px;
                    text-align: right;
                    opacity: 0;
                    animation: fadeIn 0.5s ease forwards 0.9s;
                }
                #discordIdInput {
                    width: 100%;
                    padding: 8px 12px;
                    background: #282828;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    color: #fff;
                    font-size: 14px;
                    margin-bottom: 12px;
                    box-sizing: border-box;
                    transition: all 0.3s ease;
                    opacity: 0;
                    transform: translateY(10px);
                    animation: slideUp 0.5s ease forwards;
                }
                #discordIdInput:focus {
                    outline: none;
                    border-color: #1db954;
                    box-shadow: 0 0 0 2px rgba(29, 185, 84, 0.1);
                }
                .btn {
                    width: 100%;
                    padding: 8px 16px;
                    background: #282828;
                    border: none;
                    border-radius: 4px;
                    color: #fff;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    opacity: 0;
                    transform: translateY(10px);
                    animation: slideUp 0.5s ease forwards 0.2s;
                }
                .btn:hover {
                    background: #333;
                    transform: translateY(-1px);
                }
                .btn-change {
                    width: auto;
                    background: transparent;
                    border: 1px solid #404040;
                    margin-top: 16px;
                    padding: 4px 12px;
                    font-size: 12px;
                    opacity: 0;
                    animation: fadeIn 0.5s ease forwards 1.1s;
                }
                .btn-change:hover {
                    opacity: 1;
                    background: rgba(255, 255, 255, 0.1);
                    border-color: #666;
                }
                .view {
                    display: none;
                    width: 100%;
                }
                .view.active {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    animation: viewTransition 0.5s ease forwards;
                }
                @keyframes viewTransition {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                #configView {
                    width: 100%;
                }
                #playerContent {
                    width: 100%;
                }
                #notPlaying {
                    text-align: center;
                    opacity: 0;
                    animation: fadeIn 0.5s ease forwards;
                }
                .pulse {
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.05);
                    }
                    100% {
                        transform: scale(1);
                    }
                }
                .error-message {
                    color: #ff6b6b;
                    font-size: 14px;
                    margin-top: 10px;
                    text-align: center;
                    opacity: 0;
                    animation: fadeIn 0.5s ease forwards;
                }
                .success-message {
                    color: #1db954;
                    font-size: 14px;
                    margin-top: 10px;
                    text-align: center;
                    opacity: 0;
                    animation: fadeIn 0.5s ease forwards;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div id="configView" class="view">
                    <input type="text" 
                        id="discordIdInput" 
                        placeholder="Enter your Discord ID"
                        autocomplete="off"
                        spellcheck="false"
                    >
                    <button id="configButton" class="btn">Set Discord ID</button>
                    <div id="statusMessage" class="error-message"></div>
                </div>
                
                <div id="playerContent" class="view">
                    <img id="albumArt" src="/placeholder.svg" alt="Album Art">
                    <div class="song-info">
                        <div id="songTitle"></div>
                        <div id="artist"></div>
                    </div>
                    <div class="progress-bar">
                        <div id="progress"></div>
                    </div>
                    <div id="time"></div>
                    <button id="changeIdButton" class="btn btn-change">Change Discord ID</button>
                </div>

                <div id="notPlaying" class="view">
                    <p>Not currently playing any music on Spotify.</p>
                    <button id="changeIdButton2" class="btn btn-change">Change Discord ID</button>
                </div>
            </div>
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                let currentData = null;
                let startTime = 0;
                let duration = 0;

                function setActiveView(viewId) {
                    document.querySelectorAll('.view').forEach(view => {
                        view.classList.remove('active');
                    });
                    const targetView = document.getElementById(viewId);
                    targetView.classList.add('active');
                }

                document.getElementById('configButton').addEventListener('click', () => {
                    const discordId = document.getElementById('discordIdInput').value;
                    if (discordId) {
                        document.getElementById('configButton').classList.add('pulse');
                        document.getElementById('statusMessage').textContent = 'Validating...';
                        document.getElementById('statusMessage').className = 'status-message';
                        vscode.postMessage({
                            command: 'setDiscordId',
                            discordId: discordId
                        });
                    } else {
                        document.getElementById('statusMessage').textContent = 'Please enter a Discord ID';
                        document.getElementById('statusMessage').className = 'error-message';
                    }
                });

                document.getElementById('changeIdButton').addEventListener('click', () => {
                    vscode.postMessage({ command: 'changeDiscordId' });
                });

                document.getElementById('changeIdButton2').addEventListener('click', () => {
                    vscode.postMessage({ command: 'changeDiscordId' });
                });

                document.getElementById('albumArt').addEventListener('click', () => {
                    if (currentData) {
                        vscode.postMessage({
                            command: 'openLink',
                            url: 'https://open.spotify.com/track/' + currentData.track_id
                        });
                    }
                });

                document.getElementById('artist').addEventListener('click', () => {
                    if (currentData) {
                        vscode.postMessage({
                            command: 'openLink',
                            url: 'https://open.spotify.com/search/' + encodeURIComponent(currentData.artist)
                        });
                    }
                });

                function updatePlayer(data) {
                    currentData = data;
                    const albumArt = document.getElementById('albumArt');
                    
                    albumArt.style.opacity = '0';
                    setTimeout(() => {
                        albumArt.src = data.album_art_url;
                        albumArt.style.opacity = '1';
                    }, 300);

                    document.getElementById('songTitle').textContent = data.song;
                    document.getElementById('artist').textContent = data.artist;
                    startTime = data.timestamps.start;
                    duration = data.timestamps.end - data.timestamps.start;
                    setActiveView('playerContent');
                    updateProgress();
                }

                function updateProgress() {
                    if (!currentData) return;
                    const now = Date.now();
                    const elapsed = now - startTime;
                    const progress = Math.min(100, (elapsed / duration) * 100);
                    document.getElementById('progress').style.width = progress + '%';
                    
                    const remaining = Math.max(0, duration - elapsed);
                    const minutes = Math.floor(remaining / 60000);
                    const seconds = Math.floor((remaining % 60000) / 1000);
                    document.getElementById('time').textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
                }

                setInterval(updateProgress, 1000);

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'update':
                            updatePlayer(message.data);
                            break;
                        case 'notPlaying':
                            setActiveView('notPlaying');
                            currentData = null;
                            break;
                        case 'showConfig':
                            setActiveView('configView');
                            document.getElementById('discordIdInput').value = '';
                            currentData = null;
                            break;
                        case 'idValidated':
                            document.getElementById('statusMessage').textContent = 'Discord ID validated successfully!';
                            document.getElementById('statusMessage').className = 'success-message';
                            document.getElementById('configButton').classList.remove('pulse');
                            break;
                        case 'error':
                            document.getElementById('statusMessage').textContent = message.message;
                            document.getElementById('statusMessage').className = 'error-message';
                            document.getElementById('configButton').classList.remove('pulse');
                            break;
                    }
                });

                setActiveView('configView');
            </script>
        </body>
        </html>`
  }
 
  private getNonce() {
    let text = ""
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
  }
}

