import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import styles from './index.module.scss';
import classnames from 'classnames';
import { useCards } from '@/store/CardContext';
import CardItem from '@/components/CardItem';
import ThemeTag from '@/components/ThemeTag';
import EmptyState from '@/components/EmptyState';

const masteryEmojis = ['😕', '🤔', '🙂', '😊', '🤩'];
const masteryLabels = ['初识', '了解', '熟悉', '掌握', '精通'];

const ReviewPage: React.FC = () => {
  const {
    cards,
    pendingReviewCards,
    reviewQueue,
    markReviewed,
    markMastery,
    getRandomCard,
  } = useCards();

  const [mode, setMode] = useState<'list' | 'card'>('list');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [selectedMastery, setSelectedMastery] = useState<number | null>(null);
  const [randomCard, setRandomCard] = useState<ReturnType<typeof getRandomCard>>(null);
  const [showRandomCard, setShowRandomCard] = useState(false);
  const [reviewSessionCards, setReviewSessionCards] = useState<string[]>([]);
  const [reviewedInSession, setReviewedInSession] = useState<Set<string>>(new Set());

  const reviewedCount = useMemo(() => {
    return reviewQueue.filter(r => r.isReviewed).length;
  }, [reviewQueue]);

  const sessionReviewedCount = reviewedInSession.size;
  const sessionTotalCount = reviewSessionCards.length;
  const sessionProgressPercent = sessionTotalCount > 0 ? Math.round((sessionReviewedCount / sessionTotalCount) * 100) : 0;

  const totalCount = reviewQueue.length;
  const progressPercent = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;

  const currentCardId = reviewSessionCards[currentIndex];
  const currentCard = cards.find(c => c.id === currentCardId) || pendingReviewCards[currentIndex];

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
      Taro.showToast({ title: '刷新成功', icon: 'success' });
    }, 1000);
  });

  const startReview = () => {
    if (pendingReviewCards.length === 0) {
      Taro.showToast({ title: '暂无待复习卡片', icon: 'none' });
      return;
    }
    const sessionOrder = pendingReviewCards.map(card => card.id);
    setReviewSessionCards(sessionOrder);
    setReviewedInSession(new Set());
    setMode('card');
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedMastery(null);
    console.log('[Review] 开始复习，共', sessionOrder.length, '张卡片');
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleMastery = (level: number) => {
    setSelectedMastery(level);
  };

  const handleNext = () => {
    if (!currentCard || !currentCardId) return;

    if (selectedMastery) {
      markMastery(currentCardId, selectedMastery as 1 | 2 | 3 | 4 | 5);
    }
    markReviewed(currentCardId);

    setReviewedInSession(prev => new Set([...prev, currentCardId]));

    if (currentIndex < reviewSessionCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
      setSelectedMastery(null);
    } else {
      setShowComplete(true);
      console.log('[Review] 复习完成，共复习', reviewSessionCards.length, '张卡片');
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
      setSelectedMastery(null);
    }
  };

  const handleCompleteClose = () => {
    setShowComplete(false);
    setMode('list');
    setCurrentIndex(0);
  };

  const handleRandomCard = () => {
    const card = getRandomCard();
    if (card) {
      setRandomCard(card);
      setShowRandomCard(true);
    } else {
      Taro.showToast({ title: '暂无可用卡片', icon: 'none' });
    }
  };

  const handleRandomReviewed = () => {
    if (randomCard) {
      markReviewed(randomCard.id);
      setShowRandomCard(false);
      Taro.showToast({ title: '已标记复习', icon: 'success' });
    }
  };

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <View className={styles.progressHeader}>
          <Text className={styles.title}>📚 今日复习</Text>
          <Text className={styles.subtitle}>温故而知新，可以为师矣</Text>
        </View>

        <View className={styles.statsRow}>
          <View className={classnames(styles.statCard, styles.highlight)}>
            <Text className={styles.statNumber}>{pendingReviewCards.length}</Text>
            <Text className={styles.statLabel}>待复习</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statNumber}>{reviewedCount}</Text>
            <Text className={styles.statLabel}>已复习</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statNumber}>{totalCount}</Text>
            <Text className={styles.statLabel}>总任务</Text>
          </View>
        </View>

        <View className={styles.progressBar}>
          <View className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </View>
        <View className={styles.progressText}>
          <Text className={styles.text}>复习进度</Text>
          <Text className={styles.text}>{progressPercent}%</Text>
        </View>
      </View>

      <View className={styles.modeToggle}>
        <View
          className={classnames(styles.modeBtn, mode === 'list' && styles.active)}
          onClick={() => setMode('list')}
        >
          <Text>📋 列表模式</Text>
        </View>
        <View
          className={classnames(styles.modeBtn, mode === 'card' && styles.active)}
          onClick={startReview}
        >
          <Text>🎴 卡片模式</Text>
        </View>
      </View>

      <View className={styles.content}>
        {mode === 'list' && (
          <View className={styles.listMode}>
            <View className={styles.listHeader}>
              <Text className={styles.listTitle}>待复习卡片 ({pendingReviewCards.length})</Text>
              {pendingReviewCards.length > 0 && (
                <View className={styles.startBtn} onClick={startReview}>
                  <Text>开始复习</Text>
                </View>
              )}
            </View>

            <ScrollView>
              {pendingReviewCards.length === 0 ? (
                <EmptyState
                  icon="🎉"
                  title="太棒了！"
                  description="今日复习任务已全部完成，明天继续加油"
                />
              ) : (
                pendingReviewCards.map((card, index) => (
                  <CardItem
                    key={card.id}
                    card={card}
                    showActions
                    onReview={() => {
                      setCurrentIndex(index);
                      setMode('card');
                    }}
                  />
                ))
              )}
            </ScrollView>
          </View>
        )}

        {mode === 'card' && currentCard && (
          <View className={styles.cardMode}>
            <View className={styles.sessionProgress}>
              <Text className={styles.sessionProgressText}>
                本次复习进度: {sessionReviewedCount}/{sessionTotalCount} ({sessionProgressPercent}%)
              </Text>
            </View>
            <View className={styles.cardContainer} onClick={handleFlip}>
              <View className={classnames(styles.flipCard, isFlipped && styles.flipped)}>
                <View className={classnames(styles.cardFace, styles.cardFront)}>
                  <Text className={styles.hintIcon}>🤔</Text>
                  <Text className={styles.hintText}>点击卡片查看内容</Text>
                  <Text className={styles.tapHint}>第 {currentIndex + 1} / {sessionTotalCount} 张</Text>
                  <View className={styles.cardTags}>
                    {currentCard.themes.map((theme, idx) => (
                      <ThemeTag key={idx} name={theme} />
                    ))}
                  </View>
                </View>

                <View className={classnames(styles.cardFace, styles.cardBack)}>
                  <Text className={styles.cardContent}>{currentCard.content}</Text>
                  {currentCard.source && (
                    <Text className={styles.cardSource}>📚 {currentCard.source}</Text>
                  )}
                  <View className={styles.cardTags}>
                    {currentCard.themes.map((theme, idx) => (
                      <ThemeTag key={idx} name={theme} />
                    ))}
                  </View>
                  <View className={styles.cardMeta}>
                    <Text className={styles.reviewCount}>已复习 {currentCard.reviewCount} 次</Text>
                    <Text className={styles.reviewCount}>点击卡片返回</Text>
                  </View>
                </View>
              </View>
            </View>

            {isFlipped && (
              <View className={styles.masterySection}>
                <Text className={styles.masteryTitle}>你对这张卡片的掌握程度？</Text>
                <View className={styles.masteryButtons}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <View
                      key={level}
                      className={classnames(
                        styles.masteryBtn,
                        styles[`mastery${level}`],
                        selectedMastery === level && styles.selected
                      )}
                      onClick={() => handleMastery(level)}
                    >
                      <Text className={styles.masteryEmoji}>{masteryEmojis[level - 1]}</Text>
                      <Text className={styles.masteryLabel}>{masteryLabels[level - 1]}</Text>
                    </View>
                  ))}
                </View>

                <View className={styles.actionRow}>
                  <View
                    className={classnames(styles.navBtn, styles.secondary)}
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                  >
                    <Text>← 上一张</Text>
                  </View>
                  <View
                    className={classnames(styles.navBtn, styles.primary)}
                    onClick={handleNext}
                  >
                    <Text>
                      {currentIndex === sessionTotalCount - 1 ? '完成 ✓' : '下一张 →'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {mode === 'card' && !currentCard && (
          <EmptyState
            icon="🎉"
            title="复习完成"
            description="今日复习任务已全部完成"
          />
        )}

        <View className={styles.randomSection}>
          <Text className={styles.sectionTitle}>🎲 随机回顾</Text>
          <View className={styles.randomCard}>
            <Text className={styles.randomHint}>从已掌握的卡片中随机抽取一张进行回顾</Text>
            <View className={styles.randomBtn} onClick={handleRandomCard}>
              <Text>🎲 随机抽卡</Text>
            </View>
          </View>
        </View>
      </View>

      {showComplete && (
        <View className={styles.completeModal}>
          <View className={styles.modalContent}>
            <Text className={styles.celebrateIcon}>🎉</Text>
            <Text className={styles.modalTitle}>太棒了！</Text>
            <Text className={styles.modalSubtitle}>你已完成今日的复习任务</Text>
            <View className={styles.modalStats}>
              <View className={styles.modalStat}>
                <Text className={styles.statNum}>{sessionTotalCount}</Text>
                <Text className={styles.statLabel}>本次复习</Text>
              </View>
              <View className={styles.modalStat}>
                <Text className={styles.statNum}>{sessionReviewedCount}</Text>
                <Text className={styles.statLabel}>已完成</Text>
              </View>
              <View className={styles.modalStat}>
                <Text className={styles.statNum}>{Math.round(cards.reduce((sum, c) => sum + c.reviewCount, 0) / Math.max(cards.length, 1))}</Text>
                <Text className={styles.statLabel}>平均复习</Text>
              </View>
            </View>
            <View className={styles.modalBtn} onClick={handleCompleteClose}>
              <Text>继续学习</Text>
            </View>
          </View>
        </View>
      )}

      {showRandomCard && randomCard && (
        <View className={styles.completeModal} onClick={() => setShowRandomCard(false)}>
          <View className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.celebrateIcon}>🎲</Text>
            <Text className={styles.modalTitle}>随机抽卡</Text>
            <CardItem card={randomCard} showActions />
            <View className={styles.actionRow}>
              <View
                className={classnames(styles.navBtn, styles.secondary)}
                onClick={handleRandomCard}
              >
                <Text>换一张</Text>
              </View>
              <View
                className={classnames(styles.navBtn, styles.primary)}
                onClick={handleRandomReviewed}
              >
                <Text>标记复习</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default ReviewPage;
