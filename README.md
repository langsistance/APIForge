# 🔨 APIForge

> 智能API捕获与工具生成平台 - 将任何API转化为可复用的智能工具

## 📋 项目简介

APIForge 是一个强大的 Electron 应用，帮助开发者：
- 🎯 **捕获API请求** - 自动拦截和记录网页中的所有API调用
- 🛠️ **生成工具** - 将API转换为可复用的工具
- 📚 **构建知识库** - 创建和管理API相关的知识库
- 🤖 **智能助手** - 通过AI助手智能调用工具和查询知识

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动应用
npm start

# 开发模式
npm run dev
```

## 🏗️ 项目架构

```
apiforge/
├── main/                # 主进程（Electron）
│   ├── index.js        # 主进程入口
│   ├── window-manager.js # 窗口管理
│   └── modules/        # 核心模块
│       ├── network-interceptor.js # 网络拦截
│       └── api-fetcher.js         # API响应获取
│
├── renderer/           # 渲染进程
│   ├── index.html     # 主页面
│   └── main.js        # 渲染进程入口
│
├── src/               # 业务逻辑
│   ├── core/         # 核心应用
│   ├── domains/      # 业务域
│   │   ├── api/     # API管理
│   │   ├── browser/ # 浏览器管理
│   │   ├── chat/    # 聊天管理
│   │   └── knowledge/ # 知识库管理
│   ├── services/     # 服务层
│   │   ├── auth-service.js         # 认证服务
│   │   ├── api-service.js          # API服务
│   │   ├── knowledge-service.js    # 知识库服务
│   │   └── websight-api-client.js  # 远程API客户端
│   └── shared/       # 共享模块
│       └── event-bus.js # 事件总线
│
└── assets/           # 静态资源
```

## 🔑 核心功能

### 1. API拦截与记录
- 智能识别API请求
- 自动过滤静态资源
- 保存请求和响应数据

### 2. 工具生成
- 从API自动生成工具
- 参数提取和类型推断
- 支持批量生成

### 3. 知识库管理
- 创建问答对
- 关联工具和知识
- 支持远程同步

### 4. 智能助手
- 自然语言查询
- 自动匹配工具
- 轮询机制获取结果

## 🔗 远程服务集成

APIForge 支持与远程服务器集成，提供：
- 工具和知识的云端存储
- 智能查询和工具推荐
- 异步任务处理

### API端点
- `POST /create_tool_and_knowledge` - 创建工具和知识
- `POST /find_knowledge_tool` - 查找相关工具
- `POST /query` - 发送查询请求
- `GET /query_tools` - 查询工具列表
- `GET /query_knowledge` - 查询知识库

## 🔐 认证系统

内置认证服务模块，支持：
- 用户登录/注册（预留接口）
- 会话管理
- 权限控制
- 当前使用固定用户ID：`11111111`

## 🛠️ 技术栈

- **Electron** - 跨平台桌面应用
- **Node.js** - 后端运行时
- **ES6 Modules** - 模块化
- **Event-Driven** - 事件驱动架构
- **Remote API** - 远程服务集成

## 📝 开发计划

- [ ] 完善登录系统
- [ ] 添加更多AI模型支持
- [ ] 支持更多API协议（GraphQL、WebSocket）
- [ ] 添加测试套件
- [ ] 优化UI/UX设计

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**APIForge** - 让API开发更智能、更高效！ 🚀