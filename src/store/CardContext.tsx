import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Card, Theme, ReviewQueueItem, WeeklyStats, DailyStats, ReviewFeedback, ReviewGroup, ReviewSessionSummary, ThemeNote, ReviewHistoryItem, ReviewAdjustType, CalendarDayData, CalendarWeekData, CalendarMonthData } from '@/types/card';
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
  addCard: (card: Omit<Card, 'id' | 'createdAt' | 'updatedAt' | 'reviewCount' | 'masteryLevel' | 'reviewHistory' | 'relatedNoteIds'>) => void;
  updateCard: (id: string, updates: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  toggleFavorite: (id: string) => void;
  markMastery: (id: string, level: 1 | 2 | 3 | 4 | 5) => void;
  markReviewed: (cardId: string, feedback?: ReviewFeedback) => { masteryBefore: number; masteryAfter: number; nextReviewAt: number };
  adjustNextReview: (cardId: string, adjustType: ReviewAdjustType, customDate?: number, reason?: string) => void;
  addTheme: (theme: Omit<Theme, 'cardCount'>) => void;
  getRandomCard: () => Card | null;
  getWeeklyStats: () => WeeklyStats;
  getRelatedCards: (cardId: string) => Card[];
  getCardNotes: (cardId: string) => ThemeNote[];
  filteredCards: Card[];
  favoriteCards: Card[];
  pendingReviewCards: Card[];
  isLoading: boolean;
  getReviewGroupCards: (group: ReviewGroup) => Card[];
  getReviewGroupCount: (group: ReviewGroup) => number;
  getAllReviewGroups: () => { group: ReviewGroup; label: string; count: number }[];
  getCardReviewGroup: (card: Card) => ReviewGroup;
  calculateNextReview: (feedback: ReviewFeedback, currentMastery: number, lastReviewAt?: number) => number;
  createThemeNote: (themeName: string, cardIds: string[], groupBy?: 'source' | 'mastery', linkToCards?: boolean) => ThemeNote;
  updateThemeNote: (noteId: string, updates: Partial<ThemeNote>) => void;
  deleteThemeNote: (noteId: string) => void;
  getThemeNotes: (themeName?: string) => ThemeNote[];
  generateSessionSummary: (reviewedCardIds: string[]) => ReviewSessionSummary;
  getOrderedReviewCards: (startCardId?: string) => Card[];
  getCalendarDayData: (date: string) => CalendarDayData;
  getCalendarWeekData: (baseDate?: number) => CalendarWeekData;
  getCalendarMonthData: (year?: number, month?: number) => CalendarMonthData;
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

function cleanupInvalidRelations(cards: Card[], notes: ThemeNote[]): Card[] {
  const validCardIds = new Set(cards.map(c => c.id));
  const validNoteIds = new Set(notes.map(n => n.id));
  return cards.map(card => ({
    ...card,
    relatedCardIds: card.relatedCardIds.filter(id => validCardIds.has(id)),
    relatedNoteIds: (card.relatedNoteIds || []).filter(id => validNoteIds.has(id)),
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
          relatedNoteIds: card.relatedNoteIds || [],
          nextReviewAt: card.lastReviewAt
            ? card.lastReviewAt + 86400000
            : card.createdAt + 86400000,
        };
      }
      return {
        ...card,
        relatedNoteIds: card.relatedNoteIds || [],
      };
    });

    const cleanedCards = cleanupInvalidRelations(cardsWithNextReview, savedNotes);
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
    const day2Start = todayStart + 2 * 86400000;
    const day5Start = todayStart + 5 * 86400000;
    const day8Start = todayStart + 8 * 86400000;

    const scheduledAt = card.nextReviewAt || card.createdAt + 86400000;

    if (scheduledAt < todayStart) return 'overdue';
    if (scheduledAt < tomorrowStart) return 'today';
    if (scheduledAt < day2Start) return 'tomorrow';
    if (scheduledAt < day5Start) return 'next3days';
    if (scheduledAt < day8Start) return 'next7days';
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

  const getOrderedReviewCards = useCallback((startCardId?: string): Card[] => {
    const pendingIds = reviewQueue.filter(r => !r.isReviewed).map(r => r.cardId);
    let orderedCards = cards
      .filter(c => pendingIds.includes(c.id))
      .sort((a, b) => {
        const aScheduled = a.nextReviewAt || a.createdAt;
        const bScheduled = b.nextReviewAt || b.createdAt;
        return aScheduled - bScheduled;
      });

    if (startCardId) {
      const startIndex = orderedCards.findIndex(c => c.id === startCardId);
      if (startIndex > 0) {
        const beforeStart = orderedCards.slice(0, startIndex);
        const fromStart = orderedCards.slice(startIndex);
        orderedCards = [...fromStart, ...beforeStart];
      }
    }

    return orderedCards;
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

  const adjustNextReview = useCallback((cardId: string, adjustType: ReviewAdjustType, customDate?: number, reason?: string) => {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);

    let newNextReviewAt = now + 86400000;

    switch (adjustType) {
      case 'tomorrow':
        newNextReviewAt = todayStart + 2 * 86400000 - 1;
        break;
      case '3days':
        newNextReviewAt = todayStart + 3 * 86400000;
        break;
      case 'nextWeek':
        newNextReviewAt = todayStart + 7 * 86400000;
        break;
      case 'skip':
        newNextReviewAt = todayStart + 86400000;
        break;
      case 'custom':
        if (customDate) {
          newNextReviewAt = customDate;
        }
        break;
    }

    setCards(prev => prev.map(card => {
      if (card.id === cardId) {
        const historyItem: ReviewHistoryItem = {
          id: `hist_${now}_${Math.random().toString(36).substr(2, 9)}`,
          cardId,
          feedback: 'vague',
          masteryBefore: card.masteryLevel,
          masteryAfter: card.masteryLevel,
          reviewedAt: now,
          nextReviewAt: newNextReviewAt,
          adjusted: true,
          adjustReason: reason || adjustType,
        };

        return {
          ...card,
          nextReviewAt: newNextReviewAt,
          updatedAt: now,
          reviewHistory: [...(card.reviewHistory || []), historyItem],
        };
      }
      return card;
    }));

    setReviewQueue(prev => prev.map(item =>
      item.cardId === cardId ? { ...item, scheduledAt: newNextReviewAt } : item
    ));

    console.log('[CardContext] 调整复习时间:', cardId, '类型:', adjustType, '新时间:', new Date(newNextReviewAt).toLocaleString());
  }, []);

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

  const getCardNotes = useCallback((cardId: string): ThemeNote[] => {
    const card = cards.find(c => c.id === cardId);
    if (!card || !card.relatedNoteIds || card.relatedNoteIds.length === 0) return [];
    return themeNotes.filter(n => card.relatedNoteIds!.includes(n.id));
  }, [cards, themeNotes]);

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

  const createThemeNote = useCallback((themeName: string, cardIds: string[], groupBy: 'source' | 'mastery' = 'mastery', linkToCards: boolean = false): ThemeNote => {
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
      linkToCards,
      createdAt: now,
      updatedAt: now,
    };

    setThemeNotes(prev => [...prev, newNote]);

    if (linkToCards) {
      setCards(prev => prev.map(card => {
        if (cardIds.includes(card.id)) {
          return {
            ...card,
            relatedNoteIds: [...(card.relatedNoteIds || []), newNote.id],
            updatedAt: now,
          };
        }
        return card;
      }));
    }

    console.log('[CardContext] 创建主题笔记:', newNote.id, '关联卡片:', linkToCards);
    return newNote;
  }, [cards]);

  const updateThemeNote = useCallback((noteId: string, updates: Partial<ThemeNote>) => {
    const now = Date.now();
    const existingNote = themeNotes.find(n => n.id === noteId);

    setThemeNotes(prev => prev.map(note =>
      note.id === noteId ? { ...note, ...updates, updatedAt: now } : note
    ));

    if (existingNote && updates.linkToCards !== undefined && updates.linkToCards !== existingNote.linkToCards) {
      setCards(prev => prev.map(card => {
        if (existingNote.cardIds.includes(card.id)) {
          const currentNoteIds = card.relatedNoteIds || [];
          if (updates.linkToCards) {
            return {
              ...card,
              relatedNoteIds: [...currentNoteIds, noteId],
              updatedAt: now,
            };
          } else {
            return {
              ...card,
              relatedNoteIds: currentNoteIds.filter(id => id !== noteId),
              updatedAt: now,
            };
          }
        }
        return card;
      }));
    }

    console.log('[CardContext] 更新主题笔记:', noteId);
  }, [themeNotes]);

  const deleteThemeNote = useCallback((noteId: string) => {
    const now = Date.now();
    const existingNote = themeNotes.find(n => n.id === noteId);

    setThemeNotes(prev => prev.filter(note => note.id !== noteId));

    if (existingNote && existingNote.linkToCards) {
      setCards(prev => prev.map(card => {
        if (existingNote.cardIds.includes(card.id)) {
          return {
            ...card,
            relatedNoteIds: (card.relatedNoteIds || []).filter(id => id !== noteId),
            updatedAt: now,
          };
        }
        return card;
      }));
    }

    console.log('[CardContext] 删除主题笔记:', noteId);
  }, [themeNotes]);

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

  const formatDateKey = (timestamp: number): string => {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getStartOfDay = (timestamp: number): number => {
    return new Date(timestamp).setHours(0, 0, 0, 0);
  };

  const getEndOfDay = (timestamp: number): number => {
    return new Date(timestamp).setHours(23, 59, 59, 999);
  };

  const getCalendarDayData = useCallback((date: string): CalendarDayData => {
    const todayStart = getStartOfDay(Date.now());
    const dateParts = date.split('-');
    const targetDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const dayStart = targetDate.setHours(0, 0, 0, 0);
    const dayEnd = targetDate.setHours(23, 59, 59, 999);

    const dayCards = cards.filter(card => {
      const scheduled = card.nextReviewAt || card.createdAt + 86400000;
      return scheduled >= dayStart && scheduled <= dayEnd;
    });

    const completedCardIds = dayCards
      .filter(card => {
        const lastHistory = card.reviewHistory?.[card.reviewHistory.length - 1];
        return lastHistory && lastHistory.reviewedAt >= dayStart && lastHistory.reviewedAt <= dayEnd && !lastHistory.adjusted;
      })
      .map(card => card.id);

    const overdueCount = dayCards.filter(card => {
      const scheduled = card.nextReviewAt || card.createdAt + 86400000;
      return scheduled < todayStart && !completedCardIds.includes(card.id);
    }).length;

    return {
      date,
      timestamp: dayStart,
      totalScheduled: dayCards.length,
      completed: completedCardIds.length,
      overdue: overdueCount,
      cardIds: dayCards.map(card => card.id),
      completedCardIds,
    };
  }, [cards]);

  const getCalendarWeekData = useCallback((baseDate?: number): CalendarWeekData => {
    const now = baseDate || Date.now();
    const currentDate = new Date(now);
    const dayOfWeek = currentDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const days: CalendarDayData[] = [];
    let totalScheduled = 0;
    let totalCompleted = 0;

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dateKey = formatDateKey(dayDate.getTime());
      const dayData = getCalendarDayData(dateKey);
      days.push(dayData);
      totalScheduled += dayData.totalScheduled;
      totalCompleted += dayData.completed;
    }

    return {
      weekStart: formatDateKey(weekStart.getTime()),
      weekEnd: formatDateKey(weekEnd.getTime()),
      days,
      totalScheduled,
      totalCompleted,
    };
  }, [cards, getCalendarDayData]);

  const getCalendarMonthData = useCallback((year?: number, month?: number): CalendarMonthData => {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month !== undefined ? month : now.getMonth();

    const firstDay = new Date(targetYear, targetMonth, 1);
    const lastDay = new Date(targetYear, targetMonth + 1, 0);

    const firstDayOfWeek = firstDay.getDay();
    const mondayOffset = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
    const calendarStart = new Date(firstDay);
    calendarStart.setDate(firstDay.getDate() + mondayOffset);

    const weeks: CalendarWeekData[] = [];
    let totalScheduled = 0;
    let totalCompleted = 0;

    for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
      const weekBase = new Date(calendarStart);
      weekBase.setDate(calendarStart.getDate() + weekIndex * 7);
      const weekData = getCalendarWeekData(weekBase.getTime());
      weeks.push(weekData);
      totalScheduled += weekData.totalScheduled;
      totalCompleted += weekData.totalCompleted;

      if (weekBase.getTime() > lastDay.getTime()) {
        break;
      }
    }

    return {
      year: targetYear,
      month: targetMonth,
      weeks,
      totalScheduled,
      totalCompleted,
    };
  }, [cards, getCalendarWeekData]);

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
    adjustNextReview,
    addTheme,
    getRandomCard,
    getWeeklyStats,
    getRelatedCards,
    getCardNotes,
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
    getCalendarDayData,
    getCalendarWeekData,
    getCalendarMonthData,
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
