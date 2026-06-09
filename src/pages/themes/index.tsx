import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Input, Textarea } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import styles from './index.module.scss';
import classnames from 'classnames';
import { useCards } from '@/store/CardContext';
import CardItem from '@/components/CardItem';
import EmptyState from '@/components/EmptyState';
import { Card, ThemeNote } from '@/types/card';

const colorOptions = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#84cc16', '#f97316',
];

const masteryEmojis = ['😕', '🤔', '🙂', '😊', '🤩'];
const masteryLabels = ['初识', '了解', '熟悉', '掌握', '精通'];

const ThemesPage: React.FC = () => {
  const {
    cards,
    themes,
    favoriteCards,
    toggleFavorite,
    addTheme,
    createThemeNote,
    updateThemeNote,
    deleteThemeNote,
    getThemeNotes,
  } = useCards();

  const [activeTab, setActiveTab] = useState<'themes' | 'favorites' | 'notes'>('themes');
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showNewTheme, setShowNewTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<'source' | 'mastery'>('mastery');
  const [editingNote, setEditingNote] = useState<ThemeNote | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

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

    return [...themeList, ...customThemes];
  }, [themes, themeStats]);

  const selectedThemeCards = useMemo(() => {
    if (!selectedTheme) return [];
    return cards.filter(card => card.themes.includes(selectedTheme));
  }, [selectedTheme, cards]);

  const themeNotes = useMemo(() => {
    if (!selectedTheme) return [];
    return getThemeNotes(selectedTheme);
  }, [selectedTheme, getThemeNotes]);

  const allNotes = useMemo(() => getThemeNotes(), [getThemeNotes]);

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
      Taro.showToast({ title: '刷新成功', icon: 'success' });
    }, 1000);
  });

  const handleThemeClick = (themeName: string) => {
    setSelectedTheme(selectedTheme === themeName ? null : themeName);
    setSelectMode(false);
    setSelectedCardIds(new Set());
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const selectAllCards = () => {
    if (selectedCardIds.size === selectedThemeCards.length) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(selectedThemeCards.map(c => c.id)));
    }
  };

  const handleGenerateNotes = () => {
    const cardsToUse = selectMode
      ? Array.from(selectedCardIds)
      : selectedThemeCards.map(c => c.id);

    if (cardsToUse.length === 0) {
      Taro.showToast({ title: '请选择要生成笔记的卡片', icon: 'none' });
      return;
    }

    const note = createThemeNote(selectedTheme!, cardsToUse, groupBy);
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setShowNotes(true);
    console.log('[Themes] 生成笔记:', selectedTheme, '分组方式:', groupBy);
  };

  const handleSaveNote = () => {
    if (!editingNote) return;

    updateThemeNote(editingNote.id, {
      title: noteTitle,
      content: noteContent,
    });

    Taro.showToast({ title: '笔记已保存', icon: 'success' });
    setShowNotes(false);
    setEditingNote(null);
    console.log('[Themes] 保存笔记:', editingNote.id);
  };

  const handleCopyNote = () => {
    const fullContent = `# ${noteTitle}\n\n${noteContent}`;

    Taro.setClipboardData({
      data: fullContent,
      success: () => {
        Taro.showToast({ title: '已复制到剪贴板', icon: 'success' });
      },
    });
  };

  const handleShareNote = () => {
    Taro.showShareMenu({
      withShareTicket: true,
      success: () => {
        Taro.showToast({ title: '请点击右上角分享', icon: 'none' });
      },
    });
  };

  const handleEditNote = (note: ThemeNote) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setShowNotes(true);
  };

  const handleDeleteNote = (noteId: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这篇笔记吗？',
      success: (res) => {
        if (res.confirm) {
          deleteThemeNote(noteId);
          Taro.showToast({ title: '已删除', icon: 'success' });
        }
      },
    });
  };

  const handleAddTheme = () => {
    setShowNewTheme(true);
  };

  const confirmNewTheme = () => {
    if (newThemeName.trim()) {
      const themeName = newThemeName.trim();
      const existingTheme = themes.find(t => t.name === themeName);
      if (existingTheme) {
        Taro.showToast({ title: '主题已存在', icon: 'none' });
        return;
      }
      addTheme({
        id: `theme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: themeName,
        color: selectedColor,
      });
      Taro.showToast({ title: '主题创建成功', icon: 'success' });
      setNewThemeName('');
      setSelectedColor(colorOptions[Math.floor(Math.random() * colorOptions.length)]);
      setShowNewTheme(false);
      console.log('[Themes] 新建主题:', themeName, selectedColor);
    }
  };

  const handleBack = () => {
    setSelectedTheme(null);
    setSelectMode(false);
    setSelectedCardIds(new Set());
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  return (
    <View className={styles.page}>
      <View className={styles.tabBar}>
        <View
          className={classnames(styles.tabBtn, activeTab === 'themes' && styles.active)}
          onClick={() => { setActiveTab('themes'); setSelectedTheme(null); }}
        >
          <Text className={styles.tabIcon}>🏷️</Text>
          <Text>主题分类</Text>
        </View>
        <View
          className={classnames(styles.tabBtn, activeTab === 'favorites' && styles.active)}
          onClick={() => { setActiveTab('favorites'); setSelectedTheme(null); }}
        >
          <Text className={styles.tabIcon}>⭐</Text>
          <Text>我的收藏</Text>
        </View>
        <View
          className={classnames(styles.tabBtn, activeTab === 'notes' && styles.active)}
          onClick={() => { setActiveTab('notes'); setSelectedTheme(null); }}
        >
          <Text className={styles.tabIcon}>📝</Text>
          <Text>笔记列表</Text>
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
            </View>

            <View className={styles.detailActions}>
              <View className={styles.actionGroup}>
                <View className={styles.selectModeToggle}>
                  <Text className={styles.actionLabel}>选择卡片</Text>
                  <View
                    className={classnames(styles.switchBtn, selectMode && styles.active)}
                    onClick={() => {
                      setSelectMode(!selectMode);
                      if (!selectMode) {
                        setSelectedCardIds(new Set());
                      }
                    }}
                  >
                      <View className={styles.switchTrack}>
                        <View className={styles.switchThumb} />
                      </View>
                      <Text className={styles.switchLabel}>{selectMode ? '开启' : '关闭'}</Text>
                    </View>
                  </View>
              </View>

              {selectMode && (
                <View className={styles.selectionBar}>
                  <View
                    className={styles.selectAllBtn}
                    onClick={selectAllCards}
                  >
                    <Text>
                      {selectedCardIds.size === selectedThemeCards.length ? '取消全选' : '全选'}
                    </Text>
                  </View>
                  <Text className={styles.selectedCount}>
                    已选 {selectedCardIds.size}/{selectedThemeCards.length} 张
                  </Text>
                </View>
              )}

              <View className={styles.groupBySection}>
                <Text className={styles.actionLabel}>笔记分组方式</Text>
                <View className={styles.groupByOptions}>
                  <View
                    className={classnames(styles.groupOption, groupBy === 'mastery' && styles.active)}
                    onClick={() => setGroupBy('mastery')}
                  >
                    <Text>按掌握程度</Text>
                  </View>
                  <View
                    className={classnames(styles.groupOption, groupBy === 'source' && styles.active)}
                    onClick={() => setGroupBy('source')}
                  >
                    <Text>按来源</Text>
                  </View>
                </View>
              </View>

              <View
                className={classnames(
                  styles.generateBtn,
                  (selectMode ? selectedCardIds.size === 0 : selectedThemeCards.length === 0) && styles.disabled
                )}
                onClick={handleGenerateNotes}
              >
                <Text className={styles.btnIcon}>📝</Text>
                <Text className={styles.btnText}>
                  {selectMode ? `生成笔记 (${selectedCardIds.size}张)` : '生成笔记 (全部)'}
                </Text>
              </View>
            </View>

            <View className={styles.cardSection}>
              <View className={styles.sectionHeader}>
                <Text className={styles.sectionTitle}>卡片列表</Text>
                <Text className={styles.sectionCount}>共 {selectedThemeCards.length} 张</Text>
              </View>

              <ScrollView className={styles.cardList}>
                {selectedThemeCards.map((card) => (
                  <View key={card.id} className={styles.cardWrapper}>
                    {selectMode && (
                      <View
                        className={classnames(
                          styles.checkbox,
                          selectedCardIds.has(card.id) && styles.checked
                        )}
                        onClick={() => toggleCardSelection(card.id)}
                      >
                        {selectedCardIds.has(card.id) && <Text className={styles.checkmark}>✓</Text>}
                      </View>
                    )}
                    <View className={styles.cardContentWrapper}>
                      <CardItem card={card} showActions />
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            {themeNotes.length > 0 && (
              <View className={styles.notesSection}>
                <View className={styles.sectionHeader}>
                  <Text className={styles.sectionTitle}>📝 主题笔记</Text>
                  <Text className={styles.sectionCount}>共 {themeNotes.length} 篇</Text>
                </View>
                <ScrollView className={styles.notesList}>
                  {themeNotes.map((note) => (
                    <View key={note.id} className={styles.noteListItem}>
                      <View className={styles.noteListHeader}>
                        <Text className={styles.noteListTitle}>{note.title}</Text>
                        <Text className={styles.noteListDate}>{formatDate(note.createdAt)}</Text>
                      </View>
                      <Text className={styles.noteListPreview} numberOfLines={2}>
                        {note.content.replace(/[#\n]/g, ' ').trim()}
                      </Text>
                      <View className={styles.noteListActions}>
                        <View className={styles.noteListBtn} onClick={() => handleEditNote(note)}>
                          <Text>编辑</Text>
                        </View>
                        <View
                          className={classnames(styles.noteListBtn, styles.danger)}
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Text>删除</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
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

        {activeTab === 'notes' && (
          <View className={styles.notesPage}>
            <View className={styles.sectionHeader}>
              <Text className={styles.sectionTitle}>📝 所有笔记</Text>
              <Text className={styles.sectionCount}>共 {allNotes.length} 篇</Text>
            </View>

            <ScrollView>
              {allNotes.length === 0 ? (
                <EmptyState
                  icon="📝"
                  title="暂无笔记"
                  description="进入主题详情页，选择卡片生成主题笔记"
                />
              ) : (
                  allNotes.map((note) => (
                    <View key={note.id} className={styles.noteListItem}>
                      <View className={styles.noteListHeader}>
                        <View className={styles.noteThemeTag}>
                          <Text className={styles.noteThemeName}>{note.themeName}</Text>
                        </View>
                        <Text className={styles.noteListDate}>{formatDate(note.createdAt)}</Text>
                      </View>
                      <Text className={styles.noteListTitle}>{note.title}</Text>
                      <Text className={styles.noteListPreview} numberOfLines={2}>
                        {note.content.replace(/[#\n]/g, ' ').trim()}
                      </Text>
                      <View className={styles.noteListActions}>
                        <View className={styles.noteListBtn} onClick={() => handleEditNote(note)}>
                          <Text>编辑</Text>
                        </View>
                        <View
                          className={classnames(styles.noteListBtn, styles.danger)}
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Text>删除</Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
            </ScrollView>
          </View>
        )}
      </View>

      {showNotes && editingNote && (
        <View className={styles.notesModal} onClick={() => setShowNotes(false)}>
          <View className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <View className={styles.modalHeader}>
            <Text className={styles.modalTitle}>📝 {editingNote.themeName} 主题笔记</Text>
            <View className={styles.closeBtn} onClick={() => setShowNotes(false)}>
              <Text>✕</Text>
            </View>
            </View>
            <View className={styles.modalBody}>
              <Text className={styles.inputLabel}>笔记标题</Text>
              <Input
                className={styles.noteTitleInput}
                placeholder="请输入笔记标题"
                value={noteTitle}
                onInput={(e) => setNoteTitle(e.detail.value)}
              />

              <Text className={styles.inputLabel}>笔记内容</Text>
              <Textarea
                className={styles.noteContentInput}
                placeholder="在此编辑笔记内容，支持分段和换行"
                value={noteContent}
                onInput={(e) => setNoteContent(e.detail.value)}
                autoHeight
                maxlength={-1}
              />
            </View>
            <View className={styles.modalFooter}>
              <View
                className={classnames(styles.modalBtn, styles.secondary)}
                onClick={() => setShowNotes(false)}
              >
                <Text>关闭</Text>
              </View>
              <View
                className={classnames(styles.modalBtn, styles.secondary)}
                onClick={handleCopyNote}
              >
                <Text>复制</Text>
              </View>
              <View
                className={classnames(styles.modalBtn, styles.secondary)}
                onClick={handleShareNote}
              >
                <Text>分享</Text>
              </View>
              <View
                className={classnames(styles.modalBtn, styles.primary)}
                onClick={handleSaveNote}
              >
                <Text>保存</Text>
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
