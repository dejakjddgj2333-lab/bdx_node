require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

module.exports = {
  // 服务端口
  port: parseInt(process.env.PORT) || 3002,

  // 数据库
  database: {
    url: process.env.DATABASE_URL || 'mysql://root:123456@localhost:3306/beidouxing'
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB) || 0
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'beidouxing-ai-secret-key-2024',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'beidouxing-refresh-secret-key-2024'
  },

  // AI模型API配置
  ai: {
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
    },
    qwen: {
      apiKey: process.env.QWEN_API_KEY || '',
      baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com',
      realtimeModel: process.env.QWEN_REALTIME_MODEL || 'qwen3.5-omni-plus-realtime'
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY || '',
      baseUrl: process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com'
    },
    doubao: {
      apiKey: process.env.DOUBAO_API_KEY || '',
      baseUrl: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
    },
    moonshot: {
      apiKey: process.env.MOONSHOT_API_KEY || '',
      baseUrl: process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1'
    },
    qianfan: {
      apiKey: process.env.QIANFAN_API_KEY || '',
      baseUrl: process.env.QIANFAN_BASE_URL || 'https://qianfan.baidubce.com/v2'
    },
    zhipu: {
      apiKey: process.env.ZHIPU_API_KEY || '',
      baseUrl: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'
    },
    xinghuo: {
      apiKey: process.env.XINGHUO_API_KEY || '',
      baseUrl: process.env.XINGHUO_BASE_URL || 'https://spark-api-open.xf-yun.com/v1'
    },
    minimax: {
      apiKey: process.env.MINIMAX_API_KEY || '',
      baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1'
    }
  },

  // LiveKit 会议（音视频）
  // url 既可指向 LiveKit Cloud（wss://xxx.livekit.cloud），也可指向自建服务
  livekit: {
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
    tokenTtl: process.env.LIVEKIT_TOKEN_TTL || '2h'
  },

  // 文件上传
  upload: {
    maxSize: 50 * 1024 * 1024, // 50MB
    path: require('path').join(__dirname, '../../uploads'),
    // 公网可访问的服务地址，用于给外部 AI 模型访问图片；未配置时自动转 base64
    publicUrl: process.env.PUBLIC_URL || ''
  },

  // 阿里云号码认证（一键登录）
  aliyun: {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
  },

  // 邮件服务（SMTP）
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  },

  // 后台管理员
  admin: {
    password: process.env.ADMIN_PASSWORD || 'bdxadmin2024',
    jwtSecret: process.env.ADMIN_JWT_SECRET || 'beidouxing-admin-secret-key-2024',
    jwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '1d'
  }
}
