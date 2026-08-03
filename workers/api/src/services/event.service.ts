import type {
  EventDetail,
  HomeResponse,
  SearchQuery,
  SearchResponse,
} from "@ticket-radar/shared";

import type { EventRepository } from "../repositories/event.repository";

export class EventService {
  constructor(private readonly repository: EventRepository) {}

  search(query: SearchQuery, userId: string | null): Promise<SearchResponse> {
    return this.repository.search(query, userId);
  }

  home(userId: string | null, now = new Date()): Promise<HomeResponse> {
    return this.repository.getHome(userId, now.toISOString());
  }

  getEvent(id: string, userId: string | null): Promise<EventDetail | null> {
    return this.repository.findById(id, userId);
  }

  async setFavorite(
    eventId: string,
    userId: string,
    shouldFavorite: boolean,
  ): Promise<{ eventId: string; isFavorited: boolean } | null> {
    const success = shouldFavorite
      ? await this.repository.favorite(eventId, userId)
      : await this.repository.unfavorite(eventId, userId);

    return success ? { eventId, isFavorited: shouldFavorite } : null;
  }

  async setFollow(
    artistId: string,
    userId: string,
    shouldFollow: boolean,
  ): Promise<{ artistId: string; isFollowed: boolean } | null> {
    const success = shouldFollow
      ? await this.repository.followArtist(artistId, userId)
      : await this.repository.unfollowArtist(artistId, userId);

    return success ? { artistId, isFollowed: shouldFollow } : null;
  }
}
