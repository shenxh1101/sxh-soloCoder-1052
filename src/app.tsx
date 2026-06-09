import React, { useEffect } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import { CardProvider } from '@/store/CardContext';
import './app.scss';

function App(props) {
  useEffect(() => {
    console.log('[App] 应用启动');
  }, []);

  useDidShow(() => {
    console.log('[App] 应用显示');
  });

  useDidHide(() => {
    console.log('[App] 应用隐藏');
  });

  return (
    <CardProvider>
      {props.children}
    </CardProvider>
  );
}

export default App;
