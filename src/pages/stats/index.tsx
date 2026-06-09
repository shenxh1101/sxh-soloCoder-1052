import React, { useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import styles from './index.module.scss';
import classnames from 'classnames';
import { useCards } from '@/store/CardContext';
import { getDayName } from '@/utils/date';

const masteryEmojis = ['😕', '🤔', '🙂', '😊', '🤩'];
const masteryNames = ['初识', '了解', '熟悉', '掌握', '精通'];

const StatsPage: React.FC = () => {
  const { cards, getWeeklyStats } = useCards();

  const weeklyStats = useMemo(() => getWeeklyStats(), [getWeeklyStats]);

  const totalReviews = useMemo(() => {
    return cards.reduce((sum, card) => sum + card.reviewCount, 0);
  }, [cards]);

  const masteryDistribution = useMemo(() => {
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    cards.forEach(card => {
      distribution[card.masteryLevel]++;
    });
    return distribution;
  }, [cards]);

  const maxBarValue = useMemo(() => {
    const values = weeklyStats.dailyStats.flatMap(d => [d.newCards, d.reviewedCards]);
    return Math.max(...values, 1);
  }, [weeklyStats]);

  const maxThemeCount = useMemo(() => {
    if (weeklyStats.topThemes.length === 0) return 1;
    return Math.max(...weeklyStats.topThemes.map(t => t.count));
  }, [weeklyStats]);

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
      Taro.showToast({ title: '数据已更新', icon: 'success' });
    }, 1000);
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  const handleShare = () => {
    Taro.showShareMenu?.();
    const shareText = `我已经积累了 ${cards.length} 张知识卡片，复习了 ${totalReviews} 次，一起来学习吧！`;
    Taro.setClipboardData({
      data: shareText,
      success: () => {
        Taro.showToast({ title: '分享文案已复制', icon: 'success' });
      },
    });
    console.log('[Stats] 分享学习成果');
  };

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <View className={styles.userGreeting}>
          <Text className={styles.greetingText}>{getGreeting()}，学习者 ✨</Text>
          <Text className={styles.subText}>坚持学习，每天进步一点点</Text>
          <View className={styles.streakBadge}>
            <Text className={styles.streakIcon}>🔥</Text>
            <Text className={styles.streakText}>连续学习 7 天</Text>
          </View>
        </View>

        <View className={styles.overviewGrid}>
          <View className={styles.overviewCard}>
            <Text className={styles.cardIcon}>📚</Text>
            <Text className={styles.cardValue}>{cards.length}</Text>
            <Text className={styles.cardLabel}>总卡片数</Text>
            <View className={styles.cardTrend}>
              <Text className={styles.trendText}>↑ 本周 +{weeklyStats.totalNew}</Text>
            </View>
          </View>

          <View className={styles.overviewCard}>
            <Text className={styles.cardIcon}>🔄</Text>
            <Text className={styles.cardValue}>{totalReviews}</Text>
            <Text className={styles.cardLabel}>总复习次数</Text>
            <View className={styles.cardTrend}>
              <Text className={styles.trendText}>↑ 本周 +{weeklyStats.totalReviewed}</Text>
            </View>
          </View>

          <View className={styles.overviewCard}>
            <Text className={styles.cardIcon}>⭐</Text>
            <Text className={styles.cardValue}>{cards.filter(c => c.isFavorite).length}</Text>
            <Text className={styles.cardLabel}>收藏卡片</Text>
          </View>

          <View className={styles.overviewCard}>
            <Text className={styles.cardIcon}>🎯</Text>
            <Text className={styles.cardValue}>{Math.round(cards.filter(c => c.masteryLevel >= 4).length / cards.length * 100) || 0}%</Text>
            <Text className={styles.cardLabel}>掌握率</Text>
          </View>
        </View>
      </View>

      <ScrollView className={styles.content}>
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>
              <Text className={styles.titleIcon}>📊</Text>
              本周学习统计
            </Text>
            <Text className={styles.sectionSubtitle}>新增 / 复习</Text>
          </View>

          <View className={styles.chartContainer}>
            <View className={styles.chartLegend}>
              <View className={styles.legendItem}>
                <View className={classnames(styles.legendDot, styles.legendNew)} />
                <Text className={styles.legendText}>新增卡片</Text>
              </View>
              <View className={styles.legendItem}>
                <View className={classnames(styles.legendDot, styles.legendReviewed)} />
                <Text className={styles.legendText}>复习卡片</Text>
              </View>
            </View>

            <View className={styles.chartBars}>
              {weeklyStats.dailyStats.map((day, idx) => (
                <View key={idx} className={styles.barGroup}>
                  <View className={styles.bars}>
                    <View
                      className={classnames(styles.bar, styles.barNew)}
                      style={{ height: `${(day.newCards / maxBarValue) * 100}%` }}
                    />
                    <View
                      className={classnames(styles.bar, styles.barReviewed)}
                      style={{ height: `${(day.reviewedCards / maxBarValue) * 100}%` }}
                    />
                  </View>
                  <Text className={styles.barLabel}>{getDayName(day.date)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View className={classnames(styles.section, styles.masterySection)}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>
              <Text className={styles.titleIcon}>🎯</Text>
              掌握程度分布
            </Text>
            <Text className={styles.sectionSubtitle}>共 {cards.length} 张</Text>
          </View>

          <View className={styles.masteryList}>
            {[5, 4, 3, 2, 1].map((level) => (
              <View key={level} className={styles.masteryItem}>
                <View className={styles.masteryHeader}>
                  <View className={styles.masteryInfo}>
                    <Text className={styles.masteryEmoji}>{masteryEmojis[level - 1]}</Text>
                    <Text className={styles.masteryName}>{masteryNames[level - 1]}</Text>
                  </View>
                  <Text className={styles.masteryCount}>
                    {masteryDistribution[level]} 张 ({Math.round(masteryDistribution[level] / cards.length * 100) || 0}%)
                  </Text>
                </View>
                <View className={styles.progressBar}>
                  <View
                    className={classnames(styles.progressFill, styles[`fill${level}`])}
                    style={{ width: `${(masteryDistribution[level] / cards.length) * 100}%` }}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className={classnames(styles.section, styles.themesSection)}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>
              <Text className={styles.titleIcon}>🏷️</Text>
              热门主题
            </Text>
            <Text className={styles.sectionSubtitle}>卡片数量排行</Text>
          </View>

          <View className={styles.themesList}>
            {weeklyStats.topThemes.length === 0 ? (
              <Text style={{ color: '#94a3b8', textAlign: 'center', padding: '32rpx' }}>
                暂无主题数据
              </Text>
            ) : (
              weeklyStats.topThemes.map((theme, idx) => (
                <View key={idx} className={styles.themeRank}>
                  <View className={classnames(
                    styles.rankNumber,
                    idx === 0 && styles.rank1,
                    idx === 1 && styles.rank2,
                    idx === 2 && styles.rank3,
                    idx > 2 && styles.rankOther
                  )}>
                    <Text>{idx + 1}</Text>
                  </View>
                  <View className={styles.themeInfo}>
                    <Text className={styles.themeName}>{theme.name}</Text>
                    <View className={styles.themeProgress}>
                      <View
                        className={styles.progressFill}
                        style={{
                          width: `${(theme.count / maxThemeCount) * 100}%`,
                          background: `linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)`
                        }}
                      />
                    </View>
                  </View>
                  <Text className={styles.themeCount}>{theme.count} 张</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View className={styles.shareSection}>
          <Text className={styles.shareIcon}>🎉</Text>
          <Text className={styles.shareTitle}>分享你的学习成果</Text>
          <Text className={styles.shareDesc}>
            已积累 {cards.length} 张卡片，复习 {totalReviews} 次，
            连续学习 7 天，坚持就是胜利！
          </Text>
          <View className={styles.shareBtn} onClick={handleShare}>
            <Text className={styles.btnIcon}>↗</Text>
            <Text>分享学习报告</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default StatsPage;
