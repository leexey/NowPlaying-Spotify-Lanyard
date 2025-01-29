import * as vscode from "vscode"
import { LanyardClient } from "./lanyardClient"
import { SpotifyStatusProvider } from "./spotifyStatusProvider"

let spotifyStatusProvider: SpotifyStatusProvider

export function activate(context: vscode.ExtensionContext) {
  const lanyardClient = new LanyardClient()
  spotifyStatusProvider = new SpotifyStatusProvider(context, lanyardClient)

  let disposable = vscode.commands.registerCommand("spotify-lanyard.togglePlayer", () => {
    spotifyStatusProvider.togglePlayer()
  })

  context.subscriptions.push(disposable)

  disposable = vscode.commands.registerCommand("spotify-lanyard.configureDiscordId", async () => {
    const discordId = await vscode.window.showInputBox({
      placeHolder: "Enter your Discord ID",
      prompt: "Enter your Discord ID to track Spotify status",
    })

    if (discordId) {
      await context.globalState.update("discordId", discordId)
      spotifyStatusProvider.updateDiscordId(discordId)
    }
  })

  context.subscriptions.push(disposable)

  const discordId = context.globalState.get<string>("discordId")
  if (discordId) {
    spotifyStatusProvider.updateDiscordId(discordId)
  }
}

export function deactivate() {
  if (spotifyStatusProvider) {
    spotifyStatusProvider.dispose()
  }
}

