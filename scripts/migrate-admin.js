const db = require('../src/utils/db')
const logger = require('../src/utils/logger')

const statements = [
  `CREATE TABLE IF NOT EXISTS knowledge_bases (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `ALTER TABLE knowledge_bases ADD COLUMN sort_order INT DEFAULT 0`,

  `ALTER TABLE documents ADD COLUMN knowledge_base_id BIGINT NULL AFTER user_id`,
  `ALTER TABLE documents ADD COLUMN is_public BOOLEAN DEFAULT FALSE AFTER parse_status`,
  `ALTER TABLE documents ADD COLUMN metadata JSON DEFAULT NULL AFTER parse_result`,
  `ALTER TABLE documents ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE documents ADD INDEX idx_kb (knowledge_base_id)`,

  `CREATE TABLE IF NOT EXISTS model_providers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    provider VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_provider (provider),
    INDEX idx_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `ALTER TABLE ai_models ADD COLUMN sort_order INT DEFAULT 0 AFTER max_tokens`,
  `ALTER TABLE ai_models ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,

  `CREATE TABLE IF NOT EXISTS admin_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    action VARCHAR(50) NOT NULL,
    target_table VARCHAR(50),
    target_id BIGINT,
    detail JSON,
    ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS voice_providers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    provider VARCHAR(20) NOT NULL UNIQUE COMMENT '厂商标识: openai/gemini/doubao/qwen',
    name VARCHAR(50) NOT NULL COMMENT '显示名称',
    api_key VARCHAR(500) NOT NULL COMMENT '上游 API Key',
    base_url VARCHAR(500) NOT NULL COMMENT '上游 Base URL / WebSocket 域名',
    realtime_model VARCHAR(100) DEFAULT NULL COMMENT '实时模型 ID',
    default_voice VARCHAR(50) DEFAULT NULL COMMENT '默认音色',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    is_current BOOLEAN DEFAULT FALSE COMMENT '是否为当前 App 使用的厂商',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_provider (provider),
    INDEX idx_active (is_active),
    INDEX idx_current (is_current)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `INSERT INTO voice_providers (provider, name, api_key, base_url, realtime_model, default_voice, is_active, is_current, sort_order)
   VALUES ('qwen', '阿里百炼实时多模态', '', 'wss://dashscope.aliyuncs.com', 'qwen3.5-omni-plus-realtime', 'zhiyan', TRUE, TRUE, 0)
   ON DUPLICATE KEY UPDATE name = name`
]

const ignoreErrnos = [1060, 1061, 1091]

async function migrate() {
  for (const sql of statements) {
    try {
      await db.query(sql)
      logger.info(`[Migrate] 成功: ${sql.split('\n')[0].trim()}`)
    } catch (err) {
      if (ignoreErrnos.includes(err.errno)) {
        logger.info(`[Migrate] 已存在，跳过: ${sql.split('\n')[0].trim()}`)
      } else {
        logger.error(`[Migrate] 失败: ${sql.split('\n')[0].trim()}`, err.message)
        process.exit(1)
      }
    }
  }
  logger.info('[Migrate] 后台管理相关表迁移完成')
  process.exit(0)
}

migrate()
