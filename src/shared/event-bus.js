/**
 * 事件总线 - 用于模块间通信
 */

class EventBus {
  constructor() {
    this.events = new Map();
    this.onceEvents = new Map();
  }

  /**
   * 注册事件监听器
   */
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(callback);
    
    // 返回取消监听的函数
    return () => this.off(event, callback);
  }

  /**
   * 注册一次性事件监听器
   */
  once(event, callback) {
    if (!this.onceEvents.has(event)) {
      this.onceEvents.set(event, []);
    }
    this.onceEvents.get(event).push(callback);
    
    return () => this.offOnce(event, callback);
  }

  /**
   * 触发事件
   */
  emit(event, ...args) {
    const callbacks = this.events.get(event) || [];
    const onceCallbacks = this.onceEvents.get(event) || [];
    
    // 执行常规监听器
    callbacks.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
    
    // 执行一次性监听器
    onceCallbacks.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in once event listener for ${event}:`, error);
      }
    });
    
    // 清除一次性监听器
    this.onceEvents.delete(event);
  }

  /**
   * 异步触发事件
   */
  async emitAsync(event, ...args) {
    const callbacks = this.events.get(event) || [];
    const onceCallbacks = this.onceEvents.get(event) || [];
    
    const allCallbacks = [...callbacks, ...onceCallbacks];
    
    // 并行执行所有监听器
    const results = await Promise.allSettled(
      allCallbacks.map(callback => 
        Promise.resolve(callback(...args))
      )
    );
    
    // 清除一次性监听器
    this.onceEvents.delete(event);
    
    // 返回所有结果
    return results;
  }

  /**
   * 移除事件监听器
   */
  off(event, callback) {
    const callbacks = this.events.get(event);
    if (!callbacks) return;
    
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
    
    // 如果没有监听器了，删除事件
    if (callbacks.length === 0) {
      this.events.delete(event);
    }
  }

  /**
   * 移除一次性事件监听器
   */
  offOnce(event, callback) {
    const callbacks = this.onceEvents.get(event);
    if (!callbacks) return;
    
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
    
    if (callbacks.length === 0) {
      this.onceEvents.delete(event);
    }
  }

  /**
   * 移除所有监听器
   */
  removeAllListeners(event) {
    if (event) {
      this.events.delete(event);
      this.onceEvents.delete(event);
    } else {
      this.events.clear();
      this.onceEvents.clear();
    }
  }

  /**
   * 获取事件的监听器数量
   */
  listenerCount(event) {
    const regular = this.events.get(event)?.length || 0;
    const once = this.onceEvents.get(event)?.length || 0;
    return regular + once;
  }

  /**
   * 获取所有事件名称
   */
  eventNames() {
    const regularEvents = Array.from(this.events.keys());
    const onceEventNames = Array.from(this.onceEvents.keys());
    return [...new Set([...regularEvents, ...onceEventNames])];
  }
}

// 创建全局事件总线实例
const globalEventBus = new EventBus();

// 定义事件名称常量
export const Events = {
  // API相关事件
  API_INTERCEPTED: 'api:intercepted',
  API_RESPONSE_RECEIVED: 'api:response',
  API_TOOL_GENERATED: 'api:tool:generated',
  
  // 知识库相关事件
  KNOWLEDGE_CREATED: 'knowledge:created',
  KNOWLEDGE_UPDATED: 'knowledge:updated',
  KNOWLEDGE_DELETED: 'knowledge:deleted',
  KNOWLEDGE_SEARCH: 'knowledge:search',
  
  // 聊天相关事件
  CHAT_MESSAGE_SENT: 'chat:message:sent',
  CHAT_MESSAGE_RECEIVED: 'chat:message:received',
  CHAT_HISTORY_LOADED: 'chat:history:loaded',
  
  // 浏览器相关事件
  BROWSER_NAVIGATION: 'browser:navigation',
  BROWSER_PAGE_LOADED: 'browser:page:loaded',
  BROWSER_ERROR: 'browser:error',
  
  // UI相关事件
  UI_TAB_CHANGED: 'ui:tab:changed',
  UI_NOTIFICATION: 'ui:notification',
  UI_LOADING_START: 'ui:loading:start',
  UI_LOADING_END: 'ui:loading:end',
  
  // 系统相关事件
  SYSTEM_READY: 'system:ready',
  SYSTEM_ERROR: 'system:error',
  SYSTEM_SAVE: 'system:save',
  SYSTEM_RESTORE: 'system:restore'
};

export { EventBus, globalEventBus as default };