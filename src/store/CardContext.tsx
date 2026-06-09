import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Card, Theme, ReviewQueueItem, WeeklyStats, DailyStats, ReviewFeedback, ReviewGroup, ReviewSessionSummary, ThemeNote, ReviewHistoryItem } from '@/types/card';
import { mockCards, mockThemes } from '@/data/mockCards';
import { getWeekDates } from '@/utils/date';

const STORAGE_KEYS = {
  CARDS: 'knowledge_cards_data',
  THEMES: 'knowledge_themes_data',
  REVIEW_QUEUE: 'knowledge_review_queue',
  NOTES: 'knowledge_theme_notes',
};

interface CardContextType {
  cards: Card[];
  themes: Theme[];
  reviewQueue: ReviewQueueItem[];
  themeNotes: ThemeNote[];
  searchKeyword: string;
  setSearchKeyword: (keyword: string) => void;
  addCard: (card: Omit<Card, 'id' | 'createdAt' | 'updatedAt' | 'reviewCount' | 'masteryLevel' | 'reviewHistory'>) => void;
  updateCard: (id: string, updates: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  toggleFavorite: (id: string) => void;
  markMastery: (id: string, level: 1 | 2 | 3 | 4 | 5) => void;
  markReviewed: (cardId: string, feedback?: ReviewFeedback) => { masteryBefore: number; masteryAfter: number; nextReviewAt: number };
  addTheme: (theme: Omit<Theme, 'cardCount'>) => void;
  getRandomCard: () => Card | null;
  getWeeklyStats: () => WeeklyStats;
  getRelatedCards: (cardId: string) => Card[];
  filteredCards: Card[];
  favoriteCards: Card[];
  pendingReviewCards: Card[];
  isLoading: boolean;
  getReviewGroupCards: (group: ReviewGroup) => Card[];
  getReviewGroupCount: (group: ReviewGroup) => number;
  getAllReviewGroups: () => { group: ReviewGroup; label: string; count: number }[];
  getCardReviewGroup: (card: Card) => ReviewGroup;
  calculateNextReview: (feedback: ReviewFeedback, currentMastery: number, lastReviewAt?: number) => number;
  createThemeNote: (themeName: string, cardIds: string[], groupBy?: 'source' | 'mastery') => ThemeNote;
  updateThemeNote: (noteId: string, updates: Partial<ThemeNote>) => void;
  deleteThemeNote: (noteId: string) => void;
  getThemeNotes: (themeName?: string) => ThemeNote[];
  generateSessionSummary: (reviewedCardIds: string[]) => ReviewSessionSummary;
  getOrderedReviewCards: () => Card[];
}

const CardContext = createContext<CardContextType | undefined>(undefined);

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = Taro.getStorageSync(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[CardContext] 读取存储失败:', key, e);
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    Taro.setStorageSync(key, JSON.stringify(data));
  } catch (e) {
    console.error('[CardContext] 保存存储失败:', key, e);
  }
}

function getInitialReviewQueue(cards: Card[]): ReviewQueueItem[] {
  const now = Date.now();
  return cards.slice(0, 8).map((card, index) => ({
    cardId: card.id,
    scheduledAt: now + index * 3600000,
    isReviewed: index < 3,
  }));
}

function cleanupInvalidRelations(cards: Card[]): Card[] {
  const validCardIds = new Set(cards.map(c => c.id));
  return cards.map(card => ({
    ...card,
    relatedCardIds: card.relatedCardIds.filter(id => validCardIds.has(id)),
  }));
}

const REVIEW_INTERVALS: Record<ReviewFeedback, Record<number, number>> = {
  forgot: { 1: 0, 2: 1, 3: 1, 4: 2, 5: 3 },
  vague: { 1: 1, 2: 2, 3: 3, 4: 5, 5: 7 },
  remembered: { 1: 2, 2: 4, 3: 7, 4: 14, 5: 30 },
};

