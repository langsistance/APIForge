const { BrowserWindow, Menu } = require('electron');
const path = require('path');

class WindowManager {
  constructor() {
    this.mainWindow = null;
  }

  createMainWindow() {
    console.log('Creating main window...');

    this.mainWindow = new BrowserWindow({
      width: 1600,
      height: 900,
      minWidth: 1200,
      minHeight: 700,
      show: true,
      title: 'APIForge - 智能API捕获与工具生成平台',
      icon: path.join(__dirname, '../assets/icon.png'),
      titleBarStyle: 'default',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
        allowRunningInsecureContent: true,
        webviewTag: true,
        partition: 'persist:webview',
        enableRemoteModule: true
      }
    });

    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // 设置Dock图标（macOS）
    if (process.platform === 'darwin') {
      const { app } = require('electron');
      const iconPath = path.join(__dirname, '../assets/icon.png');
      try {
        app.dock.setIcon(iconPath);
        console.log('✅ Dock icon set successfully');
      } catch (error) {
        console.log('❌ Failed to set dock icon:', error.message);
      }
    }

    // 启动时自动打开DevTools
    this.mainWindow.webContents.openDevTools();

    console.log('Window created successfully');
    return this.mainWindow;
  }

  createApplicationMenu() {
    const template = [
      {
        label: 'APIForge',
        submenu: [
          {
            label: 'About APIForge',
            role: 'about'
          },
          {
            type: 'separator'
          },
          {
            label: 'Services',
            role: 'services',
            submenu: []
          },
          {
            type: 'separator'
          },
          {
            label: 'Hide APIForge',
            accelerator: 'Command+H',
            role: 'hide'
          },
          {
            label: 'Hide Others',
            accelerator: 'Command+Alt+H',
            role: 'hideothers'
          },
          {
            label: 'Show All',
            role: 'unhide'
          },
          {
            type: 'separator'
          },
          {
            label: 'Quit APIForge',
            accelerator: 'Command+Q',
            click: () => {
              const { app } = require('electron');
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectall' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'actualSize' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'APIForge GitHub',
            click: () => {
              require('electron').shell.openExternal('https://github.com/apiforge');
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  getMainWindow() {
    return this.mainWindow;
  }

  destroy() {
    if (this.mainWindow) {
      this.mainWindow.destroy();
      this.mainWindow = null;
    }
  }
}

module.exports = WindowManager;