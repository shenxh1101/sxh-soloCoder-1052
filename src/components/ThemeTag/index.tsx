import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';
import classnames from 'classnames';

interface ThemeTagProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md';
  onClick?: () => void;
}

const ThemeTag: React.FC<ThemeTagProps> = ({ name, color, size = 'sm', onClick }) => {
  const tagStyle = color ? { backgroundColor: `${color}15`, color } : undefined;

  return (
    <View
      className={classnames(styles.tag, size === 'md' && styles.tagMd, onClick && styles.clickable)}
      style={tagStyle}
      onClick={onClick}
    >
      <Text className={styles.tagText}>{name}</Text>
    </View>
  );
};

export default ThemeTag;
