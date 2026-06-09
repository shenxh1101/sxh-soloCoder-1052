export type ReviewFeedback = 'forgot' | 'vague' | 'remembered';

export interface ReviewHistoryItem {
  id: string;
  cardId: string;
  feedback: ReviewFeedback;
  masteryBefore: number;
  masteryAfter: number;
  reviewedAt: number;
  nextReviewAt: number;
}

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
  nextReviewAt?: number;
  createdAt: number;
  updatedAt: number;
  imageUrl?: string;
  reviewHistory?: ReviewHistoryItem[];
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
  reviewedAt?: number;
  feedback?: ReviewFeedback;
}

export type ReviewGroup = 'overdue' | 'today' | 'tomorrow' | 'next3days' | 'next7days' | 'later';

export interface ReviewSessionSummary {
  reviewedCards: Card[];
  masteryChanges: Array<{
    card: Card;
    before: number;
    after: number;
  }>;
  nextReviewSchedule: Array<{
    card: Card;
    nextReviewAt: number;
  }>;
  totalReviewed: number;
  averageMasteryChange: number;
}

export interface ThemeNote {
  id: string;
  themeName: string;
  title: string;
  content: string;
  cardIds: string[];
  createdAt: number;
  updatedAt: number;
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
