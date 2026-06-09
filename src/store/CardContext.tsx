import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { Card, Theme, ReviewQueueItem, WeeklyStats, DailyStats } from '@/types/card';
import { mockCards, mockThemes } from '@/data/mockCards';
import { getWeekDates } from '@/utils/date';

const STORAGE_KEYS = {
  CARDS: 'knowledge_cards_data',
  THEMES: 'knowledge_themes_data',
  REVIEW_QUEUE: 'knowledge_review_queue',
};

interface CardContextType {
  cards: Card[];
  themes: Theme[];
  reviewQueue: ReviewQueueItem[];
  searchKeyword: string;
  setSearchKeyword: (keyword: string) => void;
  addCard: (card: Omit<Card, 'id' | 'createdAt' | 'updatedAt' | 'reviewCount' | 'masteryLevel'>) => void;
  updateCard: (id: string, updates: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  toggleFavorite: (id: string) => void;
  markMastery: (id: string, level: 1 | 2 | 3 | 4 | 5) => void;
  markReviewed: (cardId: string) => void;
  addTheme: (theme: Omit<Theme, 'cardCount'>) => void;
  getRandomCard: () => Card | null;
  getWeeklyStats: () => WeeklyStats;
  getRelatedCards: (cardId: string) => Card[];
  filteredCards: Card[];
  favoriteCards: Card[];
  pendingReviewCards: Card[];
  isLoading: boolean;
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

export const CardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);

  useEffect(() => {
    const savedCards = loadFromStorage<Card[]>(STORAGE_KEYS.CARDS, mockCards);
    const savedThemes = loadFromStorage<Theme[]>(STORAGE_KEYS.THEMES, mockThemes);
    const savedQueue = loadFromStorage<ReviewQueueItem[] | null>(STORAGE_KEYS.REVIEW_QUEUE, null);

    const cleanedCards = cleanupInvalidRelations(savedCards);
    const initialQueue = savedQueue || getInitialReviewQueue(cleanedCards);

    setCards(cleanedCards);
    setThemes(savedThemes);
    setReviewQueue(initialQueue);
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

  const markReviewed = useCallback((cardId: string) => {
    const now = Date.now();
    setCards(prev => prev.map(card =>
      card.id === cardId
        ? { ...card, reviewCount: card.reviewCount + 1, lastReviewAt: now, updatedAt: now }
        : card
    ));
    setReviewQueue(prev => prev.map(item =>
      item.cardId === cardId ? { ...item, isReviewed: true } : item
    ));
    console.log('[CardContext] 标记已复习:', cardId);
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
    const pendingIds = reviewQueue.filter(r => !r.isReviewed).map(r => r.cardId);
    return cards.filter(c => pendingIds.includes(c.id));
  }, [cards, reviewQueue]);

  const value: CardContextType = {
    cards,
    themes,
    reviewQueue,
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
