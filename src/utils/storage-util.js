/**
 * 存储工具类 - 负责本地数据存储和管理
 */

import { CONFIG } from './config.js';

export class StorageUtil {
  constructor() {
    this.storageKey = CONFIG.APP.STORAGE_KEY;
    this.version = CONFIG.APP.VERSION;
  }

  // 保存所有数据
  saveAll(data) {
    try {
      const dataWithMeta = {
        version: this.version,
        timestamp: new Date().toISOString(),
        data: data
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(dataWithMeta));
      console.log('数据保存成功:', Object.keys(data));
      return true;
    } catch (error) {
      console.error('保存数据失败:', error);
      return false;
    }
  }

  // 加载所有数据
  loadAll() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        console.log('没有找到本地数据，使用默认值');
        return this.getDefaultData();
      }
      
      const parsed = JSON.parse(stored);
      
      // 检查版本兼容性
      if (parsed.version !== this.version) {
        console.warn('数据版本不匹配，可能需要迁移');
        return this.migrateData(parsed);
      }
      
      console.log('数据加载成功:', Object.keys(parsed.data || {}));
      return parsed.data || this.getDefaultData();
    } catch (error) {
      console.error('加载数据失败:', error);
      return this.getDefaultData();
    }
  }

  // 保存特定键值
  save(key, value) {
    try {
      const allData = this.loadAll();
      allData[key] = value;
      return this.saveAll(allData);
    } catch (error) {
      console.error(`保存 ${key} 失败:`, error);
      return false;
    }
  }

  // 加载特定键值
  load(key, defaultValue = null) {
    try {
      const allData = this.loadAll();
      return allData[key] !== undefined ? allData[key] : defaultValue;
    } catch (error) {
      console.error(`加载 ${key} 失败:`, error);
      return defaultValue;
    }
  }

  // 删除特定键值
  remove(key) {
    try {
      const allData = this.loadAll();
      delete allData[key];
      return this.saveAll(allData);
    } catch (error) {
      console.error(`删除 ${key} 失败:`, error);
      return false;
    }
  }

  // 清空所有数据
  clear() {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('所有数据已清空');
      return true;
    } catch (error) {
      console.error('清空数据失败:', error);
      return false;
    }
  }

  // 获取数据大小
  getSize() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return 0;
      
      // 计算字节数（UTF-16编码，每个字符2字节）
      const sizeInBytes = stored.length * 2;
      const sizeInKB = (sizeInBytes / 1024).toFixed(2);
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
      
      return {
        bytes: sizeInBytes,
        kb: sizeInKB,
        mb: sizeInMB,
        formatted: sizeInBytes < 1024 ? 
          `${sizeInBytes} B` : 
          sizeInBytes < 1024 * 1024 ? 
            `${sizeInKB} KB` : 
            `${sizeInMB} MB`
      };
    } catch (error) {
      console.error('获取数据大小失败:', error);
      return { bytes: 0, kb: '0', mb: '0', formatted: '0 B' };
    }
  }

  // 检查存储空间
  checkStorageQuota() {
    try {
      // 尝试存储测试数据
      const testKey = 'websight_test_' + Date.now();
      const testData = 'x'.repeat(1024); // 1KB测试数据
      
      localStorage.setItem(testKey, testData);
      localStorage.removeItem(testKey);
      
      return true;
    } catch (error) {
      console.error('存储空间不足:', error);
      return false;
    }
  }

  // 导出数据
  exportData() {
    try {
      const data = this.loadAll();
      const exportData = {
        exported_at: new Date().toISOString(),
        version: this.version,
        app: CONFIG.APP.NAME,
        data: data
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `websight-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('数据导出成功');
      return true;
    } catch (error) {
      console.error('导出数据失败:', error);
      return false;
    }
  }

  // 导入数据
  importData(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            const importData = JSON.parse(e.target.result);
            
            // 验证数据格式
            if (!importData.data || !importData.app || importData.app !== CONFIG.APP.NAME) {
              throw new Error('无效的备份文件格式');
            }
            
            // 保存导入的数据
            if (this.saveAll(importData.data)) {
              console.log('数据导入成功');
              resolve(importData.data);
            } else {
              throw new Error('保存导入数据失败');
            }
          } catch (error) {
            console.error('解析导入数据失败:', error);
            reject(error);
          }
        };
        
        reader.onerror = () => {
          console.error('读取文件失败');
          reject(new Error('读取文件失败'));
        };
        
        reader.readAsText(file);
      } catch (error) {
        console.error('导入数据失败:', error);
        reject(error);
      }
    });
  }

  // 获取默认数据
  getDefaultData() {
    return {
      interceptedAPIs: [],
      generatedTools: [],
      knowledgeItems: [],
      chatHistory: [],
      userId: null,
      settings: {
        theme: 'light',
        autoSave: true,
        notifications: true
      }
    };
  }

  // 数据迁移
  migrateData(oldData) {
    console.log('开始数据迁移...');
    
    try {
      // 这里可以添加版本迁移逻辑
      const newData = this.getDefaultData();
      
      // 尝试迁移旧数据
      if (oldData.data) {
        Object.keys(newData).forEach(key => {
          if (oldData.data[key] !== undefined) {
            newData[key] = oldData.data[key];
          }
        });
      }
      
      // 保存迁移后的数据
      this.saveAll(newData);
      
      console.log('数据迁移完成');
      return newData;
    } catch (error) {
      console.error('数据迁移失败:', error);
      return this.getDefaultData();
    }
  }

  // 数据统计
  getStats() {
    try {
      const data = this.loadAll();
      const size = this.getSize();
      
      return {
        totalAPIs: (data.interceptedAPIs || []).length,
        totalTools: (data.generatedTools || []).length,
        totalKnowledge: (data.knowledgeItems || []).length,
        totalChatMessages: (data.chatHistory || []).length,
        storageSize: size,
        lastSaved: data.lastSaved || null,
        userId: data.userId || null
      };
    } catch (error) {
      console.error('获取数据统计失败:', error);
      return null;
    }
  }

  // 数据验证
  validateData(data) {
    try {
      const requiredKeys = ['interceptedAPIs', 'generatedTools', 'knowledgeItems', 'chatHistory'];
      
      for (const key of requiredKeys) {
        if (!data[key] || !Array.isArray(data[key])) {
          console.warn(`数据验证失败: ${key} 不是有效数组`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('数据验证失败:', error);
      return false;
    }
  }

  // 清理过期数据
  cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) { // 默认30天
    try {
      const data = this.loadAll();
      const cutoff = Date.now() - maxAge;
      let cleaned = false;
      
      // 清理过期的API记录
      if (data.interceptedAPIs) {
        const originalLength = data.interceptedAPIs.length;
        data.interceptedAPIs = data.interceptedAPIs.filter(api => {
          const apiTime = new Date(api.timestamp).getTime();
          return apiTime > cutoff;
        });
        if (data.interceptedAPIs.length < originalLength) {
          cleaned = true;
          console.log(`清理了 ${originalLength - data.interceptedAPIs.length} 个过期API记录`);
        }
      }
      
      // 清理过期的聊天记录
      if (data.chatHistory) {
        const originalLength = data.chatHistory.length;
        data.chatHistory = data.chatHistory.filter(msg => {
          const msgTime = new Date(msg.timestamp).getTime();
          return msgTime > cutoff;
        });
        if (data.chatHistory.length < originalLength) {
          cleaned = true;
          console.log(`清理了 ${originalLength - data.chatHistory.length} 个过期聊天记录`);
        }
      }
      
      if (cleaned) {
        this.saveAll(data);
        console.log('数据清理完成');
      }
      
      return cleaned;
    } catch (error) {
      console.error('数据清理失败:', error);
      return false;
    }
  }
}