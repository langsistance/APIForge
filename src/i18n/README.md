# 多语言功能使用说明

## 功能概述

APIForge 现已支持中文和英文两种语言，用户可以通过界面上的语言选择器随时切换语言。

## 文件结构

```
src/i18n/
├── i18n-manager.js     # 多语言管理器
├── locales/
│   ├── zh.js           # 中文翻译
│   └── en.js           # 英文翻译
└── README.md           # 说明文档
```

## 使用方法

### 1. 在HTML中使用

```html
<!-- 文本内容翻译 -->
<h3 data-i18n="knowledge.title">知识库管理</h3>

<!-- 占位符翻译 -->
<input type="text" data-i18n-placeholder="knowledge.search" placeholder="搜索知识...">

<!-- 按钮文本翻译 -->
<button data-i18n="common.save">保存</button>
```

### 2. 在JavaScript中使用

```javascript
// 导入多语言管理器
import i18nManager from './i18n/i18n-manager.js';

// 获取翻译文本
const title = i18nManager.t('knowledge.title');

// 带参数的翻译
const message = i18nManager.t('notifications.itemCreated', { count: 5 });

// 使用全局快捷方法
const text = $t('common.save');

// 切换语言
i18nManager.setLanguage('en');

// 监听语言变更
i18nManager.addLanguageChangeListener((newLang, oldLang) => {
  console.log(`语言从 ${oldLang} 切换到 ${newLang}`);
});
```

### 3. UI更新器自动更新

系统会自动监听语言切换事件，并更新所有带有 `data-i18n` 和 `data-i18n-placeholder` 属性的元素。

## 添加新的翻译

### 1. 在翻译文件中添加键值对

**zh.js**
```javascript
export default {
  newFeature: {
    title: '新功能',
    description: '这是一个新功能的描述'
  }
};
```

**en.js**
```javascript
export default {
  newFeature: {
    title: 'New Feature',
    description: 'This is a description of the new feature'
  }
};
```

### 2. 在HTML中使用

```html
<h4 data-i18n="newFeature.title">新功能</h4>
<p data-i18n="newFeature.description">这是一个新功能的描述</p>
```

## 语言切换控件

语言选择器位于知识库面板的头部，用户可以在中文和英文之间切换：

```html
<select id="languageSelect" class="language-select">
  <option value="zh">中文</option>
  <option value="en">English</option>
</select>
```

## 技术特性

- ✅ 支持嵌套键访问（如：`api.title`）
- ✅ 支持参数化翻译（如：`{count}` 占位符）
- ✅ 自动检测系统语言
- ✅ 本地存储语言偏好
- ✅ 实时UI更新
- ✅ 日期时间本地化格式
- ✅ 数字格式本地化
- ✅ 错误处理和fallback机制

## 扩展支持新语言

要添加新语言（如日语），请按以下步骤：

1. 创建新的翻译文件：`src/i18n/locales/ja.js`
2. 在 `i18n-manager.js` 中添加语言配置
3. 更新语言选择器的选项
4. 添加对应的CSS样式（如需要）

## 注意事项

- 翻译键不存在时会返回键名本身作为fallback
- 语言切换会立即生效，无需刷新页面
- 所有翻译文本都会被缓存，切换语言时不会重新加载
- 系统默认语言为中文，如果检测不到合适的语言会使用中文