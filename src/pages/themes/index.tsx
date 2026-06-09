import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import styles from './index.module.scss';
import classnames from 'classnames';
import { useCards } from '@/store/CardContext';
import CardItem from '@/components/CardItem';
import EmptyState from '@/components/EmptyState';
import { Card } from '@/types/card';

const colorOptions = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#84cc16', '#f97316',
];

const ThemesPage: React.FC = () => {
  const { cards, themes, favoriteCards, toggleFavorite } = useCards();

  const [activeTab, setActiveTab] = useState<'themes' | 'favorites'>('themes');
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState<Card[]>([]);
  const [showNewTheme, setShowNewTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);

  const themeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    cards.forEach(card => {
      card.themes.forEach(theme => {
        stats[theme] = (stats[theme] || 0) + 1;
      });
    });
    return stats;
  }, [cards]);

  const allThemes = useMemo(() => {
    const themeList = themes.map(t => ({
      ...t,
      cardCount: themeStats[t.name] || 0,
    }));

    const customThemes = Object.keys(themeStats)
      .filter(name => !themes.find(t => t.name === name))
      .map(name => ({
        id: `custom-${name}`,
        name,
        color: '#6366f1',
        cardCount: themeStats[name],
      }));

    return [...themeList, ...customThemes].filter(t => t.cardCount > 0);
  }, [themes, themeStats]);

  const selectedThemeCards = useMemo(() => {
    if (!selectedTheme) return [];
    return cards.filter(card => card.themes.includes(selectedTheme));
  }, [selectedTheme, cards]);

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
      Taro.showToast({ title: '刷新成功', icon: 'success' });
    }, 1000);
  });

  const handleThemeClick = (themeName: string) => {
    setSelectedTheme(selectedTheme === themeName ? null : themeName);
  };

  const handleGenerateNotes = () => {
    if (selectedThemeCards.length === 0) {
      Taro.showToast({ title: '该主题下暂无卡片', icon: 'none' });
      return;
    }
    setGeneratedNotes(selectedThemeCards);
    setShowNotes(true);
    console.log('[Themes] 生成笔记:', selectedTheme);
  };

  const handleCopyNotes = () => {
    const notesText = generatedNotes
      .map((card, idx) => `${idx + 1}. ${card.content}${card.source ? `\n   来源：${card.source}` : ''}`)
      .join('\n\n');

    Taro.setClipboardData({
      data: `# ${selectedTheme} 主题笔记\n\n${notesText}`,
      success: () => {
        Taro.showToast({ title: '已复制到剪贴板', icon: 'success' });
      },
    });
  };

  const handleAddTheme = () => {
    setShowNewTheme(true);
  };

  const confirmNewTheme = () => {
    if (newThemeName.trim()) {
      Taro.showToast({ title: '主题创建成功', icon: 'success' });
      setNewThemeName('');
      setSelectedColor(colorOptions[0]);
      setShowNewTheme(false);
      console.log('[Themes] 新建主题:', newThemeName, selectedColor);
    }
  };

  const handleBack = () => {
    setSelectedTheme(null);
  };

  return (
    <View className={styles.page}>
      <View className={styles.tabBar}>
        <View
          className={classnames(styles.tabBtn, activeTab === 'themes' && styles.active)}
          onClick={() => setActiveTab('themes')}
        >
          <Text className={styles.tabIcon}>🏷️</Text>
          <Text>主题分类</Text>
        </View>
        <View
          className={classnames(styles.tabBtn, activeTab === 'favorites' && styles.active)}
          onClick={() => setActiveTab('favorites')}
        >
          <Text className={styles.tabIcon}>⭐</Text>
          <Text>我的收藏</Text>
        </View>
      </View>

      <View className={styles.content}>
        {activeTab === 'themes' && !selectedTheme && (
          <View>
            <View className={styles.themeGrid}>
              {allThemes.map((theme) => (
                <View
                  key={theme.id}
                  className={classnames(styles.themeCard)}
                  style={{ borderLeftColor: theme.color, borderLeftWidth: '6rpx' }}
                  onClick={() => handleThemeClick(theme.name)}
                >
                  <View className={styles.themeHeader}>
                    <View className={styles.themeColor} style={{ backgroundColor: theme.color }} />
                    <Text className={styles.themeCount}>{theme.cardCount} 张</Text>
                  </View>
                  <Text className={styles.themeName}>{theme.name}</Text>
                  <Text className={styles.themeDesc}>点击查看详情</Text>
                </View>
              ))}
              <View className={styles.addThemeCard} onClick={handleAddTheme}>
                <Text className={styles.addIcon}>+</Text>
                <Text className={styles.addText}>新建主题</Text>
              </View>
            </View>

            {allThemes.length === 0 && (
              <EmptyState
                icon="🏷️"
                title="暂无主题"
                description="创建卡片时添加主题标签，即可在此处按主题浏览"
              />
            )}
          </View>
        )}

        {activeTab === 'themes' && selectedTheme && (
          <View className={styles.themeDetail}>
            <View
              className={styles.detailHeader}
              style={{
                background: `linear-gradient(135deg, ${allThemes.find(t => t.name === selectedTheme)?.color || '#6366f1'} 0%, ${allThemes.find(t => t.name === selectedTheme)?.color || '#6366f1'}99 100%)`,
              }}
            >
              <View className={styles.backBtn} onClick={handleBack}>
                <Text className={styles.backIcon}>←</Text>
              </View>
              <View className={styles.detailInfo}>
                <Text className={styles.detailName}>{selectedTheme}</Text>
                <Text className={styles.detailCount}>{selectedThemeCards.length} 张卡片</Text>
              </View>
              <View className={styles.generateBtn} onClick={handleGenerateNotes}>
                <Text className={styles.btnIcon}>📝</Text>
                <Text className={styles.btnText}>生成笔记</Text>
              </View>
            </View>

            <View className={styles.cardSection}>
              <View className={styles.sectionHeader}>
                <Text className={styles.sectionTitle}>卡片列表</Text>
                <Text className={styles.sectionCount}>共 {selectedThemeCards.length} 张</Text>
              </View>

              <ScrollView>
                {selectedThemeCards.map((card) => (
                  <CardItem key={card.id} card={card} showActions />
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {activeTab === 'favorites' && (
          <View className={styles.favoriteSection}>
            <View className={styles.sectionHeader}>
              <Text className={styles.sectionTitle}>⭐ 我的收藏</Text>
              <Text className={styles.sectionCount}>共 {favoriteCards.length} 张</Text>
            </View>

            <Text className={styles.favoriteHint}>
              收藏的卡片会显示在这里，方便你随时回顾重点内容
            </Text>

            <ScrollView>
              {favoriteCards.length === 0 ? (
                <EmptyState
                  icon="⭐"
                  title="暂无收藏"
                  description="点击卡片上的收藏按钮，即可将重点内容保存到这里"
                />
              ) : (
                favoriteCards.map((card) => (
                  <CardItem
                    key={card.id}
                    card={card}
                    showActions
                    onReview={() => {
                      Taro.showToast({ title: '已取消收藏', icon: 'none' });
                      toggleFavorite(card.id);
                    }}
                  />
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {showNotes && (
        <View className={styles.notesModal} onClick={() => setShowNotes(false)}>
          <View className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>📝 {selectedTheme} 主题笔记</Text>
              <View className={styles.closeBtn} onClick={() => setShowNotes(false)}>
                <Text>✕</Text>
              </View>
            </View>
            <View className={styles.modalBody}>
              {generatedNotes.map((card, idx) => (
                <View key={card.id} className={styles.noteItem}>
                  <Text className={styles.noteIndex}>卡片 {idx + 1}</Text>
                  <Text className={styles.noteContent}>{card.content}</Text>
                  {card.source && (
                    <Text className={styles.noteSource}>📚 {card.source}</Text>
                  )}
                </View>
              ))}
            </View>
            <View className={styles.modalFooter}>
              <View
                className={classnames(styles.modalBtn, styles.secondary)}
                onClick={() => setShowNotes(false)}
              >
                <Text>关闭</Text>
              </View>
              <View
                className={classnames(styles.modalBtn, styles.primary)}
                onClick={handleCopyNotes}
              >
                <Text>复制笔记</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {showNewTheme && (
        <View className={styles.newThemeModal} onClick={() => setShowNewTheme(false)}>
          <View className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>🏷️ 新建主题</Text>

            <Text className={styles.inputLabel}>主题名称</Text>
            <Input
              className={styles.nameInput}
              placeholder="请输入主题名称"
              value={newThemeName}
              onInput={(e) => setNewThemeName(e.detail.value)}
              focus
            />

            <Text className={styles.inputLabel}>选择颜色</Text>
            <View className={styles.colorPicker}>
              {colorOptions.map((color) => (
                <View
                  key={color}
                  className={classnames(styles.colorOption, selectedColor === color && styles.selected)}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <View className={styles.modalActions}>
              <View
                className={classnames(styles.actionBtn, styles.cancel)}
                onClick={() => setShowNewTheme(false)}
              >
                <Text>取消</Text>
              </View>
              <View
                className={classnames(styles.actionBtn, styles.confirm)}
                onClick={confirmNewTheme}
              >
                <Text>确定</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default ThemesPage;
