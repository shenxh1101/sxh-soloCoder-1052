import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Card, Theme, ReviewQueueItem, WeeklyStats, DailyStats } from '@/types/card';
import { mockCards, mockThemes } from '@/data/mockCards';
import { getWeekDates } from '@/utils/date';

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
  getRandomCard: () => Card | null;
  getWeeklyStats: () => WeeklyStats;
  filteredCards: Card[];
  favoriteCards: Card[];
  pendingReviewCards: Card[];
}

const CardContext = createContext<CardContextType | undefined>(undefined);

export const CardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cards, setCards] = useState<Card[]>(mockCards);
  const [themes] = useState<Theme[]>(mockThemes);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>(() => {
    const now = Date.now();
    return mockCards.slice(0, 8).map((card, index) => ({
      cardId: card.id,
      scheduledAt: now + index * 3600000,
      isReviewed: index < 3,
    }));
  });

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
    setCards(prev => [newCard, ...prev]);
    setReviewQueue(prev => [...prev, {
      cardId: newCard.id,
      scheduledAt: now + 86400000,
      isReviewed: false,
    }]);
    console.log('[CardContext] 新增卡片:', newCard.id);
  }, []);

  const updateCard = useCallback((id: string, updates: Partial<Card>) => {
    setCards(prev => prev.map(card =>
      card.id === id ? { ...card, ...updates, updatedAt: Date.now() } : card
    ));
    console.log('[CardContext] 更新卡片:', id);
  }, []);

  const deleteCard = useCallback((id: string) => {
    setCards(prev => prev.filter(card => card.id !== id));
    setReviewQueue(prev => prev.filter(item => item.cardId !== id));
    console.log('[CardContext] 删除卡片:', id);
  }, []);

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

  const getRandomCard = useCallback((): Card | null => {
    const availableCards = cards.filter(c => !reviewQueue.find(r => r.cardId === c.id && !r.isReviewed));
    if (availableCards.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    return availableCards[randomIndex];
  }, [cards, reviewQueue]);

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
    getRandomCard,
    getWeeklyStats,
    filteredCards,
    favoriteCards,
    pendingReviewCards,
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
