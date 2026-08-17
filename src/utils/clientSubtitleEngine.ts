// Real-time Autonomous Radio Broadcast Subtitle Engine (Live STT Synchronizer)
import { SubtitleItem, RadioStation } from '../types';
import { getApiUrl } from './apiUrl';
import { safeApiFetch } from './safeFetch';

class ClientSubtitleEngine {
  private activeStation: RadioStation | null = null;
  private isStreaming = false;
  private onNewSubtitleCallback: ((item: SubtitleItem) => void) | null = null;
  private setSttConnectedCallback: ((connected: boolean) => void) | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastPollTimestamp = 0;
  private seenSubtitleIds = new Set<string>();

  public start(
    station: RadioStation,
    onNewSubtitle: (item: SubtitleItem) => void,
    setSttConnected: (connected: boolean) => void
  ) {
    this.activeStation = station;
    this.onNewSubtitleCallback = onNewSubtitle;
    this.setSttConnectedCallback = setSttConnected;
    this.isStreaming = true;
    this.lastPollTimestamp = Date.now() - 3000;

    // 1. Notify backend server to synchronize STT recognition to this exact radio stream
    safeApiFetch('/api/notify-station-playing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: station.streamUrl, name: station.name }),
    }).catch(() => {});

    // 2. Clear old polling interval if any
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    setSttConnected(true);

    // 3. High-frequency live polling fallback (every 2.5s) to guarantee zero subtitles missed
    this.pollingInterval = setInterval(() => {
      if (this.isStreaming && this.activeStation) {
        this.fetchLiveSubtitles();
      }
    }, 2500);

    // Initial fetch immediately
    this.fetchLiveSubtitles();
  }

  public recordExternalSubtitle() {
    this.lastPollTimestamp = Date.now();
  }

  private async fetchLiveSubtitles() {
    if (!this.isStreaming || !this.activeStation) return;

    try {
      const url = getApiUrl(`/api/live-subtitles?since=${this.lastPollTimestamp}`);
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;

      const data = await res.json();
      if (data && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
        if (this.setSttConnectedCallback) {
          this.setSttConnectedCallback(true);
        }

        data.subtitles.forEach((sub: any) => {
          if (sub && sub.id && sub.english && !this.seenSubtitleIds.has(sub.id)) {
            this.seenSubtitleIds.add(sub.id);
            if (this.seenSubtitleIds.size > 200) {
              const firstKey = this.seenSubtitleIds.keys().next().value;
              if (firstKey) this.seenSubtitleIds.delete(firstKey);
            }

            const subCreatedAt = sub.createdAt || Date.now();
            this.lastPollTimestamp = Math.max(this.lastPollTimestamp, subCreatedAt);

            const localFormattedTime = new Date(subCreatedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            });

            const newItem: SubtitleItem = {
              id: sub.id,
              timestamp: localFormattedTime,
              createdAt: subCreatedAt,
              english: sub.english,
              traditionalChinese: sub.traditionalChinese || sub.english,
              isFinal: true,
            };

            if (this.onNewSubtitleCallback && this.isStreaming) {
              this.onNewSubtitleCallback(newItem);
            }

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('new-subtitle', { detail: newItem }));
            }
          }
        });
      }
    } catch (err) {
      // network glitch
    }
  }

  public stop() {
    this.isStreaming = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

export const clientSubtitleEngine = new ClientSubtitleEngine();
