// src/services/configService.ts

export interface AIConfig {
    defaultModel: string;
    defaultBaseUrl: string;
    clientToken: string; // 🔴 关键修复：补齐跟 scheduleEngine 契约对接的授权令牌字段
    status: string;
    notice: string;
  }
  
  /**
   * 确保这里有 export 关键字，并且名字与 scheduleEngine 里的调用完全对齐
   */
  export async function fetchRemoteAIConfig(): Promise<AIConfig> {
    try {
      // 模拟云端下发最新大模型配置（开发阶段兜底数据）
      // 未来上线时，可将此处的静态对象改为真实的云端接口请求：
      // const res = await fetch('你的线上安全网关地址'); return await res.json();
      return {
        defaultModel: "deepseek-chat", // 🎯 修正：保持与默认提供商对齐，或使用线上网关支持的代号
        defaultBaseUrl: "https://api.deepseek.com/v1", // 指向云端安全代理中转网关
        clientToken: "sk_cloud_placeholder_token_abc123", // 🔴 关键修复：提供安全的下发凭证占位符
        status: "healthy",
        notice: "当前由云端实时同步的先进 AI 提供运筹学与膳食中医学算力支撑"
      };
    } catch (error) {
      console.error("[ConfigService] 获取远程配置失败，激活安全备用通道:", error);
      // 网络异常时的本地安全防崩溃兜底
      return {
        defaultModel: "deepseek-chat",
        defaultBaseUrl: "https://api.deepseek.com/v1",
        clientToken: "", // 异常时置空，由引擎层做进一步降级
        status: "degraded",
        notice: "本地安全备ing用通道已激活"
      };
    }
  }