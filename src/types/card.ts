export type ReviewFeedback = 'forgot' | 'vague' | 'remembered';

export type ReviewAdjustType = 'tomorrow' | '3days' | 'nextWeek' | 'custom' | 'skip';

export interface ReviewHistoryItem {
  id: string;
  cardId: string;
  feedback: ReviewFeedback;
  masteryBefore: number;
  masteryAfter: number;
  reviewedAt: number;
  nextReviewAt: number;
  adjusted?: boolean;
  adjustReason?: string;
}

export interface Card {
  id: string;
  content: string;
  source?: string;
  sourceType?: 'book' | 'course' | 'article' | 'other';
  themes: string[];
  relatedCardIds: string[];
  relatedNoteIds: string[];
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
  linkToCards: boolean;
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

export interface CalendarDayData {
  date: string;
  timestamp: number;
  totalScheduled: number;
  completed: number;
  overdue: number;
  cardIds: string[];
  completedCardIds: string[];
}

export interface CalendarWeekData {
  weekStart: string;
  weekEnd: string;
  days: CalendarDayData[];
  totalScheduled: number;
  totalCompleted: number;
}

export interface CalendarMonthData {
  year: number;
  month: number;
  weeks: CalendarWeekData[];
  totalScheduled: number;
  totalCompleted: number;
}
