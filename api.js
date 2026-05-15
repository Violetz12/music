const API_KEY = "13cc8bfa580be368a5b6ae7743cc2dee";
const YOUTUBE_API_KEY = "AIzaSyBjoaq2gMZRcAtMHFP-xOr7xoabwI2O3T4";

const DEFAULT_ALBUM_ART = "https://via.placeholder.com/150";

class PlaylistManager {
  constructor() {
    this.playlists =
      JSON.parse(localStorage.getItem("playlists")) || {};
  }

  save() {
    localStorage.setItem(
      "playlists",
      JSON.stringify(this.playlists)
    );
  }

  createPlaylist(name) {
    if (!this.playlists[name]) {
      this.playlists[name] = [];
      this.save();
    }
  }

  addSong(playlistName, song) {
    if (!this.playlists[playlistName]) {
      this.createPlaylist(playlistName);
    }

    this.playlists[playlistName].push(song);
    this.save();
  }

  removeSong(playlistName, index) {
    this.playlists[playlistName].splice(index, 1);
    this.save();
  }

  getPlaylist(name) {
    return this.playlists[name] || [];
  }
}

const playlistManager = new PlaylistManager();

class MusicApp {
  constructor() {
    this.favorites = JSON.parse(localStorage.getItem("favorites")) || [];
    this.page = 1;
    this.currentQuery = null;

    this.init();
  }

  init() {
    this.loadTrending();
    this.setupSearch();
    this.setupInfiniteScroll();
  }

  async fetchLastFM(url) {
    const res = await fetch(url);
    return await res.json();
  }

  async loadTrending() {
    const data = await this.fetchLastFM(
      `https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=${API_KEY}&format=json`
    );

    const tracks = data?.tracks?.track || [];
    this.render(tracks, "recommended-grid");
  }

  async search(query, page = 1) {
    this.currentQuery = query;

    const data = await this.fetchLastFM(
      `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${query}&api_key=${API_KEY}&format=json`
    );

    const tracks =
      data?.results?.trackmatches?.track || [];

    this.render(tracks, "recommended-grid", page === 1);
  }


  render(tracks, gridId, replace = false) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (replace) grid.innerHTML = "";

    tracks.forEach(track => {
      const title = track.name;
      const artist =
        typeof track.artist === "string"
          ? track.artist
          : track.artist?.name;

      const image =
        track.image?.[2]?.["#text"] ||
        DEFAULT_ALBUM_ART;

      const card = document.createElement("div");
      card.className = "album-card";

      card.innerHTML = `
        <div class="album-art"
          style="background-image:url('${image}')">

          <div class="album-overlay">

            <button class="heart-button">
              ♥
            </button>

            <button class="play-button">
              ▶
            </button>

          </div>
        </div>

        <div class="track-info">
          <div class="track-title">${title}</div>
          <div class="track-artist">${artist}</div>
        </div>
      `;

      // ❤️ favorite
      card.querySelector(".heart-button")
        .addEventListener("click", () => {
          this.toggleFavorite({ title, artist, image });
        });

      // 🎧 play
      card.querySelector(".play-button")
        .addEventListener("click", async () => {
          await this.playTrack(`${title} ${artist}`);
        });

      grid.appendChild(card);
    });
  }

  async playTrack(title, artist) {
    const query = `${title} ${artist}`;

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}&type=video&maxResults=10`
    );

    const data = await res.json();

    const items = data.items || [];

    // score each result
    const scored = items.map(video => {
      const text = video.snippet.title.toLowerCase();

      let score = 0;

      if (text.includes("official music video")) score += 10;
      if (text.includes("official video")) score += 9;
      if (text.includes("official audio")) score += 8;
      if (text.includes("topic")) score += 6;
      if (text.includes("lyrics")) score += 5;
      if (text.includes("cover")) score -= 5;
      if (text.includes("remix")) score -= 5;

      return {
        videoId: video.id.videoId,
        score
      };
    });

    // pick best match
    const best = scored.sort((a, b) => b.score - a.score)[0];

    if (!best) return;

    this.showPlayer(best.videoId);
  }

  toggleFavorite(track) {
    const exists = this.favorites.find(
      f => f.title === track.title && f.artist === track.artist
    );

    if (exists) {
      this.favorites = this.favorites.filter(
        f => !(f.title === track.title && f.artist === track.artist)
      );
    } else {
      this.favorites.push(track);
    }

    localStorage.setItem(
      "favorites",
      JSON.stringify(this.favorites)
    );

    console.log("Favorites:", this.favorites);
  }

  showPlayer(videoId) {
    let player = document.querySelector(".cd-player-inner");

    player.innerHTML = `
      <iframe width="100%" height="100%"
        src="https://www.youtube.com/embed/${videoId}?autoplay=1"
        frameborder="0"
        allow="autoplay; encrypted-media"
        allowfullscreen>
      </iframe>
    `;
  }

  setupSearch() {
    const input = document.querySelector(".song-search input");
    const button = document.querySelector(".search-button");

    input.addEventListener("input", (e) => {
      const q = e.target.value;

      if (q.length > 2) this.search(q);
      if (q.length === 0) this.loadTrending();
    });

    button.addEventListener("click", () => {
      const q = input.value;
      if (q.length > 2) this.search(q);
    });
  }

  setupInfiniteScroll() {
    window.addEventListener("scroll", () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 200
      ) {
        if (this.currentQuery) {
          this.page++;
          this.search(this.currentQuery, this.page);
        }
      }
    });
  }
}

const app = new MusicApp();