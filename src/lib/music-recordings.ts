import type { MusicThemeId } from "./music-themes";

/**
 * Real instrumental recordings by Kevin MacLeod, licensed CC BY 4.0.
 * Source: https://incompetech.com/music/royalty-free/faq.html
 *
 * Bundled versions are encoded at a lower MP3 bitrate for in-game use; the
 * source recordings and credits must remain identified in the Settings screen.
 * The remote URL is only a fallback when a deployment lacks the local files.
 */
export interface LicensedMusicTrack {
  id: string;
  title: string;
  isrc: string;
  file: string;
  page: string;
  originalUrl: string;
}

export const MUSIC_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
export const MUSIC_CREATOR = "Kevin MacLeod (incompetech.com)";

export const LICENSED_TRACKS: readonly LicensedMusicTrack[] = [
  {
    id: "airport-lounge", title: "Airport Lounge", isrc: "USUAN1100806",
    file: "/music/airport-lounge.mp3",
    page: "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100806",
    originalUrl: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Airport%20Lounge.mp3",
  },
  {
    id: "easy-lemon", title: "Easy Lemon", isrc: "USUAN1200076",
    file: "/music/easy-lemon.mp3",
    page: "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200076",
    originalUrl: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Easy%20Lemon.mp3",
  },
  {
    id: "backbay-lounge", title: "Backbay Lounge", isrc: "USUAN1700068",
    file: "/music/backbay-lounge.mp3",
    page: "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1700068",
    originalUrl: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Backbay%20Lounge.mp3",
  },
  {
    id: "bossa-antigua", title: "Bossa Antigua", isrc: "USUAN1700069",
    file: "/music/bossa-antigua.mp3",
    page: "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1700069",
    originalUrl: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bossa%20Antigua.mp3",
  },
  {
    id: "local-forecast", title: "Local Forecast", isrc: "USUAN1300010",
    file: "/music/local-forecast.mp3",
    page: "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300010",
    originalUrl: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Local%20Forecast.mp3",
  },
  {
    id: "chill-wave", title: "Chill Wave", isrc: "USUAN1600048",
    file: "/music/chill-wave.mp3",
    page: "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1600048",
    originalUrl: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Chill%20Wave.mp3",
  },
];

const [airport, lemon, backbay, bossa, forecast, chill] = LICENSED_TRACKS;

/** Explicit mappings: a different real recording for every map. */
export const MUSIC_FOR_THEME: Record<MusicThemeId, LicensedMusicTrack> = {
  menu: airport,
  lobby: forecast,
  compound: airport,
  skybridge: lemon,
  bunker: backbay,
  shipyard: bossa,
  terminal: forecast,
  arena_neon: chill,
};