const GROUP_LABELS: Record<ReviewGroup, string> = {
  overdue: '⏰ 逾期',
  today: '📅 今天',
  tomorrow: '⏳ 明天',
  next3days: '📆 未来3天',
  next7days: '🗓️ 未来7天',
  later: '🔮 以后',
};

export const CardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [themeNotes, setThemeNotes] = useState<ThemeNote[]>([]);

  useEffect(() => {
    const savedCards = loadFromStorage<Card[]>(STORAGE_KEYS.CARDS, mockCards);
    const savedThemes = loadFromStorage<Theme[]>(STORAGE_KEYS.THEMES, mockThemes);
    const savedQueue = loadFromStorage<ReviewQueueItem[] | null>(STORAGE_KEYS.REVIEW_QUEUE, null);
    const savedNotes = loadFromStorage<ThemeNote[]>(STORAGE_KEYS.NOTES, []);

    const cardsWithNextReview = savedCards.map(card => {
      if (!card.nextReviewAt) {
        return {
          ...card,
          nextReviewAt: card.lastReviewAt
            ? card.lastReviewAt + 86400000
            : card.createdAt + 86400000,
        };
      }
      return card;
    });

    const cleanedCards = cleanupInvalidRelations(cardsWithNextReview);
    const initialQueue = savedQueue || getInitialReviewQueue(cleanedCards);

    setCards(cleanedCards);
    setThemes(savedThemes);
    setReviewQueue(initialQueue);
    setThemeNotes(savedNotes);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveToStorage(STORAGE_KEYS.CARDS, cards);
    }
  }, [cards, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      saveToStorage(STORAGE_KEYS.THEMES, themes);
    }
  }, [themes, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      saveToStorage(STORAGE_KEYS.REVIEW_QUEUE, reviewQueue);
    }
  }, [reviewQueue, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      saveToStorage(STORAGE_KEYS.NOTES, themeNotes);
    }
  }, [themeNotes, isLoading]);

  const getCardReviewGroup = useCallback((card: Card): ReviewGroup => {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const tomorrowStart = todayStart + 86400000;
    const day3Start = todayStart + 3 * 86400000;
    const day7Start = todayStart + 7 * 86400000;

    const scheduledAt = card.nextReviewAt || card.createdAt + 86400000;

    if (scheduledAt < todayStart) return 'overdue';
    if (scheduledAt < tomorrowStart) return 'today';
    if (scheduledAt < day3Start) return 'tomorrow';
    if (scheduledAt < day7Start) return 'next3days';
    if (scheduledAt < day7Start + 14 * 86400000) return 'next7days';
    return 'later';
  }, []);

  const getReviewGroupCards = useCallback((group: ReviewGroup): Card[] => {
    return cards
      .filter(card => getCardReviewGroup(card) === group)
      .sort((a, b) => (a.nextReviewAt || 0) - (b.nextReviewAt || 0));
  }, [cards, getCardReviewGroup]);

  const getReviewGroupCount = useCallback((group: ReviewGroup): number => {
    return cards.filter(card => getCardReviewGroup(card) === group).length;
  }, [cards, getCardReviewGroup]);

  const getAllReviewGroups = useCallback(() => {
    const groups: ReviewGroup[] = ['overdue', 'today', 'tomorrow', 'next3days', 'next7days', 'later'];
    return groups.map(group => ({
      group,
      label: GROUP_LABELS[group],
      count: getReviewGroupCount(group),
    }));
  }, [getReviewGroupCount]);

  const calculateNextReview = useCallback((
    feedback: ReviewFeedback,
    currentMastery: number,
    lastReviewAt?: number
  ): number => {
    const now = Date.now();
    const baseTime = lastReviewAt || now;
    const days = REVIEW_INTERVALS[feedback][currentMastery] || 1;
    return baseTime + days * 86400000;
  }, []);

  const getOrderedReviewCards = useCallback((): Card[] => {
    const pendingIds = reviewQueue.filter(r => !r.isReviewed).map(r => r.cardId);
    return cards
      .filter(c => pendingIds.includes(c.id))
      .sort((a, b) => {
        const aScheduled = a.nextReviewAt || a.createdAt;
        const bScheduled = b.nextReviewAt || b.createdAt;
        return aScheduled - bScheduled;
      });
  }, [cards, reviewQueue]);

  const recalculateThemeCardCounts = useCallback((currentCards: Card[], currentThemes: Theme[]): Theme[] => {
    return currentThemes.map(theme => ({
      ...theme,
      cardCount: currentCards.filter(card => card.themes.includes(theme.name)).length,
    }));
  }, []);

  const addCard = useCallback((cardData: Omit<Card, 'id' | 'createdAt' | 'updatedAt' | 'reviewCount' | 'masteryLevel'>) => {
    const now = Date.now();
    const newCard: Card = {
      ...cardData,
      id: `card_${now}_${Math.random().toString(36).substr(2, 9)}`,
      masteryLevel: 1,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    setCards(prev => {
      const newCards = [newCard, ...prev];
      setThemes(prevThemes => recalculateThemeCardCounts(newCards, prevThemes));
      return newCards;
    });
    setReviewQueue(prev => [...prev, {
      cardId: newCard.id,
      scheduledAt: now + 86400000,
      isReviewed: false,
    }]);
    console.log('[CardContext] 新增卡片:', newCard.id);
  }, [recalculateThemeCardCounts]);

  const updateCard = useCallback((id: string, updates: Partial<Card>) => {
    setCards(prev => {
      const newCards = prev.map(card =>
        card.id === id ? { ...card, ...updates, updatedAt: Date.now() } : card
      );
      setThemes(prevThemes => recalculateThemeCardCounts(newCards, prevThemes));
      return newCards;
    });
    console.log('[CardContext] 更新卡片:', id);
  }, [recalculateThemeCardCounts]);

  const deleteCard = useCallback((id: string) => {
    setCards(prev => {
      const newCards = cleanupInvalidRelations(prev.filter(card => card.id !== id));
      setThemes(prevThemes => recalculateThemeCardCounts(newCards, prevThemes));
      return newCards;
    });
    setReviewQueue(prev => prev.filter(item => item.cardId !== id));
    console.log('[CardContext] 删除卡片:', id);
  }, [recalculateThemeCardCounts]);

  const toggleFavorite = useCallback((id: string) => {
    setCards(prev => prev.map(card =>
      card.id === id ? { ...card, isFavorite: !card.isFavorite, updatedAt: Date.now() } : card
    ));
  }, []);

  const markMastery = useCallback((id: string, level: 1 | 2 | 3 | 4 | 5) => {
    setCards(prev => prev.map(card =>
      card.id === id ? { ...card, masteryLevel: level, updatedAt: Date.now() } : card
    ));
  }, []);

  const markReviewed = useCallback((cardId: string, feedback: ReviewFeedback = 'vague') => {
    const now = Date.now();
    let masteryBefore = 1;
    let masteryAfter = 1;
    let nextReviewAt = now + 86400000;

    setCards(prev => prev.map(card => {
      if (card.id === cardId) {
        masteryBefore = card.masteryLevel;

        if (feedback === 'forgot') {
          masteryAfter = Math.max(1, card.masteryLevel - 1) as 1 | 2 | 3 | 4 | 5;
        } else if (feedback === 'remembered') {
          masteryAfter = Math.min(5, card.masteryLevel + 1) as 1 | 2 | 3 | 4 | 5;
        } else {
          masteryAfter = card.masteryLevel;
        }

        nextReviewAt = calculateNextReview(feedback, masteryAfter, now);

        const historyItem: ReviewHistoryItem = {
          id: `hist_${now}_${Math.random().toString(36).substr(2, 9)}`,
          cardId,
          feedback,
          masteryBefore,
          masteryAfter,
          reviewedAt: now,
          nextReviewAt,
        };

        return {
          ...card,
          reviewCount: card.reviewCount + 1,
          lastReviewAt: now,
          nextReviewAt,
          masteryLevel: masteryAfter,
          updatedAt: now,
          reviewHistory: [...(card.reviewHistory || []), historyItem],
        };
      }
      return card;
    }));

    setReviewQueue(prev => prev.map(item =>
      item.cardId === cardId ? { ...item, isReviewed: true, reviewedAt: now, feedback } : item
    ));

    console.log('[CardContext] 标记已复习:', cardId, '反馈:', feedback, '掌握程度:', masteryBefore, '→', masteryAfter);
    return { masteryBefore, masteryAfter, nextReviewAt };
  }, [calculateNextReview]);

  const addTheme = useCallback((themeData: Omit<Theme, 'cardCount'>) => {
    const newTheme: Theme = {
      ...themeData,
      cardCount: 0,
    };
    setThemes(prev => [...prev, newTheme]);
    console.log('[CardContext] 新增主题:', newTheme.name);
  }, []);

  const getRandomCard = useCallback((): Card | null => {
    const availableCards = cards.filter(c => !reviewQueue.find(r => r.cardId === c.id && !r.isReviewed));
    if (availableCards.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    return availableCards[randomIndex];
  }, [cards, reviewQueue]);

  const getRelatedCards = useCallback((cardId: string): Card[] => {
    const card = cards.find(c => c.id === cardId);
    if (!card || !card.relatedCardIds.length) return [];
    return cards.filter(c => card.relatedCardIds.includes(c.id));
  }, [cards]);

  const generateSessionSummary = useCallback((reviewedCardIds: string[]): ReviewSessionSummary => {
    const reviewedCards = cards.filter(c => reviewedCardIds.includes(c.id));
    const masteryChanges: Array<{ card: Card; before: number; after: number }> = [];
    const nextReviewSchedule: Array<{ card: Card; nextReviewAt: number }> = [];

    reviewedCards.forEach(card => {
      const lastHistory = card.reviewHistory?.[card.reviewHistory.length - 1];
      if (lastHistory) {
        if (lastHistory.masteryBefore !== lastHistory.masteryAfter) {
          masteryChanges.push({
            card,
            before: lastHistory.masteryBefore,
            after: lastHistory.masteryAfter,
          });
        }
        nextReviewSchedule.push({
          card,
          nextReviewAt: lastHistory.nextReviewAt,
        });
      }
    });

    const totalChange = masteryChanges.reduce((sum, c) => sum + (c.after - c.before), 0);
    const averageMasteryChange = masteryChanges.length > 0 ? totalChange / masteryChanges.length : 0;

    return {
      reviewedCards,
      masteryChanges,
      nextReviewSchedule,
      totalReviewed: reviewedCards.length,
      averageMasteryChange,
    };
  }, [cards]);

  const createThemeNote = useCallback((themeName: string, cardIds: string[], groupBy: 'source' | 'mastery' = 'mastery'): ThemeNote => {
    const selectedCards = cards.filter(c => cardIds.includes(c.id));
    const now = Date.now();

    let content = '';
    const title = `${themeName} - 主题笔记`;

    if (groupBy === 'source') {
      const sourceGroups: Record<string, Card[]> = {};
      selectedCards.forEach(card => {
        const source = card.source || '未分类';
        if (!sourceGroups[source]) sourceGroups[source] = [];
        sourceGroups[source].push(card);
      });

      Object.entries(sourceGroups).forEach(([source, sourceCards]) => {
        content += `## ${source}\n\n`;
        sourceCards.forEach((card, idx) => {
          content += `${idx + 1}. ${card.content}\n\n`;
        });
      });
    } else {
      const masteryLabels = ['', '初识', '了解', '熟悉', '掌握', '精通'];
      const masteryGroups: Record<number, Card[]> = {};
      selectedCards.forEach(card => {
        const level = card.masteryLevel;
        if (!masteryGroups[level]) masteryGroups[level] = [];
        masteryGroups[level].push(card);
      });

      Object.entries(masteryGroups)
        .sort(([a], [b]) => Number(a) - Number(b))
        .forEach(([level, masteryCards]) => {
          content += `## ${masteryLabels[Number(level)]} (${masteryCards.length}张)\n\n`;
          masteryCards.forEach((card, idx) => {
            content += `${idx + 1}. ${card.content}\n\n`;
          });
        });
    }

    const newNote: ThemeNote = {
      id: `note_${now}_${Math.random().toString(36).substr(2, 9)}`,
      themeName,
      title,
      content,
      cardIds,
      createdAt: now,
      updatedAt: now,
    };

    setThemeNotes(prev => [...prev, newNote]);
    console.log('[CardContext] 创建主题笔记:', newNote.id);
    return newNote;
  }, [cards]);

  const updateThemeNote = useCallback((noteId: string, updates: Partial<ThemeNote>) => {
    setThemeNotes(prev => prev.map(note =>
      note.id === noteId ? { ...note, ...updates, updatedAt: Date.now() } : note
    ));
    console.log('[CardContext] 更新主题笔记:', noteId);
  }, []);

  const deleteThemeNote = useCallback((noteId: string) => {
    setThemeNotes(prev => prev.filter(note => note.id !== noteId));
    console.log('[CardContext] 删除主题笔记:', noteId);
  }, []);

  const getThemeNotes = useCallback((themeName?: string): ThemeNote[] => {
    if (!themeName) return themeNotes;
    return themeNotes.filter(note => note.themeName === themeName);
  }, [themeNotes]);

  const getWeeklyStats = useCallback((): WeeklyStats => {
    const weekDates = getWeekDates();
    const dailyStats: DailyStats[] = weekDates.map(date => ({
      date,
      newCards: cards.filter(c => {
        const cardDate = new Date(c.createdAt).toISOString().slice(5, 10).replace('-', '-');
        return cardDate === date;
      }).length,
      reviewedCards: cards.filter(c => {
        if (!c.lastReviewAt) return false;
        const reviewDate = new Date(c.lastReviewAt).toISOString().slice(5, 10).replace('-', '-');
        return reviewDate === date;
      }).length,
    }));

    const themeCounts: Record<string, number> = {};
    cards.forEach(card => {
      card.themes.forEach(theme => {
        themeCounts[theme] = (themeCounts[theme] || 0) + 1;
      });
    });

    const topThemes = Object.entries(themeCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalNew: dailyStats.reduce((sum, d) => sum + d.newCards, 0),
      totalReviewed: dailyStats.reduce((sum, d) => sum + d.reviewedCards, 0),
      dailyStats,
      topThemes,
    };
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (!searchKeyword.trim()) return cards;
    const keyword = searchKeyword.toLowerCase();
    return cards.filter(card =>
      card.content.toLowerCase().includes(keyword) ||
      card.source?.toLowerCase().includes(keyword) ||
      card.themes.some(t => t.toLowerCase().includes(keyword))
    );
  }, [cards, searchKeyword]);

  const favoriteCards = useMemo(() => cards.filter(c => c.isFavorite), [cards]);

  const pendingReviewCards = useMemo(() => {
    return getOrderedReviewCards();
  }, [getOrderedReviewCards]);

  const value: CardContextType = {
    cards,
    themes,
    reviewQueue,
    themeNotes,
    searchKeyword,
    setSearchKeyword,
    addCard,
    updateCard,
    deleteCard,
    toggleFavorite,
    markMastery,
    markReviewed,
    addTheme,
    getRandomCard,
    getWeeklyStats,
    getRelatedCards,
    filteredCards,
    favoriteCards,
    pendingReviewCards,
    isLoading,
    getReviewGroupCards,
    getReviewGroupCount,
    getAllReviewGroups,
    getCardReviewGroup,
    calculateNextReview,
    createThemeNote,
    updateThemeNote,
    deleteThemeNote,
    getThemeNotes,
    generateSessionSummary,
    getOrderedReviewCards,
  };

  return (
    <CardContext.Provider value={value}>
      {children}
    </CardContext.Provider>
  );
};

export const useCards = () => {
  const context = useContext(CardContext);
  if (!context) {
    throw new Error('useCards must be used within a CardProvider');
  }
  return context;
};
