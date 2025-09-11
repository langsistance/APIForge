/**
 * UI管理器 - 负责通用UI操作和组件
 */

export class UIManager {
  constructor() {
    this.notifications = [];
    this.modals = [];
  }

  init() {
    this.setupGlobalUI();
    console.log('✅ UIManager 初始化完成');
  }

  setupGlobalUI() {
    // 创建通知容器
    this.createNotificationContainer();
  }

  createNotificationContainer() {
    let container = document.querySelector('.notification-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'notification-container';
      document.body.appendChild(container);
    }
    this.notificationContainer = container;
  }

  showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    const id = Date.now() + Math.random();
    
    notification.className = `notification notification-${type}`;
    notification.setAttribute('data-id', id);
    
    // 图标映射
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <span class="notification-message">${message}</span>
        <span class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</span>
      </div>
    `;
    
    this.notificationContainer.appendChild(notification);
    
    // 添加显示动画
    setTimeout(() => notification.classList.add('show'), 100);
    
    // 自动移除
    if (duration > 0) {
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, duration);
    }
    
    // 存储到数组中
    this.notifications.push({ id, element: notification, type, message });
    
    console.log(`${type.toUpperCase()}: ${message}`);
  }

  createModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    modal.innerHTML = `
      <div class="modal-content">
        <!-- 内容将由调用者填充 -->
      </div>
    `;
    
    // 点击背景关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    // ESC键关闭
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
    
    // 清理事件监听器
    modal.addEventListener('remove', () => {
      document.removeEventListener('keydown', handleEsc);
    });
    
    this.modals.push(modal);
    return modal;
  }

  closeAllModals() {
    this.modals.forEach(modal => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    });
    this.modals = [];
  }

  clearAllNotifications() {
    this.notifications.forEach(notification => {
      if (notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
    });
    this.notifications = [];
  }

  // 加载状态管理
  showLoading(element, text = '加载中...') {
    if (!element) return;
    
    const originalContent = element.innerHTML;
    element.setAttribute('data-original-content', originalContent);
    
    element.innerHTML = `
      <div class="loading-state">
        <span class="loading-spinner"></span>
        ${text}
      </div>
    `;
    element.classList.add('loading');
  }

  hideLoading(element) {
    if (!element) return;
    
    const originalContent = element.getAttribute('data-original-content');
    if (originalContent) {
      element.innerHTML = originalContent;
      element.removeAttribute('data-original-content');
    }
    element.classList.remove('loading');
  }

  // 错误状态显示
  showError(element, message = '加载失败') {
    if (!element) return;
    
    const originalContent = element.innerHTML;
    element.setAttribute('data-original-content', originalContent);
    
    element.innerHTML = `
      <div class="error-state">
        ${message}
      </div>
    `;
    element.classList.add('error');
  }

  hideError(element) {
    if (!element) return;
    
    const originalContent = element.getAttribute('data-original-content');
    if (originalContent) {
      element.innerHTML = originalContent;
      element.removeAttribute('data-original-content');
    }
    element.classList.remove('error');
  }

  // 工具方法
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // 元素查找和操作
  $(selector) {
    return document.querySelector(selector);
  }

  $$(selector) {
    return document.querySelectorAll(selector);
  }

  addClass(element, className) {
    if (element && className) {
      element.classList.add(className);
    }
  }

  removeClass(element, className) {
    if (element && className) {
      element.classList.remove(className);
    }
  }

  toggleClass(element, className) {
    if (element && className) {
      element.classList.toggle(className);
    }
  }

  hasClass(element, className) {
    return element && className && element.classList.contains(className);
  }

  // 动画效果
  fadeIn(element, duration = 300) {
    if (!element) return;
    
    element.style.opacity = '0';
    element.style.display = 'block';
    
    let start = performance.now();
    
    const animate = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      
      element.style.opacity = progress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  fadeOut(element, duration = 300) {
    if (!element) return;
    
    let start = performance.now();
    const initialOpacity = parseFloat(getComputedStyle(element).opacity) || 1;
    
    const animate = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      
      element.style.opacity = initialOpacity * (1 - progress);
      
      if (progress >= 1) {
        element.style.display = 'none';
      } else {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  slideDown(element, duration = 300) {
    if (!element) return;
    
    element.style.height = '0px';
    element.style.overflow = 'hidden';
    element.style.display = 'block';
    
    const targetHeight = element.scrollHeight + 'px';
    let start = performance.now();
    
    const animate = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      
      element.style.height = parseInt(targetHeight) * progress + 'px';
      
      if (progress >= 1) {
        element.style.height = 'auto';
        element.style.overflow = 'visible';
      } else {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  slideUp(element, duration = 300) {
    if (!element) return;
    
    const initialHeight = element.offsetHeight;
    element.style.height = initialHeight + 'px';
    element.style.overflow = 'hidden';
    
    let start = performance.now();
    
    const animate = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      
      element.style.height = initialHeight * (1 - progress) + 'px';
      
      if (progress >= 1) {
        element.style.display = 'none';
        element.style.height = 'auto';
        element.style.overflow = 'visible';
      } else {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }
}