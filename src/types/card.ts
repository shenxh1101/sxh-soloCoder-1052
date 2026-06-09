export interface Card {
  id: string;
  content: string;
  source?: string;
  sourceType?: 'book' | 'course' | 'article' | 'other';
  themes: string[];
  relatedCardIds: string[];
  isFavorite: boolean;
  masteryLevel: 1 | 2 | 3 | 4 | 5;
  reviewCount: number;
  lastReviewAt?: number;
  createdAt: number;
  updatedAt: number;
  imageUrl?: string;
}

export interface Theme {
  id: string;
  name: string;
  color: string;
  cardCount: number;
}

export interface ReviewQueueItem {
  cardId: string;
  scheduledAt: number;
  isReviewed: boolean;
}

export interface DailyStats {
  date: string;
  newCards: number;
  reviewedCards: number;
}

export interface WeeklyStats {
  totalNew: number;
  totalReviewed: number;
  dailyStats: DailyStats[];
  topThemes: { name: string; count: number }[];
}
