const http = require("http");
const url = require("url");

// 模拟数据存储
let tools = [];
let knowledge = [];
let nextId = 1;

// CORS头设置
function setCORSHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// 创建工具和知识的API
function createToolAndKnowledge(req, res, data) {
  console.log("📦 收到创建工具和知识请求:", data);

  try {
    // 创建工具
    const tool = {
      id: nextId++,
      userId: data.tool_userId,
      title: data.tool_title,
      description: data.tool_description,
      url: data.tool_url,
      method: "GET", // 从URL推断方法
      push: data.tool_push,
      public: data.tool_public,
      timeout: data.tool_timeout,
      params: data.tool_params,
      createdAt: new Date().toISOString(),
    };

    // 创建知识
    const knowledgeItem = {
      id: nextId++,
      userId: data.knowledge_userId,
      question: data.knowledge_question,
      description: data.knowledge_description,
      answer: data.knowledge_answer,
      public: data.knowledge_public,
      embeddingId: data.knowledge_embeddingId,
      modelName: data.knowledge_model_name,
      params: data.knowledge_params,
      toolId: tool.id,
      createdAt: new Date().toISOString(),
    };

    tools.push(tool);
    knowledge.push(knowledgeItem);

    console.log("✅ 工具创建成功:", tool.title);
    console.log("✅ 知识创建成功:", knowledgeItem.question);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        message: "工具和知识创建成功",
        tool: tool,
        knowledge: knowledgeItem,
      })
    );
  } catch (error) {
    console.error("❌ 创建失败:", error);
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: false,
        message: "创建失败: " + error.message,
      })
    );
  }
}

// 查找知识和工具的API
function findKnowledgeTool(req, res, data) {
  console.log("🔍 收到查找请求:", data.question);

  try {
    const query = data.question.toLowerCase();
    const userId = data.userId;
    const topK = data.top_k || 3;
    const threshold = 0.1;

    // 简单的相似度匹配（实际应该使用向量相似度）
    const matchedItems = [];

    // 搜索知识库
    knowledge.forEach((item) => {
      if (item.userId === userId || item.public) {
        let score = 0;
        const question = item.question.toLowerCase();
        const description = item.description.toLowerCase();
        const answer = item.answer.toLowerCase();

        // 简单的关键词匹配评分
        if (
          question.includes(query) ||
          query.includes(question.substring(0, 10))
        )
          score += 0.9;
        if (description.includes(query)) score += 0.6;
        if (answer.includes(query)) score += 0.4;

        // 检查单词匹配
        const queryWords = query.split(" ");
        queryWords.forEach((word) => {
          if (word.length > 2) {
            if (question.includes(word)) score += 0.3;
            if (description.includes(word)) score += 0.2;
            if (answer.includes(word)) score += 0.1;
          }
        });

        if (score >= threshold) {
          // 找到对应的工具
          const relatedTool = tools.find((t) => t.id === item.toolId);
          matchedItems.push({
            knowledge: item,
            tool: relatedTool,
            score: score,
          });
        }
      }
    });

    // 按分数排序并限制数量
    const sortedItems = matchedItems
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const response = {
      success: true,
      total: sortedItems.length,
      tools: sortedItems.map((item) => ({
        id: item.tool ? item.tool.id : item.knowledge.id,
        title: item.tool ? item.tool.title : item.knowledge.question,
        description: item.tool
          ? item.tool.description
          : item.knowledge.description,
        url: item.tool ? item.tool.url : "",
        method: item.tool ? item.tool.method : "GET",
        params: item.tool ? item.tool.params : "{}",
        knowledge: {
          question: item.knowledge.question,
          answer: item.knowledge.answer,
          description: item.knowledge.description,
        },
        score: item.score,
      })),
      query: data.question,
    };

    console.log(`✅ 找到 ${response.total} 个相关工具`);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
  } catch (error) {
    console.error("❌ 查找失败:", error);
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: false,
        message: "查找失败: " + error.message,
      })
    );
  }
}

// 获取所有工具和知识的API（用于调试）
function getAllData(req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      tools: tools,
      knowledge: knowledge,
      total_tools: tools.length,
      total_knowledge: knowledge.length,
    })
  );
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  setCORSHeaders(res);

  // 处理OPTIONS预检请求
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`📡 ${req.method} ${pathname}`);

  if (req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(body);

        if (pathname === "/create_tool_and_knowledge") {
          createToolAndKnowledge(req, res, data);
        } else if (pathname === "/find_knowledge_tool") {
          findKnowledgeTool(req, res, data);
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "API endpoint not found" }));
        }
      } catch (error) {
        console.error("❌ 解析请求体失败:", error);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
  } else if (req.method === "GET") {
    if (pathname === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "running",
          message: "模拟API服务正在运行",
          endpoints: [
            "POST /create_tool_and_knowledge",
            "POST /find_knowledge_tool",
            "GET /data",
            "GET /status",
          ],
        })
      );
    } else if (pathname === "/data") {
      getAllData(req, res);
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Endpoint not found" }));
    }
  } else {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
  }
});

const PORT = 7777;
server.listen(PORT, () => {
  console.log(`🚀 模拟API服务已启动: http://localhost:${PORT}`);
  console.log(`📋 可用的API端点:`);
  console.log(`   POST /create_tool_and_knowledge - 创建工具和知识`);
  console.log(`   POST /find_knowledge_tool - 查找知识和工具`);
  console.log(`   GET /data - 获取所有数据（调试用）`);
  console.log(`   GET /status - 服务状态`);
});

// 优雅关闭
process.on("SIGINT", () => {
  console.log("\n🛑 正在关闭API服务...");
  server.close(() => {
    console.log("✅ API服务已关闭");
    process.exit(0);
  });
});
