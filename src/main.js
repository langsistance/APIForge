/**
 * APIForge 主入口文件
 * 负责初始化应用程序
 */

import app from './core/app.js';
import { CONFIG } from './utils/config.js';

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🎯 APIForge 应用开始初始化...');
    
    // 初始化应用
    await app.init();
    
    console.log('🎉 APIForge 应用初始化完成！');
    
    // 添加全局错误处理
    window.addEventListener('error', (event) => {
      console.error('全局错误:', event.error);
      app.uiManager.showNotification('应用发生错误，请刷新页面重试', 'error', 5000);
    });
    
    // 添加未处理的Promise拒绝处理
    window.addEventListener('unhandledrejection', (event) => {
      console.error('未处理的Promise拒绝:', event.reason);
      app.uiManager.showNotification('网络请求失败，请检查连接', 'warning', 3000);
      event.preventDefault(); // 防止默认的控制台错误
    });
    
    // 添加页面可见性变化处理
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // 页面变为可见时，可以执行一些刷新操作
        console.log('页面重新变为可见');
      }
    });
    
    // 定期保存数据
    setInterval(() => {
      app.saveLocalData();
    }, CONFIG.UI.AUTO_SAVE_INTERVAL);
    
    // 在页面卸载前保存数据
    window.addEventListener('beforeunload', () => {
      app.saveLocalData();
    });
    
  } catch (error) {
    console.error('❌ 应用初始化失败:', error);
    
    // 显示错误信息
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #fff;
        border: 2px solid #dc3545;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      ">
        <h3 style="color: #dc3545; margin: 0 0 10px 0;">应用初始化失败</h3>
        <p style="margin: 0 0 15px 0; color: #666;">请刷新页面重试，如果问题持续存在，请检查控制台错误信息。</p>
        <button onclick="location.reload()" style="
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        ">刷新页面</button>
      </div>
    `;
    document.body.appendChild(errorDiv);
  }
});

// 导出应用实例供调试使用
window.app = app;  // 保持兼容性
window.APIForgeApp = app;