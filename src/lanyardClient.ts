const fetch = require("node-fetch");

export interface SpotifyData {
  timestamps: {
    start: number
    end: number
  }
  album: string
  album_art_url: string
  artist: string
  song: string
  track_id: string
}

export interface LanyardResponse {
  data: {
    spotify: SpotifyData | null
    listening_to_spotify: boolean
  }
  success: boolean
}

export class LanyardClient {
  async fetchUserData(discordId: string): Promise<LanyardResponse> {
    const response = await fetch(`https://api.lanyard.rest/v1/users/${discordId}`)
    if (!response.ok) {
      throw new Error("Failed to fetch user data")
    }
    return response.json() as Promise<LanyardResponse>
  }
}

