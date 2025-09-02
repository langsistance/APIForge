const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

class APIKeyValidator {
  constructor() {
    // Google API key format: AIza[A-Za-z0-9_-]{35}
    this.googleKeyPattern = /^AIza[A-Za-z0-9_-]{35}$/;
  }

  // 验证API密钥格式
  validateKeyFormat(apiKey) {
    if (!apiKey) {
      return {
        valid: false,
        error: 'API密钥不能为空'
      };
    }

    if (!this.googleKeyPattern.test(apiKey)) {
      return {
        valid: false,
        error: 'API密钥格式无效。Google API密钥应以AIza开头'
      };
    }

    return {
      valid: true,
      message: 'API密钥格式正确'
    };
  }

  // 测试API密钥是否能够正常工作
  async testAPIKey(apiKey) {
    const formatCheck = this.validateKeyFormat(apiKey);
    if (!formatCheck.valid) {
      return {
        valid: false,
        error: formatCheck.error,
        suggestion: '请检查API密钥是否复制完整'
      };
    }

    try {
      console.log('🔑 Testing Google Gemini API key...');
      
      const testLLM = new ChatGoogleGenerativeAI({
        model: "gemini-1.5-flash",
        temperature: 0.1,
        apiKey: apiKey,
        maxOutputTokens: 50,
      });

      // 发送一个简单的测试消息
      const response = await testLLM.invoke([{
        type: 'human',
        content: 'Hello! Please respond with just "API key is working"'
      }]);

      if (response && response.content) {
        return {
          valid: true,
          message: 'API密钥测试成功',
          response: response.content
        };
      } else {
        return {
          valid: false,
          error: 'API返回了空响应',
          suggestion: '请检查API密钥的访问权限'
        };
      }

    } catch (error) {
      console.error('API key test failed:', error);
      
      let errorMessage = 'API密钥测试失败';
      let suggestion = '请检查密钥是否有效或已过期';

      if (error.status === 401) {
        errorMessage = '认证失败 - API密钥无效或已过期';
        suggestion = '请确保API密钥正确且账户有余额';
      } else if (error.status === 403) {
        errorMessage = '访问被拒绝 - API密钥没有足够权限';
        suggestion = '请检查API密钥的权限设置';
      } else if (error.status === 429) {
        errorMessage = '请求过于频繁';
        suggestion = '请稍后再试或检查API配额';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage = '网络连接失败';
        suggestion = '请检查网络连接或代理设置';
      }

      return {
        valid: false,
        error: errorMessage,
        suggestion: suggestion,
        details: error.message
      };
    }
  }

  // 获取API密钥的基本信息（不暴露完整密钥）
  getKeyInfo(apiKey) {
    if (!apiKey) return { masked: '[空]', prefix: null };
    
    const parts = apiKey.split('-');
    if (parts.length >= 4) {
      const prefix = parts.slice(0, 3).join('-');
      const suffix = parts[parts.length - 1];
      const masked = `${prefix}-****-${suffix.slice(-4)}`;
      
      return {
        masked,
        prefix,
        format: 'anthropic'
      };
    }
    
    return {
      masked: `${apiKey.slice(0, 8)}****${apiKey.slice(-4)}`,
      prefix: apiKey.slice(0, 12),
      format: 'unknown'
    };
  }

  // 提供API密钥设置建议
  getSetupInstructions() {
    return {
      title: 'Google Gemini API密钥设置说明',
      steps: [
        '1. 访问 https://aistudio.google.com/app/apikey',
        '2. 登录你的Google账户',
        '3. 创建新的API密钥',
        '4. 复制完整的API密钥（格式：AIza...）',
        '5. 确保API服务已启用',
        '6. 检查配额和计费设置'
      ],
      notes: [
        '• API密钥必须保密，不要在公开场所分享',
        '• 建议设置适当的使用限制和配额',
        '• 如果密钥泄露，请立即撤销并创建新密钥'
      ]
    };
  }
}

module.exports = { APIKeyValidator };