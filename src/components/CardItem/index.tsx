import React from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import classnames from 'classnames';
import { Card } from '@/types/card';
import ThemeTag from '@/components/ThemeTag';
import { getRelativeTime } from '@/utils/date';
import { useCards } from '@/store/CardContext';

interface CardItemProps {
  card: Card;
  showActions?: boolean;
  onReview?: () => void;
}

const masteryLabels: Record<number, string> = {
  1: '初识',
  2: '了解',
  3: '熟悉',
  4: '掌握',
  5: '精通',
};

const CardItem: React.FC<CardItemProps> = ({ card, showActions = false, onReview }) => {
  const { toggleFavorite, markMastery } = useCards();

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(card.id);
  };

  const handleMastery = (level: 1 | 2 | 3 | 4 | 5, e: React.MouseEvent) => {
    e.stopPropagation();
    markMastery(card.id, level);
    Taro.showToast({ title: `标记为${masteryLabels[level]}`, icon: 'success' });
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    Taro.showShareMenu?.();
    Taro.showToast({ title: '分享功能', icon: 'none' });
  };

  return (
    <View className={styles.card}>
      {card.imageUrl && (
        <View className={styles.cardImage}>
          <Image src={card.imageUrl} mode="aspectFill" className={styles.image} />
        </View>
      )}

      <View className={styles.cardContent}>
        <Text className={styles.contentText}>{card.content}</Text>
      </View>

      {card.source && (
        <View className={styles.sourceRow}>
          <Text className={styles.sourceIcon}>📚</Text>
          <Text className={styles.sourceText}>{card.source}</Text>
        </View>
      )}

      <View className={styles.tagRow}>
        {card.themes.map((theme, index) => (
          <ThemeTag key={index} name={theme} />
        ))}
      </View>

      <View className={styles.metaRow}>
        <View className={styles.metaLeft}>
          <View
            className={classnames(styles.masteryBadge, styles[`mastery${card.masteryLevel}`])}
          >
            <Text className={styles.masteryText}>{masteryLabels[card.masteryLevel]}</Text>
          </View>
          <Text className={styles.reviewCount}>已复习 {card.reviewCount} 次</Text>
        </View>
        <Text className={styles.timeText}>{getRelativeTime(card.createdAt)}</Text>
      </View>

      {showActions && (
        <View className={styles.actionRow}>
          <View className={styles.actionButtons}>
            <View
              className={classnames(styles.actionBtn, card.isFavorite && styles.favoriteActive)}
              onClick={handleFavorite}
            >
              <Text className={styles.actionIcon}>{card.isFavorite ? '⭐' : '☆'}</Text>
              <Text className={styles.actionText}>收藏</Text>
            </View>
            <View className={styles.actionBtn} onClick={handleShare}>
              <Text className={styles.actionIcon}>↗</Text>
              <Text className={styles.actionText}>分享</Text>
            </View>
            {onReview && (
              <View className={classnames(styles.actionBtn, styles.reviewBtn)} onClick={onReview}>
                <Text className={styles.actionIcon}>📝</Text>
                <Text className={styles.actionText}>复习</Text>
              </View>
            )}
          </View>

          <View className={styles.masteryRow}>
            <Text className={styles.masteryLabel}>掌握程度：</Text>
            {[1, 2, 3, 4, 5].map((level) => (
              <View
                key={level}
                className={classnames(
                  styles.masteryDot,
                  styles[`masteryDot${level}`],
                  level <= card.masteryLevel && styles.masteryDotActive
                )}
                onClick={(e) => handleMastery(level as 1 | 2 | 3 | 4 | 5, e)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

export default CardItem;
