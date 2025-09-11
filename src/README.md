# WebSight 项目结构

## 📁 目录结构

```
src/
├── core/                    # 核心应用层
│   └── app.js              # 主应用类，协调各个模块
├── domains/                # 业务域模块
│   ├── browser/            # 浏览器相关功能
│   │   └── browser-manager.js
│   ├── api/               # API管理功能
│   │   └── api-manager.js
│   ├── knowledge/         # 知识库管理
│   │   └── knowledge-manager.js
│   └── chat/              # 聊天功能
│       └── chat-manager.js
├── ui/                    # 用户界面层
│   └── ui-manager.js      # UI组件和交互管理
├── utils/                 # 工具类
│   └── storage-util.js    # 本地存储管理
├── main.js               # 应用入口文件
└── README.md             # 项目结构说明
```

## 🏗️ 架构设计

### 分层架构

1. **入口层 (Entry Layer)**
   - `main.js`: 应用初始化和全局错误处理

2. **核心层 (Core Layer)**
   - `app.js`: 主应用类，负责协调各个域模块

3. **业务域层 (Domain Layer)**
   - `browser/`: 网页浏览和API拦截
   - `api/`: API管理和工具生成
   - `knowledge/`: 知识库创建和搜索
   - `chat/`: 智能聊天和查询处理

4. **UI层 (UI Layer)**
   - `ui-manager.js`: 通用UI组件和交互

5. **工具层 (Utils Layer)**
   - `storage-util.js`: 数据持久化

### 模块依赖关系

```
main.js
  └── app.js
      ├── ui-manager.js
      ├── storage-util.js
      ├── browser-manager.js
      ├── api-manager.js
      ├── knowledge-manager.js (依赖 api-manager)
      └── chat-manager.js (依赖 api-manager, knowledge-manager)
```

## 🔄 数据流

1. **API拦截流程**:
   ```
   BrowserManager → 拦截API → APIManager → 生成工具 → KnowledgeManager
   ```

2. **知识创建流程**:
   ```
   用户选择工具 → KnowledgeManager → 调用服务器API → 本地存储
   ```

3. **聊天查询流程**:
   ```
   用户提问 → ChatManager → 查找工具 → 调用API → 轮询结果 → 显示回答
   ```

## 🎯 设计原则

1. **单一职责**: 每个管理器只负责自己的业务域
2. **依赖注入**: 通过构造函数注入依赖，便于测试
3. **事件驱动**: 模块间通过事件通信，降低耦合
4. **数据一致性**: 统一的数据保存和加载机制
5. **错误处理**: 完善的错误处理和用户反馈

## 📝 扩展指南

### 添加新的业务域

1. 在 `src/domains/` 下创建新目录
2. 创建对应的管理器类
3. 在 `app.js` 中初始化和注册
4. 添加相应的UI元素和事件处理

### 添加新的工具类

1. 在 `src/utils/` 下创建新的工具文件
2. 导出相应的类或函数
3. 在需要的地方导入使用

### 修改数据结构

1. 更新 `storage-util.js` 中的默认数据结构
2. 添加数据迁移逻辑
3. 更新相关管理器的数据处理逻辑

## 🚀 开发建议

1. **保持模块独立**: 每个管理器应该可以独立测试和使用
2. **统一错误处理**: 使用 `ui-manager.js` 的通知系统显示错误
3. **异步操作**: 使用 async/await 处理异步操作
4. **数据验证**: 在保存和加载数据时进行验证
5. **性能优化**: 使用防抖和节流优化频繁操作

## 🔧 调试

- 全局对象 `window.WebSightApp` 提供对应用实例的访问
- 每个管理器都有详细的日志输出
- 使用浏览器开发者工具查看网络请求和控制台日志