# WebSight 项目架构调整说明

## 📁 新的目录结构

```
websight/
├── main/                        # 主进程（Electron）
│   ├── index.js                # 主进程入口
│   ├── window-manager.js       # 窗口管理
│   ├── modules/                # 主进程模块
│   │   ├── network-interceptor.js  # 网络拦截
│   │   └── api-fetcher.js         # API响应获取
│   └── handlers/               # IPC处理器
│       └── ipc-handler.js     # IPC通信处理
│
├── renderer/                    # 渲染进程
│   ├── index.html              # 主HTML文件
│   ├── main.js                 # 渲染进程入口
│   ├── components/             # UI组件
│   └── styles/                 # 样式文件
│       └── main.css
│
├── src/                        # 业务逻辑
│   ├── core/                   # 核心应用
│   │   ├── app.js             # 原应用类
│   │   └── app-refactored.js  # 重构后的应用类
│   │
│   ├── domains/                # 业务域
│   │   ├── browser/           # 浏览器管理
│   │   ├── api/              # API管理
│   │   ├── knowledge/        # 知识库管理
│   │   └── chat/             # 聊天管理
│   │
│   ├── services/              # 服务层（新增）
│   │   ├── api-service.js    # API业务服务
│   │   └── knowledge-service.js # 知识库服务
│   │
│   ├── shared/                # 共享模块（新增）
│   │   └── event-bus.js      # 事件总线
│   │
│   ├── ui/                    # UI管理
│   │   └── ui-manager.js
│   │
│   └── utils/                 # 工具类
│       └── storage-util.js
│
├── assets/                     # 静态资源
├── package.json               # 项目配置（已更新入口）
└── PROJECT_STRUCTURE.md       # 架构说明（本文件）
```

## 🏗️ 架构改进

### 1. 主进程模块化
- **拆分巨大的main.js**：将1453行的主文件拆分为多个职责单一的模块
- **WindowManager**：专门负责窗口创建和管理
- **NetworkInterceptor**：处理所有网络拦截逻辑
- **APIFetcher**：负责获取和解析API响应
- **IPCHandler**：集中处理所有IPC通信

### 2. 服务层（Services）
- **APIService**：处理API相关的业务逻辑，包括存储、搜索、工具生成
- **KnowledgeService**：管理知识库，包括创建、搜索、导入导出

### 3. 事件驱动架构
- **EventBus**：全局事件总线，用于模块间解耦通信
- **预定义事件**：定义了系统中所有的事件类型
- **异步事件支持**：支持异步事件处理

### 4. 渲染进程分离
- **独立的渲染进程目录**：将前端代码与主进程代码分离
- **组件化结构**：为未来的UI组件化做准备

## 🔄 数据流

### 改进前：
```
Manager → 直接操作数据 → 存储
Manager ← 直接依赖 → Manager
```

### 改进后：
```
Manager → Service → 数据操作 → 存储
Manager → EventBus → Manager（解耦通信）
```

## 📈 优势

1. **可维护性提升**
   - 代码职责清晰，易于定位问题
   - 模块独立，便于单元测试

2. **可扩展性增强**
   - 新增功能只需添加新的服务或监听事件
   - 模块间低耦合，修改影响范围小

3. **性能优化**
   - 主进程代码精简，启动更快
   - 事件驱动避免了同步阻塞

4. **开发体验改善**
   - 清晰的目录结构
   - 统一的错误处理
   - 完善的日志系统

## 🚀 迁移指南

### 立即可用：
1. 运行 `npm start` 将使用新的主进程入口 `main/index.js`
2. 所有功能保持向后兼容

### 逐步迁移：
1. 将 `src/core/app.js` 的引用逐步迁移到 `app-refactored.js`
2. 使用事件总线替代直接的模块调用
3. 将业务逻辑从Manager迁移到Service层

## 📝 下一步计划

1. **完成UI组件化**
   - 将现有UI拆分为独立组件
   - 引入前端框架（React/Vue）

2. **添加测试**
   - 为Service层添加单元测试
   - 为主进程模块添加集成测试

3. **性能监控**
   - 添加性能指标收集
   - 实现内存使用优化

4. **插件系统**
   - 基于事件总线实现插件机制
   - 支持第三方扩展

## 🔧 开发规范

1. **新功能开发**：优先在Service层实现业务逻辑
2. **模块通信**：使用EventBus而非直接依赖
3. **错误处理**：统一通过SYSTEM_ERROR事件处理
4. **数据持久化**：通过Service层的统一接口

## 📚 相关文档

- [原架构说明](src/README.md)
- [API服务文档](src/services/api-service.js)
- [事件总线文档](src/shared/event-bus.js)