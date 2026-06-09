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

const mockOcrResults = [
  '认知偏差是指人们在处理和解释周围世界的信息时，系统性地偏离理性或逻辑的思维模式。常见的认知偏差包括确认偏差、锚定效应、事后诸葛亮偏差等。了解这些偏差可以帮助我们做出更明智的决策。',
  '产品思维的核心是用户价值。一个好的产品经理需要具备用户同理心、数据敏感度、商业洞察力和协调推进能力。记住：用户不会告诉你他们需要什么，但会用行动告诉你他们的痛点在哪里。',
  'React Hooks 是 React 16.8 引入的新特性，允许我们在不编写 class 的情况下使用 state 以及其他的 React 特性。常用的 Hooks 包括 useState、useEffect、useContext、useCallback、useMemo 等。',
  '复利效应是指资产收益产生的收益再计入本金，从而产生更大收益的现象。爱因斯坦说："复利是世界第八大奇迹，理解它的人赚取它，不理解它的人支付它。" 长期坚持微小的进步，时间会给你惊喜。',
  '心理账户是行为经济学中的一个重要概念，指人们在心里无意识地把财富划归不同的账户进行管理，不同的心理账户有不同的记账方式和运算规则。了解心理账户可以帮助我们做出更理性的消费决策。',
];

function generateMockOcrText(): string {
  const randomIndex = Math.floor(Math.random() * mockOcrResults.length);
  return mockOcrResults[randomIndex];
}

const CreateCardPage: React.FC = () => {
  const { addCard, cards, themes, addTheme } = useCards();

  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [sourceType, setSourceType] = useState<string>('book');
  const [source, setSource] = useState('');
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [selectedRelatedIds, setSelectedRelatedIds] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showNewTheme, setShowNewTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeColor, setNewThemeColor] = useState('#6366f1');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionFailed, setRecognitionFailed] = useState(false);

  const maxLength = 2000;
  const themeColors = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#84cc16', '#f97316'];

  const handleChooseImage = async (sourceType: 'camera' | 'album') => {
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sourceType: [sourceType],
        sizeType: ['compressed'],
      });
      if (res.tempFilePaths && res.tempFilePaths.length > 0) {
        const selectedImage = res.tempFilePaths[0];
        setImageUrl(selectedImage);
        setRecognitionFailed(false);
        console.log('[CreateCard] 选择图片:', selectedImage);

        setIsRecognizing(true);
        Taro.showLoading({ title: '正在识别文字...', mask: true });

        try {
          await new Promise(resolve => setTimeout(resolve, 1500));

          const successRate = 0.85;
          const isSuccess = Math.random() < successRate;

          if (isSuccess) {
            const ocrText = generateMockOcrText();
            setContent(prev => prev ? `${prev}\n\n${ocrText}` : ocrText);
            Taro.showToast({ title: '识别成功，可编辑', icon: 'success' });
            console.log('[CreateCard] OCR识别成功');
          } else {
            setRecognitionFailed(true);
            Taro.showToast({ title: '识别失败，请手动输入', icon: 'none', duration: 2000 });
            console.log('[CreateCard] OCR识别失败');
          }
        } catch (ocrError) {
          console.error('[CreateCard] OCR识别出错:', ocrError);
          setRecognitionFailed(true);
          Taro.showToast({ title: '识别失败，请手动输入', icon: 'none', duration: 2000 });
        } finally {
          Taro.hideLoading();
          setIsRecognizing(false);
        }
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
    setNewThemeColor(themeColors[Math.floor(Math.random() * themeColors.length)]);
    setShowNewTheme(true);
  };

  const confirmNewTheme = () => {
    if (newThemeName.trim()) {
      const themeName = newThemeName.trim();
      addTheme({
        id: `theme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: themeName,
        color: newThemeColor,
      });
      setSelectedThemes(prev => [...prev, themeName]);
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
          {recognitionFailed && imageUrl && (
            <View className={styles.ocrFailedTip}>
              <Text className={styles.ocrFailedIcon}>⚠️</Text>
              <Text className={styles.ocrFailedText}>文字识别失败，图片已保留，请手动输入内容</Text>
            </View>
          )}
          {isRecognizing && (
            <View className={styles.recognizingTip}>
              <Text className={styles.recognizingIcon}>🔄</Text>
              <Text className={styles.recognizingText}>正在识别图片中的文字...</Text>
            </View>
          )}
          <View className={styles.imageActions}>
            <View className={classnames(styles.imageBtn, isRecognizing && styles.disabled)} onClick={() => !isRecognizing && handleChooseImage('camera')}>
              <Text className={styles.btnIcon}>📸</Text>
              <Text className={styles.btnText}>拍照识别</Text>
            </View>
            <View className={classnames(styles.imageBtn, isRecognizing && styles.disabled)} onClick={() => !isRecognizing && handleChooseImage('album')}>
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
            <Text className={styles.colorPickerTitle}>选择颜色</Text>
            <View className={styles.colorPicker}>
              {themeColors.map((color) => (
                <View
                  key={color}
                  className={classnames(
                    styles.colorOption,
                    newThemeColor === color && styles.colorSelected
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewThemeColor(color)}
                >
                  {newThemeColor === color && <Text className={styles.colorCheck}>✓</Text>}
                </View>
              ))}
            </View>
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
