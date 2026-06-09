import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import styles from './index.module.scss';
import classnames from 'classnames';
import { useCards } from '@/store/CardContext';
import CardItem from '@/components/CardItem';
import ThemeTag from '@/components/ThemeTag';
import EmptyState from '@/components/EmptyState';
import { ReviewFeedback, ReviewGroup, ReviewSessionSummary } from '@/types/card';

const masteryEmojis = ['😕', '🤔', '🙂', '😊', '🤩'];
const masteryLabels = ['初识', '了解', '熟悉', '掌握', '精通'];

const feedbackOptions: Array<{
  key: ReviewFeedback;
  label: string;
  emoji: string;
  description: string;
  className: string;
}> = [
  { key: 'forgot', label: '忘记了', emoji: '😵', description: '完全想不起来', className: 'forgot' },
  { key: 'vague', label: '有点印象', emoji: '🤔', description: '模糊记得细节', className: 'vague' },
  { key: 'remembered', label: '掌握得不错', emoji: '😊', description: '内容清晰准确', className: 'remembered' },
];

function formatReviewTime(timestamp?: number): string {
  if (!timestamp) return '未安排';
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const reviewDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((reviewDay.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return `逾期${Math.abs(diffDays)}天`;
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '明天';
  if (diffDays <= 7) return `${diffDays}天后`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatNextReviewTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);
  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '明天';
  if (diffDays <= 7) return `${diffDays}天后`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

const ReviewPage: React.FC = () => {
  const {
    cards,
    pendingReviewCards,
    reviewQueue,
    markReviewed,
    markMastery,
    getRandomCard,
    getAllReviewGroups,
    getReviewGroupCards,
    getCardReviewGroup,
    generateSessionSummary,
    getOrderedReviewCards,
  } = useCards();

  const [mode, setMode] = useState<'list' | 'card'>('list');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [selectedMastery, setSelectedMastery] = useState<number | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<ReviewFeedback | null>(null);
  const [randomCard, setRandomCard] = useState<ReturnType<typeof getRandomCard>>(null);
  const [showRandomCard, setShowRandomCard] = useState(false);
  const [reviewSessionCards, setReviewSessionCards] = useState<string[]>([]);
  const [reviewedInSession, setReviewedInSession] = useState<Set<string>>(new Set());
  const [activeGroup, setActiveGroup] = useState<ReviewGroup | 'all'>('all');
  const [sessionSummary, setSessionSummary] = useState<ReviewSessionSummary | null>(null);
  const [singleCardMode, setSingleCardMode] = useState(false);
  const [masteryChangesInSession, setMasteryChangesInSession] = useState<Array<{
    cardId: string;
    before: number;
    after: number;
  }>>([]);

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

  const reviewGroups = getAllReviewGroups();

  const displayCards = useMemo(() => {
    if (activeGroup === 'all') {
      return getOrderedReviewCards();
    }
    return getReviewGroupCards(activeGroup);
  }, [activeGroup, getOrderedReviewCards, getReviewGroupCards]);

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
      Taro.showToast({ title: '刷新成功', icon: 'success' });
    }, 1000);
  });

  const startReview = (group?: ReviewGroup) => {
    let cardsToReview: string[] = [];
    if (group) {
      cardsToReview = getReviewGroupCards(group).map(c => c.id);
    } else if (activeGroup !== 'all') {
      cardsToReview = getReviewGroupCards(activeGroup).map(c => c.id);
    } else {
      cardsToReview = getOrderedReviewCards().map(c => c.id);
    }

    if (cardsToReview.length === 0) {
      Taro.showToast({ title: '暂无待复习卡片', icon: 'none' });
      return;
    }
    setReviewSessionCards(cardsToReview);
    setReviewedInSession(new Set());
    setMasteryChangesInSession([]);
    setSingleCardMode(false);
    setMode('card');
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedMastery(null);
    setSelectedFeedback(null);
    setSessionSummary(null);
    console.log('[Review] 开始复习，共', cardsToReview.length, '张卡片');
  };

  const startSingleCardReview = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    setReviewSessionCards([cardId]);
    setReviewedInSession(new Set());
    setMasteryChangesInSession([]);
    setSingleCardMode(true);
    setMode('card');
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedMastery(null);
    setSelectedFeedback(null);
    setSessionSummary(null);
    console.log('[Review] 开始单卡复习:', cardId);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleMastery = (level: number) => {
    setSelectedMastery(level);
  };

  const handleFeedback = (feedback: ReviewFeedback) => {
    setSelectedFeedback(feedback);
  };

  const handleNext = () => {
    if (!currentCard || !currentCardId) return;

    const feedback = selectedFeedback || 'vague';
    const result = markReviewed(currentCardId, feedback);

    if (result.masteryBefore !== result.masteryAfter) {
      setMasteryChangesInSession(prev => [...prev, {
        cardId: currentCardId,
        before: result.masteryBefore,
        after: result.masteryAfter,
      }]);
    }

    if (selectedMastery) {
      markMastery(currentCardId, selectedMastery as 1 | 2 | 3 | 4 | 5);
    }

    setReviewedInSession(prev => new Set([...prev, currentCardId]));

    if (singleCardMode) {
      const summary = generateSessionSummary([currentCardId]);
      setSessionSummary(summary);
      setShowComplete(true);
    } else if (currentIndex < reviewSessionCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
      setSelectedMastery(null);
      setSelectedFeedback(null);
    } else {
      const summary = generateSessionSummary(Array.from(reviewedInSession).concat(currentCardId));
      setSessionSummary(summary);
      setShowComplete(true);
      console.log('[Review] 复习完成，共复习', reviewSessionCards.length, '张卡片');
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
      setSelectedMastery(null);
      setSelectedFeedback(null);
    }
  };

  const handleCompleteClose = () => {
    setShowComplete(false);
    setSessionSummary(null);
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
      markReviewed(randomCard.id, 'remembered');
      setShowRandomCard(false);
      Taro.showToast({ title: '已标记复习', icon: 'success' });
    }
  };

  const getGroupBadgeClass = (group: ReviewGroup) => {
    const badgeClasses: Record<ReviewGroup, string> = {
      overdue: 'overdue',
      today: 'today',
      tomorrow: 'tomorrow',
      next3days: 'next3days',
      next7days: 'next7days',
      later: 'later',
    };
    return badgeClasses[group] || '';
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
          onClick={() => startReview()}
        >
          <Text>🎴 卡片模式</Text>
        </View>
      </View>

      <View className={styles.content}>
        {mode === 'list' && (
          <View className={styles.listMode}>
            <View className={styles.groupTabs}>
              <ScrollView scrollX className={styles.groupScroll}>
                <View className={styles.groupTabsInner}>
                  <View
                    className={classnames(styles.groupTab, activeGroup === 'all' && styles.active)}
                    onClick={() => setActiveGroup('all')}
                  >
                    <Text>📋 全部</Text>
                    <Text className={styles.groupCount}>{pendingReviewCards.length}</Text>
                  </View>
                  {reviewGroups.map(({ group, label, count }) => (
                    <View
                      key={group}
                      className={classnames(
                        styles.groupTab,
                        activeGroup === group && styles.active,
                        styles[getGroupBadgeClass(group)]
                      )}
                      onClick={() => setActiveGroup(group)}
                    >
                      <Text>{label}</Text>
                      <Text className={styles.groupCount}>{count}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View className={styles.listHeader}>
              <Text className={styles.listTitle}>
                {activeGroup === 'all'
                  ? `待复习卡片 (${displayCards.length})`
                  : `${reviewGroups.find(g => g.group === activeGroup)?.label || activeGroup} (${displayCards.length})`
                }
              </Text>
              {displayCards.length > 0 && (
                <View className={styles.startBtn} onClick={() => startReview()}>
                  <Text>开始复习</Text>
                </View>
              )}
            </View>

            <ScrollView className={styles.listScroll}>
              {displayCards.length === 0 ? (
                <EmptyState
                  icon="🎉"
                  title="太棒了！"
                  description="这个分组的复习任务已全部完成，明天继续加油"
                />
              ) : (
                displayCards.map((card, index) => (
                  <View key={card.id} className={styles.reviewCardItem}>
                    <View className={styles.reviewCardHeader}>
                      <View className={classnames(styles.reviewBadge, styles[getGroupBadgeClass(getCardReviewGroup(card))])}>
                        <Text>{formatReviewTime(card.nextReviewAt)}</Text>
                      </View>
                      {card.masteryLevel > 0 && (
                        <View className={styles.masteryBadge}>
                          <Text>{masteryEmojis[card.masteryLevel - 1]} {masteryLabels[card.masteryLevel - 1]}</Text>
                        </View>
                      )}
                    </View>
                    <CardItem
                      card={card}
                      showActions
                      onReview={() => {
                        if (activeGroup !== 'all') {
                          const groupCards = getReviewGroupCards(activeGroup);
                          const groupIndex = groupCards.findIndex(c => c.id === card.id);
                          if (groupIndex >= 0) {
                            setCurrentIndex(groupIndex);
                            startReview(activeGroup);
                          }
                        } else {
                          const allCards = getOrderedReviewCards();
                          const allIndex = allCards.findIndex(c => c.id === card.id);
                          if (allIndex >= 0) {
                            setCurrentIndex(allIndex);
                            startReview();
                          }
                        }
                      }}
                    />
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        )}

        {mode === 'card' && currentCard && (
          <View className={styles.cardMode}>
            <View className={styles.sessionProgress}>
              <Text className={styles.sessionProgressText}>
                {singleCardMode
                  ? '单卡复习模式'
                  : `本次复习进度: ${sessionReviewedCount}/${sessionTotalCount} (${sessionProgressPercent}%)`
                }
              </Text>
              {!singleCardMode && sessionTotalCount > 0 && (
                <View className={styles.sessionProgressBar}>
                  <View
                    className={styles.sessionProgressFill}
                    style={{ width: `${sessionProgressPercent}%` }}
                  />
                </View>
              )}
            </View>

            <View className={styles.cardContainer} onClick={handleFlip}>
              <View className={classnames(styles.flipCard, isFlipped && styles.flipped)}>
                <View className={classnames(styles.cardFace, styles.cardFront)}>
                  <Text className={styles.hintIcon}>🤔</Text>
                  <Text className={styles.hintText}>点击卡片查看内容</Text>
                  {!singleCardMode && (
                    <Text className={styles.tapHint}>第 {currentIndex + 1} / {sessionTotalCount} 张</Text>
                  )}
                  <View className={styles.scheduledTime}>
                    <Text className={styles.scheduledLabel}>计划复习时间: {formatReviewTime(currentCard.nextReviewAt)}</Text>
                  </View>
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

                <Text className={styles.feedbackTitle}>复习反馈（影响下次复习时间）</Text>
                <View className={styles.feedbackButtons}>
                  {feedbackOptions.map((option) => (
                    <View
                      key={option.key}
                      className={classnames(
                        styles.feedbackBtn,
                        styles[option.className],
                        selectedFeedback === option.key && styles.selected
                      )}
                      onClick={() => handleFeedback(option.key)}
                    >
                      <Text className={styles.feedbackEmoji}>{option.emoji}</Text>
                      <Text className={styles.feedbackLabel}>{option.label}</Text>
                      <Text className={styles.feedbackDesc}>{option.description}</Text>
                    </View>
                  ))}
                </View>

                <View className={styles.actionRow}>
                  {!singleCardMode && (
                    <View
                      className={classnames(styles.navBtn, styles.secondary)}
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                    >
                      <Text>← 上一张</Text>
                    </View>
                  )}
                  <View
                    className={classnames(
                      styles.navBtn,
                      styles.primary,
                      singleCardMode && styles.fullWidth
                    )}
                    onClick={handleNext}
                  >
                    <Text>
                      {singleCardMode ? '完成 ✓' : (currentIndex === sessionTotalCount - 1 ? '完成 ✓' : '下一张 →')}
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

      {showComplete && sessionSummary && (
        <View className={styles.completeModal}>
          <View className={styles.modalContent}>
            <Text className={styles.celebrateIcon}>🎉</Text>
            <Text className={styles.modalTitle}>太棒了！</Text>
            <Text className={styles.modalSubtitle}>
              {singleCardMode ? '单卡复习已完成' : '你已完成本次的复习任务'}
            </Text>

            <View className={styles.modalStats}>
              <View className={styles.modalStat}>
                <Text className={styles.statNum}>{sessionSummary.totalReviewed}</Text>
                <Text className={styles.statLabel}>本次复习</Text>
              </View>
              <View className={styles.modalStat}>
                <Text className={styles.statNum}>{sessionSummary.masteryChanges.length}</Text>
                <Text className={styles.statLabel}>掌握变化</Text>
              </View>
              <View className={styles.modalStat}>
                <Text className={styles.statNum}>
                  {sessionSummary.averageMasteryChange > 0 ? '+' : ''}{sessionSummary.averageMasteryChange.toFixed(1)}
                </Text>
                <Text className={styles.statLabel}>平均提升</Text>
              </View>
            </View>

            {sessionSummary.masteryChanges.length > 0 && (
              <View className={styles.summarySection}>
                <Text className={styles.summaryTitle}>📊 掌握程度变化</Text>
                <ScrollView className={styles.summaryScroll}>
                  {sessionSummary.masteryChanges.map(({ card, before, after }) => (
                    <View key={card.id} className={styles.changeItem}>
                      <Text className={styles.changeContent} numberOfLines={2}>
                        {card.content}
                      </Text>
                      <View className={styles.changeArrow}>
                        <Text>{masteryEmojis[before - 1]} → {masteryEmojis[after - 1]}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {sessionSummary.nextReviewSchedule.length > 0 && (
              <View className={styles.summarySection}>
                <Text className={styles.summaryTitle}>📅 下次复习计划</Text>
                <ScrollView className={styles.summaryScroll}>
                  {sessionSummary.nextReviewSchedule.slice(0, 5).map(({ card, nextReviewAt }) => (
                    <View key={card.id} className={styles.scheduleItem}>
                      <Text className={styles.scheduleContent} numberOfLines={2}>
                        {card.content}
                      </Text>
                      <View className={styles.scheduleTime}>
                        <Text>{formatNextReviewTime(nextReviewAt)}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

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