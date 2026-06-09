import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';
import classnames from 'classnames';

interface StatCardProps {
  value: number | string;
  label: string;
  icon?: string;
  color?: string;
  trend?: number;
}

const StatCard: React.FC<StatCardProps> = ({ value, label, icon, color, trend }) => {
  const cardStyle = color ? { background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)` } : undefined;
  const valueStyle = color ? { color } : undefined;

  return (
    <View className={styles.statCard} style={cardStyle}>
      {icon && <Text className={styles.statIcon}>{icon}</Text>}
      <View className={styles.statContent}>
        <Text className={styles.statValue} style={valueStyle}>{value}</Text>
        <Text className={styles.statLabel}>{label}</Text>
      </View>
      {trend !== undefined && (
        <View className={classnames(styles.trend, trend >= 0 ? styles.trendUp : styles.trendDown)}>
          <Text className={styles.trendText}>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</Text>
        </View>
      )}
    </View>
  );
};

export default StatCard;
