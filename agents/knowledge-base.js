const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class KnowledgeBase {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'data', 'knowledge.db');
    this.db = null;
    this.isInitialized = false;
    this.initPromise = this.init();
  }

  // 初始化数据库
  async init() {
    if (this.isInitialized) return;
    
    return new Promise((resolve, reject) => {
      // 确保数据目录存在
      const fs = require('fs');
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }
        
        console.log('Connected to the SQLite database.');
        this.createTables()
          .then(() => {
            this.isInitialized = true;
            resolve();
          })
          .catch(reject);
      });
    });
  }

  // 确保数据库已初始化
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initPromise;
    }
  }

  // 创建数据表
  async createTables() {
    return new Promise((resolve, reject) => {
      const createTablesSQL = `
        CREATE TABLE IF NOT EXISTS api_docs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          purpose TEXT,
          method TEXT,
          url TEXT,
          parameters TEXT, -- JSON string
          response_info TEXT, -- JSON string
          examples TEXT, -- JSON string
          usage TEXT,
          domain TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          call_count INTEGER DEFAULT 0,
          last_called DATETIME
        );

        CREATE TABLE IF NOT EXISTS api_calls (
          id TEXT PRIMARY KEY,
          api_id TEXT,
          request_data TEXT, -- JSON string
          response_data TEXT, -- JSON string
          status_code INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          success BOOLEAN DEFAULT 1,
          error_message TEXT,
          FOREIGN KEY (api_id) REFERENCES api_docs (id)
        );

        CREATE INDEX IF NOT EXISTS idx_api_docs_category ON api_docs(category);
        CREATE INDEX IF NOT EXISTS idx_api_docs_domain ON api_docs(domain);
        CREATE INDEX IF NOT EXISTS idx_api_docs_method_url ON api_docs(method, url);
        CREATE INDEX IF NOT EXISTS idx_api_calls_api_id ON api_calls(api_id);
        CREATE INDEX IF NOT EXISTS idx_api_calls_timestamp ON api_calls(timestamp);
      `;

      this.db.exec(createTablesSQL, (err) => {
        if (err) {
          console.error('Error creating tables:', err);
          reject(err);
        } else {
          console.log('Database tables created/verified successfully.');
          resolve();
        }
      });
    });
  }

  // 保存API文档
  async saveAPIDoc(analysis, originalApiData) {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const domain = this.extractDomain(originalApiData.url);
      
      const sql = `
        INSERT OR REPLACE INTO api_docs (
          id, name, description, category, purpose, method, url,
          parameters, response_info, examples, usage, domain
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        id,
        analysis.name,
        analysis.description,
        analysis.category,
        analysis.purpose,
        originalApiData.method,
        originalApiData.url,
        JSON.stringify(analysis.parameters),
        JSON.stringify(analysis.response),
        JSON.stringify(analysis.examples),
        analysis.usage,
        domain
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Error saving API doc:', err);
          reject(err);
        } else {
          console.log(`API doc saved with ID: ${id}`);
          resolve({ id, ...analysis, method: originalApiData.method, url: originalApiData.url, domain });
        }
      });
    });
  }

  // 记录API调用
  async recordAPICall(apiId, requestData, responseData, statusCode, success = true, errorMessage = null) {
    return new Promise((resolve, reject) => {
      const callId = uuidv4();
      
      const sql = `
        INSERT INTO api_calls (
          id, api_id, request_data, response_data, status_code, success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        callId,
        apiId,
        JSON.stringify(requestData),
        JSON.stringify(responseData),
        statusCode,
        success,
        errorMessage
      ];

      this.db.run(sql, params, (err) => {
        if (err) {
          console.error('Error recording API call:', err);
          reject(err);
        } else {
          // 更新API文档的调用统计
          this.updateAPICallStats(apiId);
          resolve(callId);
        }
      });
    });
  }

  // 更新API调用统计
  async updateAPICallStats(apiId) {
    const updateSQL = `
      UPDATE api_docs 
      SET call_count = call_count + 1, 
          last_called = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    this.db.run(updateSQL, [apiId], (err) => {
      if (err) {
        console.error('Error updating API call stats:', err);
      }
    });
  }

  // 搜索API文档
  async searchAPIs(query, limit = 10) {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM api_docs 
        WHERE name LIKE ? OR description LIKE ? OR category LIKE ? OR purpose LIKE ?
        ORDER BY call_count DESC, updated_at DESC
        LIMIT ?
      `;

      const searchTerm = `%${query}%`;
      const params = [searchTerm, searchTerm, searchTerm, searchTerm, limit];

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Error searching APIs:', err);
          reject(err);
        } else {
          const results = rows.map(row => ({
            ...row,
            parameters: JSON.parse(row.parameters || '{}'),
            response_info: JSON.parse(row.response_info || '{}'),
            examples: JSON.parse(row.examples || '{}')
          }));
          resolve(results);
        }
      });
    });
  }

  // 根据分类获取API
  async getAPIsByCategory(category, limit = 10) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM api_docs 
        WHERE category = ?
        ORDER BY call_count DESC, updated_at DESC
        LIMIT ?
      `;

      this.db.all(sql, [category, limit], (err, rows) => {
        if (err) {
          console.error('Error getting APIs by category:', err);
          reject(err);
        } else {
          const results = rows.map(row => ({
            ...row,
            parameters: JSON.parse(row.parameters || '{}'),
            response_info: JSON.parse(row.response_info || '{}'),
            examples: JSON.parse(row.examples || '{}')
          }));
          resolve(results);
        }
      });
    });
  }

  // 获取热门API
  async getPopularAPIs(limit = 10) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM api_docs 
        ORDER BY call_count DESC, updated_at DESC
        LIMIT ?
      `;

      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          console.error('Error getting popular APIs:', err);
          reject(err);
        } else {
          const results = rows.map(row => ({
            ...row,
            parameters: JSON.parse(row.parameters || '{}'),
            response_info: JSON.parse(row.response_info || '{}'),
            examples: JSON.parse(row.examples || '{}')
          }));
          resolve(results);
        }
      });
    });
  }

  // 根据ID获取API文档
  async getAPIById(apiId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM api_docs WHERE id = ?`;

      this.db.get(sql, [apiId], (err, row) => {
        if (err) {
          console.error('Error getting API by ID:', err);
          reject(err);
        } else if (row) {
          const result = {
            ...row,
            parameters: JSON.parse(row.parameters || '{}'),
            response_info: JSON.parse(row.response_info || '{}'),
            examples: JSON.parse(row.examples || '{}')
          };
          resolve(result);
        } else {
          resolve(null);
        }
      });
    });
  }

  // 根据URL和方法查找API
  async findAPIByUrlAndMethod(url, method) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM api_docs WHERE url = ? AND method = ?`;

      this.db.get(sql, [url, method], (err, row) => {
        if (err) {
          console.error('Error finding API by URL and method:', err);
          reject(err);
        } else if (row) {
          const result = {
            ...row,
            parameters: JSON.parse(row.parameters || '{}'),
            response_info: JSON.parse(row.response_info || '{}'),
            examples: JSON.parse(row.examples || '{}')
          };
          resolve(result);
        } else {
          resolve(null);
        }
      });
    });
  }

  // 获取统计信息
  async getStats() {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_apis,
          COUNT(DISTINCT category) as categories,
          COUNT(DISTINCT domain) as domains,
          SUM(call_count) as total_calls,
          AVG(call_count) as avg_calls_per_api
        FROM api_docs
      `;

      this.db.get(sql, [], (err, row) => {
        if (err) {
          console.error('Error getting stats:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // 提取域名
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return 'unknown';
    }
  }

  // 关闭数据库连接
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed.');
        }
      });
    }
  }
}

module.exports = { KnowledgeBase };