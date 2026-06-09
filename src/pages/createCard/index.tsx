import React, { useState } from 'react';
import { View, Text, Textarea, Input, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import classnames from 'classnames';
import { useCards } from '@/store/CardContext';
import ThemeTag from '@/components/ThemeTag';

const sourceTypes = [
  { key: 'book', label: '📖 书籍' },
  { key: 'course', label: '🎓 课程' },
  { key: 'article', label: '📰 文章' },
  { key: 'other', label: '📝 其他' },
];

const CreateCardPage: React.FC = () => {
  const { addCard, cards, themes } = useCards();

  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [sourceType, setSourceType] = useState<string>('book');
  const [source, setSource] = useState('');
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [selectedRelatedIds, setSelectedRelatedIds] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showNewTheme, setShowNewTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');

  const maxLength = 2000;

  const handleChooseImage = async (sourceType: 'camera' | 'album') => {
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sourceType: [sourceType],
        sizeType: ['compressed'],
      });
      if (res.tempFilePaths && res.tempFilePaths.length > 0) {
        setImageUrl(res.tempFilePaths[0]);
        Taro.showToast({ title: '图片已添加', icon: 'success' });
        console.log('[CreateCard] 选择图片:', res.tempFilePaths[0]);
      }
    } catch (error) {
      console.error('[CreateCard] 选择图片失败:', error);
      Taro.showToast({ title: '取消选择', icon: 'none' });
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(undefined);
  };

  const toggleTheme = (themeName: string) => {
    setSelectedThemes(prev =>
      prev.includes(themeName)
        ? prev.filter(t => t !== themeName)
        : [...prev, themeName]
    );
  };

  const handleAddTheme = () => {
    setShowNewTheme(true);
  };

  const confirmNewTheme = () => {
    if (newThemeName.trim()) {
      setSelectedThemes(prev => [...prev, newThemeName.trim()]);
      setNewThemeName('');
      setShowNewTheme(false);
      Taro.showToast({ title: '标签已添加', icon: 'success' });
    }
  };

  const toggleRelatedCard = (cardId: string) => {
    setSelectedRelatedIds(prev =>
      prev.includes(cardId)
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleSave = () => {
    if (!content.trim()) {
      Taro.showToast({ title: '请输入卡片内容', icon: 'none' });
      return;
    }

    addCard({
      content: content.trim(),
      source: source.trim() || undefined,
      sourceType: sourceType as any,
      themes: selectedThemes,
      relatedCardIds: selectedRelatedIds,
      isFavorite,
      imageUrl,
    });

    Taro.showToast({ title: '创建成功', icon: 'success' });
    console.log('[CreateCard] 卡片创建成功');

    setTimeout(() => {
      setContent('');
      setSource('');
      setSelectedThemes([]);
      setSelectedRelatedIds([]);
      setIsFavorite(false);
      setImageUrl(undefined);
      Taro.switchTab({ url: '/pages/cardFlow/index' });
    }, 1000);
  };

  const canSave = content.trim().length > 0;

  return (
    <View className={styles.page}>
      <View className={styles.form}>
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>
            <Text className={styles.titleIcon}>✏️</Text>
            卡片内容
          </Text>
          <Textarea
            className={styles.contentInput}
            placeholder="记录你的知识感悟、读书笔记、课程摘要..."
            value={content}
            onInput={(e) => setContent(e.detail.value)}
            maxlength={maxLength}
            autoHeight
            showConfirmBar={false}
            adjustPosition
          />
          <Text className={styles.charCount}>{content.length}/{maxLength}</Text>
        </View>

        <View className={classnames(styles.section, styles.imageSection)}>
          <Text className={styles.sectionTitle}>
            <Text className={styles.titleIcon}>📷</Text>
            配图识别
          </Text>
          {imageUrl ? (
            <View className={styles.imagePreview}>
              <Image src={imageUrl} className={styles.previewImage} mode="aspectFill" />
              <View className={styles.removeBtn} onClick={handleRemoveImage}>
                <Text>✕</Text>
              </View>
            </View>
          ) : null}
          <View className={styles.imageActions}>
            <View className={styles.imageBtn} onClick={() => handleChooseImage('camera')}>
              <Text className={styles.btnIcon}>📸</Text>
              <Text className={styles.btnText}>拍照识别</Text>
            </View>
            <View className={styles.imageBtn} onClick={() => handleChooseImage('album')}>
              <Text className={styles.btnIcon}>🖼️</Text>
              <Text className={styles.btnText}>从相册选择</Text>
            </View>
          </View>
        </View>

        <View className={classnames(styles.section, styles.sourceSection)}>
          <Text className={styles.sectionTitle}>
            <Text className={styles.titleIcon}>📚</Text>
            来源信息
          </Text>
          <View className={styles.sourceTypes}>
            {sourceTypes.map((type) => (
              <View
                key={type.key}
                className={classnames(styles.sourceType, sourceType === type.key && styles.active)}
                onClick={() => setSourceType(type.key)}
              >
                <Text>{type.label}</Text>
              </View>
            ))}
          </View>
          <Input
            className={styles.sourceInput}
            placeholder="输入来源名称，如《思考，快与慢》"
            value={source}
            onInput={(e) => setSource(e.detail.value)}
          />
        </View>

        <View className={classnames(styles.section, styles.themesSection)}>
          <Text className={styles.sectionTitle}>
            <Text className={styles.titleIcon}>🏷️</Text>
            主题标签
          </Text>
          <View className={styles.themeList}>
            {themes.map((theme) => (
              <View
                key={theme.id}
                className={classnames(
                  styles.themeItem,
                  selectedThemes.includes(theme.name) && styles.selected
                )}
                onClick={() => toggleTheme(theme.name)}
              >
                <Text className={styles.themeText} style={{ color: selectedThemes.includes(theme.name) ? theme.color : undefined }}>
                  {theme.name}
                </Text>
              </View>
            ))}
            {selectedThemes.filter(t => !themes.find(th => th.name === t)).map((theme, idx) => (
              <View
                key={`custom-${idx}`}
                className={classnames(styles.themeItem, styles.selected)}
                onClick={() => toggleTheme(theme)}
              >
                <Text className={styles.themeText} style={{ color: '#6366f1' }}>{theme}</Text>
              </View>
            ))}
            <View className={styles.addTheme} onClick={handleAddTheme}>
              <Text>+ 新建标签</Text>
            </View>
          </View>
        </View>

        <View className={classnames(styles.section, styles.relatedSection)}>
          <Text className={styles.sectionTitle}>
            <Text className={styles.titleIcon}>🔗</Text>
            关联卡片
          </Text>
          <Text className={styles.relatedHint}>选择与本卡片相关的其他卡片，建立知识网络</Text>
          <View className={styles.relatedList}>
            {cards.slice(0, 10).map((card) => (
              <View
                key={card.id}
                className={classnames(
                  styles.relatedCard,
                  selectedRelatedIds.includes(card.id) && styles.selected
                )}
                onClick={() => toggleRelatedCard(card.id)}
              >
                <View className={classnames(
                  styles.checkbox,
                  selectedRelatedIds.includes(card.id) && styles.checked
                )}>
                  {selectedRelatedIds.includes(card.id) && (
                    <Text className={styles.checkIcon}>✓</Text>
                  )}
                </View>
                <Text className={styles.cardContent}>{card.content}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View className={styles.bottomBar}>
        <View
          className={classnames(styles.favoriteToggle, isFavorite && styles.active)}
          onClick={() => setIsFavorite(!isFavorite)}
        >
          <Text className={styles.starIcon}>{isFavorite ? '⭐' : '☆'}</Text>
          <Text className={styles.toggleText}>{isFavorite ? '已收藏' : '收藏'}</Text>
        </View>
        <View
          className={classnames(styles.saveBtn)}
          onClick={handleSave}
        >
          <Text className={styles.btnIcon}>💾</Text>
          <Text className={styles.btnText}>保存卡片</Text>
        </View>
      </View>

      {showNewTheme && (
        <View className={styles.modalOverlay} onClick={() => setShowNewTheme(false)}>
          <View className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.modalTitle}>新建主题标签</Text>
            <Input
              className={styles.modalInput}
              placeholder="输入标签名称"
              value={newThemeName}
              onInput={(e) => setNewThemeName(e.detail.value)}
              focus
            />
            <View className={styles.modalActions}>
              <View
                className={classnames(styles.modalBtn, styles.cancel)}
                onClick={() => setShowNewTheme(false)}
              >
                <Text>取消</Text>
              </View>
              <View
                className={classnames(styles.modalBtn, styles.confirm)}
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

export default CreateCardPage;
