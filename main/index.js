const { app, BrowserWindow } = require('electron');
const path = require('path');
const WindowManager = require('./window-manager');
const NetworkInterceptor = require('./modules/network-interceptor');
const APIFetcher = require('./modules/api-fetcher');
const IPCHandler = require('./handlers/ipc-handler');

// 实例化管理器
const windowManager = new WindowManager();
const networkInterceptor = new NetworkInterceptor();
const apiFetcher = new APIFetcher();
const ipcHandler = new IPCHandler(networkInterceptor, apiFetcher);

// 应用初始化
function initializeApp() {
  console.log('🚀 APIForge App 启动中...');
  
  // 设置应用信息
  app.setName('APIForge');
  app.setVersion('1.0.0');
  
  // 设置About面板信息（macOS）
  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({
      applicationName: 'APIForge',
      applicationVersion: '1.0.0',
      version: '1.0.0',
      credits: '智能API捕获与工具生成平台',
      authors: ['APIForge Team'],
      website: 'https://github.com/apiforge',
      iconPath: path.join(__dirname, '../assets/icon.png')
    });
  }
  
  // 创建应用菜单
  windowManager.createApplicationMenu();
  
  // 创建主窗口
  const mainWindow = windowManager.createMainWindow();
  
  // 设置网络拦截器的主窗口引用
  networkInterceptor.setMainWindow(mainWindow);
  
  // 启动网络拦截
  networkInterceptor.setupInterception();
  
  // 注册IPC处理器
  ipcHandler.registerHandlers();
  
  console.log('✅ APIForge App 启动完成');
}

// 应用事件处理
app.whenReady().then(() => {
  console.log('App ready, initializing...');
  initializeApp();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const mainWindow = windowManager.createMainWindow();
    networkInterceptor.setMainWindow(mainWindow);
  }
});

// 导出实例供其他模块使用
module.exports = {
  windowManager,
  networkInterceptor,
  apiFetcher,
  ipcHandler
};