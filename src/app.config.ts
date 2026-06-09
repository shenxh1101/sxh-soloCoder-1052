export default defineAppConfig({
  pages: [
    'pages/cardFlow/index',
    'pages/createCard/index',
    'pages/review/index',
    'pages/themes/index',
    'pages/stats/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '知识卡片',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f8fafc'
  },
  tabBar: {
    color: '#94a3b8',
    selectedColor: '#6366f1',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/cardFlow/index',
        text: '卡片流'
      },
      {
        pagePath: 'pages/createCard/index',
        text: '创建'
      },
      {
        pagePath: 'pages/review/index',
        text: '复习'
      },
      {
        pagePath: 'pages/themes/index',
        text: '主题'
      },
      {
        pagePath: 'pages/stats/index',
        text: '统计'
      }
    ]
  }
})
