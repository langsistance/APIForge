/**
 * UI更新器 - 负责根据语言变更更新界面文本
 */

class UIUpdater {
  constructor(i18nManager) {
    this.i18n = i18nManager;
    this.init();
  }

  /**
   * 初始化UI更新器
   */
  init() {
    // 监听语言变更
    this.i18n.addLanguageChangeListener((newLang, oldLang) => {
      console.log(`🌍 UI Updater: Language changed from ${oldLang} to ${newLang}`);
      this.updateAllTexts();
    });

    // 初始化时更新一次
    setTimeout(() => this.updateAllTexts(), 100);
  }

  /**
   * 更新所有带有i18n属性的文本
   */
  updateAllTexts() {
    // 更新文档标题
    this.updateDocumentTitle();

    // 更新所有带有data-i18n属性的元素
    this.updateTextElements();

    // 更新所有带有data-i18n-placeholder属性的元素
    this.updatePlaceholderElements();

    // 更新语言选择器的当前值
    this.updateLanguageSelector();

    console.log('🌍 UI texts updated successfully');
  }

  /**
   * 更新文档标题
   */
  updateDocumentTitle() {
    const titleElement = document.querySelector('title[data-i18n]');
    if (titleElement) {
      const key = titleElement.getAttribute('data-i18n');
      document.title = this.i18n.t(key);
    }
  }

  /**
   * 更新文本元素
   */
  updateTextElements() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        // 对于不同类型的元素，更新相应的文本内容
        if (element.tagName === 'INPUT' && (element.type === 'button' || element.type === 'submit')) {
          element.value = this.i18n.t(key);
        } else if (element.tagName === 'INPUT' && element.type === 'text') {
          // 对于文本输入框，不更新value，保持用户输入
        } else {
          element.textContent = this.i18n.t(key);
        }
      }
    });
  }

  /**
   * 更新占位符元素
   */
  updatePlaceholderElements() {
    const elements = document.querySelectorAll('[data-i18n-placeholder]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      if (key) {
        element.placeholder = this.i18n.t(key);
      }
    });
  }

  /**
   * 更新语言选择器的当前值
   */
  updateLanguageSelector() {
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
      languageSelect.value = this.i18n.getCurrentLanguage();
    }
  }

  /**
   * 动态更新特定元素的文本
   */
  updateElement(element, key, params = {}) {
    if (!element || !key) return;

    const translatedText = this.i18n.t(key, params);
    
    if (element.tagName === 'INPUT' && (element.type === 'button' || element.type === 'submit')) {
      element.value = translatedText;
    } else {
      element.textContent = translatedText;
    }
  }

  /**
   * 动态更新特定元素的占位符
   */
  updatePlaceholder(element, key, params = {}) {
    if (!element || !key) return;
    element.placeholder = this.i18n.t(key, params);
  }

  /**
   * 格式化并显示时间戳（考虑语言环境）
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return this.i18n.formatDateTime(date, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 获取翻译文本（快捷方法）
   */
  t(key, params = {}) {
    return this.i18n.t(key, params);
  }

  /**
   * 创建带翻译文本的元素
   */
  createElement(tag, i18nKey, className = '', params = {}) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (i18nKey) {
      element.textContent = this.i18n.t(i18nKey, params);
      element.setAttribute('data-i18n', i18nKey);
    }
    return element;
  }

  /**
   * 创建带翻译占位符的输入元素
   */
  createInputElement(type, i18nPlaceholderKey, className = '', params = {}) {
    const element = document.createElement('input');
    element.type = type;
    if (className) {
      element.className = className;
    }
    if (i18nPlaceholderKey) {
      element.placeholder = this.i18n.t(i18nPlaceholderKey, params);
      element.setAttribute('data-i18n-placeholder', i18nPlaceholderKey);
    }
    return element;
  }

  /**
   * 更新指定容器内的所有翻译文本（用于动态创建的弹窗等）
   */
  updateContainerTexts(container) {
    if (!container) return;

    // 更新容器内的文本元素
    const textElements = container.querySelectorAll('[data-i18n]');
    textElements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        if (element.tagName === 'INPUT' && (element.type === 'button' || element.type === 'submit')) {
          element.value = this.i18n.t(key);
        } else {
          element.textContent = this.i18n.t(key);
        }
      }
    });

    // 更新容器内的占位符元素
    const placeholderElements = container.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      if (key) {
        element.placeholder = this.i18n.t(key);
      }
    });
  }
}

export default UIUpdater;