/**
 * 渲染进程主入口文件
 */

import app from '../src/core/app.js';

// 初始化应用
async function initRenderer() {
  console.log('🚀 Initializing renderer process...');
  
  try {
    // 应用实例已从app.js导入
    
    // 初始化应用
    await app.init();
    
    // 暴露到全局供调试
    window.APIForgeApp = app;
    
    // 监听窗口关闭事件，保存数据
    window.addEventListener('beforeunload', () => {
      app.saveLocalData();
    });
    
    // 定期保存数据（每30秒）
    setInterval(() => {
      app.saveLocalData();
    }, 30000);
    
    console.log('✅ Renderer process initialized');
  } catch (error) {
    console.error('❌ Failed to initialize renderer:', error);
  }
}

// DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRenderer);
} else {
  initRenderer();
}