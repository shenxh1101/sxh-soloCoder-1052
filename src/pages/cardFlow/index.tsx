import React, { useState, useCallback } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import styles from './index.module.scss';
import classnames from 'classnames';
import { useCards } from '@/store/CardContext';
import CardItem from '@/components/CardItem';
import EmptyState from '@/components/EmptyState';

const CardFlowPage: React.FC = () => {
  const {
    cards,
    filteredCards,
    favoriteCards,
    pendingReviewCards,
    searchKeyword,
    setSearchKeyword,
    getRandomCard,
    markReviewed,
  } = useCards();

  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [showRandomCard, setShowRandomCard] = useState(false);
  const [randomCard, setRandomCard] = useState<ReturnType<typeof getRandomCard>>(null);

  const filters = [
    { key: 'all', label: '全部' },
    { key: 'favorite', label: '⭐ 收藏' },
    { key: 'pending', label: '📚 待复习' },
    { key: 'recent', label: '🕐 最近' },
  ];

  const getDisplayCards = () => {
    switch (activeFilter) {
      case 'favorite':
        return favoriteCards;
      case 'pending':
        return pendingReviewCards;
      case 'recent':
        return [...cards].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
      default:
        return filteredCards;
    }
  };

  const displayCards = getDisplayCards();

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
      Taro.showToast({ title: '刷新成功', icon: 'success' });
    }, 1000);
  });

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'create':
        Taro.switchTab({ url: '/pages/createCard/index' });
        break;
      case 'random':
        const card = getRandomCard();
        if (card) {
          setRandomCard(card);
          setShowRandomCard(true);
        } else {
          Taro.showToast({ title: '暂无可用卡片', icon: 'none' });
        }
        break;
      case 'review':
        Taro.switchTab({ url: '/pages/review/index' });
        break;
    }
  };

  const handleCardClick = useCallback((cardId: string) => {
    setExpandedCardId(expandedCardId === cardId ? null : cardId);
  }, [expandedCardId]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchKeyword(e.detail.value);
  };

  const clearSearch = () => {
    setSearchKeyword('');
  };

  const handleNextRandom = () => {
    const card = getRandomCard();
    if (card) {
      setRandomCard(card);
    }
  };

  const handleMarkReviewed = () => {
    if (randomCard) {
      markReviewed(randomCard.id);
      setShowRandomCard(false);
      Taro.showToast({ title: '已标记复习', icon: 'success' });
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了，注意休息 🌙';
    if (hour < 12) return '早上好，开始学习吧 ☀️';
    if (hour < 18) return '下午好，继续积累 ✨';
    return '晚上好，温故而知新 🌟';
  };

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <View className={styles.greeting}>
          <View>
            <Text className={styles.greetingText}>{getGreeting()}</Text>
            <Text className={styles.greetingSub}>已积累 {cards.length} 张知识卡片</Text>
          </View>
        </View>

        <View className={styles.statsRow}>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{cards.length}</Text>
            <Text className={styles.statLabel}>总卡片</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{pendingReviewCards.length}</Text>
            <Text className={styles.statLabel}>待复习</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statNumber}>{favoriteCards.length}</Text>
            <Text className={styles.statLabel}>已收藏</Text>
          </View>
        </View>

        <View className={styles.quickActions}>
          <View className={styles.quickBtn} onClick={() => handleQuickAction('create')}>
            <Text className={styles.quickIcon}>✏️</Text>
            <Text className={styles.quickText}>新建卡片</Text>
          </View>
          <View className={styles.quickBtn} onClick={() => handleQuickAction('random')}>
            <Text className={styles.quickIcon}>🎲</Text>
            <Text className={styles.quickText}>随机抽卡</Text>
          </View>
          <View className={styles.quickBtn} onClick={() => handleQuickAction('review')}>
            <Text className={styles.quickIcon}>📚</Text>
            <Text className={styles.quickText}>今日复习</Text>
          </View>
        </View>
      </View>

      <View className={styles.searchSection}>
        <View className={styles.searchBox}>
          <Text className={styles.searchIcon}>🔍</Text>
          <Input
            className={styles.searchInput}
            placeholder="搜索卡片内容、来源、标签..."
            value={searchKeyword}
            onInput={handleSearch}
            confirmType="search"
          />
          {searchKeyword && (
            <View className={styles.clearBtn} onClick={clearSearch}>
              <Text>✕</Text>
            </View>
          )}
        </View>
      </View>

      <View className={styles.content}>
        <ScrollView className={styles.filterTabs} scrollX>
          {filters.map((filter) => (
            <View
              key={filter.key}
              className={classnames(styles.filterTab, activeFilter === filter.key && styles.active)}
              onClick={() => setActiveFilter(filter.key)}
            >
              <Text>{filter.label}</Text>
            </View>
          ))}
        </ScrollView>

        <ScrollView className={styles.cardList}>
          {displayCards.length === 0 ? (
            <EmptyState
              icon="📝"
              title="还没有卡片"
              description="点击右下角按钮创建你的第一张知识卡片吧"
            />
          ) : (
            displayCards.map((card) => (
              <View
                key={card.id}
                className={classnames(expandedCardId === card.id && styles.expandedCard)}
                onClick={() => handleCardClick(card.id)}
              >
                <CardItem
                  card={card}
                  showActions={expandedCardId === card.id}
                  onReview={() => {
                    markReviewed(card.id);
                    Taro.showToast({ title: '已标记复习', icon: 'success' });
                  }}
                />
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <View
        className={styles.floatingBtn}
        onClick={() => Taro.switchTab({ url: '/pages/createCard/index' })}
      >
        <Text className={styles.floatingIcon}>+</Text>
      </View>

      {showRandomCard && randomCard && (
        <View className={styles.randomModal} onClick={() => setShowRandomCard(false)}>
          <View className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>🎲 随机抽卡</Text>
              <View className={styles.closeBtn} onClick={() => setShowRandomCard(false)}>
                <Text>✕</Text>
              </View>
            </View>
            <CardItem card={randomCard} showActions />
            <View className={styles.modalActions}>
              <View className={classnames(styles.actionBtn, styles.secondary)} onClick={handleNextRandom}>
                <Text>换一张</Text>
              </View>
              <View className={classnames(styles.actionBtn, styles.primary)} onClick={handleMarkReviewed}>
                <Text>标记复习</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default CardFlowPage;
