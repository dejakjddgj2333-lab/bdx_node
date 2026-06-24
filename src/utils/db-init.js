const db = require('./db')
const logger = require('./logger')
const mysql = require('mysql2/promise')

async function tableExists(table) {
  try {
    // SHOW TABLES LIKE 不支持 execute 参数化，使用 queryRaw + 转义
    const rows = await db.queryRaw(`SHOW TABLES LIKE ${mysql.escape(table)}`)
    return rows.length > 0
  } catch (e) {
    logger.error(`[DB-Init] 检查表 ${table} 失败:`, e.message || e)
    return false
  }
}

async function initPromptSuggestions() {
  if (await tableExists('prompt_suggestions')) {
    return
  }

  logger.info('[DB-Init] 创建 prompt_suggestions 表')
  await db.query(`
    CREATE TABLE prompt_suggestions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      title VARCHAR(200) NOT NULL COMMENT '显示标题',
      prompt TEXT NOT NULL COMMENT '点击后发送的完整提示词',
      is_active BOOLEAN DEFAULT TRUE,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_active_sort (is_active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await db.query(`
    INSERT INTO prompt_suggestions (title, prompt, sort_order) VALUES
    ('预测冠军队，抢万亿Token', '帮我预测一下今年世界杯/电竞比赛的冠军队伍，并给出理由。', 0),
    ('属于Z世代的"Brain rot"现象', '什么是"Brain rot"？它反映了Z世代怎样的网络文化现象？', 1),
    ('第一性原理：从本质出发的思考', '用第一性原理的方法，帮我分析一个复杂问题。', 2)
  `)
  logger.info('[DB-Init] prompt_suggestions 默认数据已插入')
}

async function columnExists(table, column) {
  try {
    const rows = await db.queryRaw(`SHOW COLUMNS FROM \`${table}\` LIKE ${mysql.escape(column)}`)
    return rows.length > 0
  } catch (e) {
    logger.error(`[DB-Init] 检查列 ${table}.${column} 失败:`, e.message || e)
    return false
  }
}

async function initAiModelsColumns() {
  const columns = ['supports_vision', 'supports_web_search']
  for (const column of columns) {
    if (await columnExists('ai_models', column)) {
      logger.info(`[DB-Init] ai_models.${column} 已存在`)
      continue
    }
    try {
      await db.query(`ALTER TABLE ai_models ADD COLUMN \`${column}\` BOOLEAN DEFAULT FALSE`)
      logger.info(`[DB-Init] ai_models.${column} 添加成功`)
    } catch (e) {
      logger.error(`[DB-Init] ai_models.${column} 创建失败:`, e.message)
    }
  }
}

async function initDocumentColumns() {
  const columns = [
    { name: 'chunk_count', ddl: 'INT DEFAULT 0' },
    { name: 'parse_error', ddl: 'TEXT DEFAULT NULL' },
    { name: 'parsed_at', ddl: 'TIMESTAMP NULL' }
  ]
  for (const col of columns) {
    if (await columnExists('documents', col.name)) {
      continue
    }
    try {
      await db.query(`ALTER TABLE documents ADD COLUMN \`${col.name}\` ${col.ddl}`)
      logger.info(`[DB-Init] documents.${col.name} 添加成功`)
    } catch (e) {
      logger.error(`[DB-Init] documents.${col.name} 创建失败:`, e.message)
    }
  }

  // file_type 需容纳较长 mime（如 docx 的 65 字符）
  try {
    const col = (await db.queryRaw("SHOW COLUMNS FROM documents LIKE 'file_type'"))[0]
    if (col && /varchar\((\d+)\)/i.test(col.Type)) {
      const len = parseInt(RegExp.$1, 10)
      if (len < 100) {
        await db.query('ALTER TABLE documents MODIFY COLUMN file_type VARCHAR(100)')
        logger.info('[DB-Init] documents.file_type 扩展为 VARCHAR(100)')
      }
    }
  } catch (e) {
    logger.error('[DB-Init] documents.file_type 调整失败:', e.message)
  }
}

async function initDocumentChunks() {
  if (await tableExists('document_chunks')) {
    return
  }
  logger.info('[DB-Init] 创建 document_chunks 表')
  try {
    await db.query(`
      CREATE TABLE document_chunks (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        document_id BIGINT NOT NULL,
        knowledge_base_id BIGINT NULL,
        chunk_index INT NOT NULL DEFAULT 0,
        content MEDIUMTEXT NOT NULL,
        token_count INT DEFAULT 0,
        embedding MEDIUMTEXT NULL COMMENT 'JSON 数组形式的向量',
        embedding_dim INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_document (document_id),
        INDEX idx_kb (knowledge_base_id),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    logger.info('[DB-Init] document_chunks 表创建成功')
  } catch (e) {
    logger.error('[DB-Init] document_chunks 表创建失败:', e.message)
  }
}

async function initImageModels() {
  if (await tableExists('image_models')) {
    return
  }
  logger.info('[DB-Init] 创建 image_models 表')
  try {
    await db.query(`
      CREATE TABLE image_models (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL COMMENT '显示名称',
        provider VARCHAR(20) NOT NULL COMMENT '厂商标识：doubao/openai/qwen 等',
        model_id VARCHAR(100) NOT NULL COMMENT '上游模型 ID',
        description TEXT COMMENT '描述',
        is_active BOOLEAN DEFAULT TRUE,
        is_default BOOLEAN DEFAULT FALSE,
        sort_order INT DEFAULT 0,
        supported_sizes JSON DEFAULT NULL COMMENT '支持尺寸数组',
        supported_styles JSON DEFAULT NULL COMMENT '支持风格数组',
        config JSON DEFAULT NULL COMMENT '额外配置',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_active (is_active),
        INDEX idx_sort (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    await db.query(`
      INSERT INTO image_models (name, provider, model_id, description, is_default, supported_sizes, supported_styles) VALUES
      ('豆包文生图', 'doubao', 'your-doubao-endpoint-id', '请替换为火山方舟控制台创建的 Endpoint ID', TRUE,
       '["1024x1024", "1536x1024", "1024x1536", "2048x2048"]',
       '["通用", "写实", "动漫", "油画"]')
    `)
    logger.info('[DB-Init] image_models 表创建成功')
  } catch (e) {
    logger.error('[DB-Init] image_models 表创建失败:', e.message)
  }
}

async function initSystemSettings() {
  if (await tableExists('system_settings')) {
    return
  }
  logger.info('[DB-Init] 创建 system_settings 表')
  try {
    await db.query(`
      CREATE TABLE system_settings (
        \`key\` VARCHAR(100) PRIMARY KEY,
        \`value\` TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    await db.query(`
      INSERT INTO system_settings (\`key\`, \`value\`, description) VALUES
      ('default_daily_image_quota', '10', '默认每日图片生成次数'),
      ('image_generation_enabled', 'true', '是否启用图片生成功能')
    `)
    logger.info('[DB-Init] system_settings 表创建成功')
  } catch (e) {
    logger.error('[DB-Init] system_settings 表创建失败:', e.message)
  }
}

async function initAuthColumns() {
  const columns = [
    { name: 'email_verified_at', ddl: 'TIMESTAMP NULL COMMENT "邮箱验证时间"' },
    { name: 'login_type', ddl: "VARCHAR(20) DEFAULT 'username' COMMENT '注册/登录方式：username/phone/email/apple'" },
    { name: 'apple_id', ddl: 'VARCHAR(100) UNIQUE COMMENT "Apple Sign In 用户标识"' }
  ]
  for (const col of columns) {
    if (await columnExists('users', col.name)) {
      continue
    }
    try {
      await db.query(`ALTER TABLE users ADD COLUMN \`${col.name}\` ${col.ddl}`)
      logger.info(`[DB-Init] users.${col.name} 添加成功`)
    } catch (e) {
      logger.error(`[DB-Init] users.${col.name} 添加失败:`, e.message)
    }
  }

  // password 允许为空，兼容一键登录/邮箱登录自动注册
  try {
    const col = (await db.queryRaw("SHOW COLUMNS FROM users LIKE 'password'"))[0]
    if (col && col.Null === 'NO') {
      await db.query('ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL')
      logger.info('[DB-Init] users.password 已改为可空')
    }
  } catch (e) {
    logger.error('[DB-Init] users.password 调整失败:', e.message)
  }

  // 补充 phone/email 索引
  const indexes = [
    { name: 'idx_phone', ddl: 'ADD INDEX idx_phone (phone)' },
    { name: 'idx_email', ddl: 'ADD INDEX idx_email (email)' }
  ]
  for (const idx of indexes) {
    try {
      const exists = await db.queryRaw(
        `SHOW INDEX FROM users WHERE Key_name = ${mysql.escape(idx.name)}`
      )
      if (exists.length === 0) {
        await db.query(`ALTER TABLE users ${idx.ddl}`)
        logger.info(`[DB-Init] users.${idx.name} 索引添加成功`)
      }
    } catch (e) {
      logger.error(`[DB-Init] users.${idx.name} 索引添加失败:`, e.message)
    }
  }
}

async function initUserImageQuotaColumns() {
  const columns = [
    { name: 'daily_image_quota', ddl: 'INT DEFAULT NULL COMMENT "每日图片生成限额"' },
    { name: 'used_image_quota', ddl: 'INT DEFAULT 0 COMMENT "今日已用图片生成次数"' },
    { name: 'image_quota_reset_at', ddl: 'TIMESTAMP NULL COMMENT "图片配额重置时间"' }
  ]
  for (const col of columns) {
    if (await columnExists('users', col.name)) {
      continue
    }
    try {
      await db.query(`ALTER TABLE users ADD COLUMN \`${col.name}\` ${col.ddl}`)
      logger.info(`[DB-Init] users.${col.name} 添加成功`)
    } catch (e) {
      logger.error(`[DB-Init] users.${col.name} 添加失败:`, e.message)
    }
  }
}

async function initMeetings() {
  if (!(await tableExists('meetings'))) {
    logger.info('[DB-Init] 创建 meetings 表')
    try {
      await db.query(`
        CREATE TABLE meetings (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          room_name VARCHAR(64) NOT NULL UNIQUE COMMENT 'LiveKit 房间名',
          title VARCHAR(200) NOT NULL DEFAULT '会议',
          host_user_id BIGINT NOT NULL COMMENT '主持人用户ID',
          status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'active/ended',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMP NULL,
          INDEX idx_host (host_user_id),
          INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      logger.info('[DB-Init] meetings 表创建成功')
    } catch (e) {
      logger.error('[DB-Init] meetings 表创建失败:', e.message)
    }
  }

  if (!(await tableExists('meeting_participants'))) {
    logger.info('[DB-Init] 创建 meeting_participants 表')
    try {
      await db.query(`
        CREATE TABLE meeting_participants (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          meeting_id BIGINT NOT NULL,
          user_id BIGINT NOT NULL,
          joined_at TIMESTAMP NULL,
          left_at TIMESTAMP NULL,
          UNIQUE KEY uniq_meeting_user (meeting_id, user_id),
          INDEX idx_meeting (meeting_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      logger.info('[DB-Init] meeting_participants 表创建成功')
    } catch (e) {
      logger.error('[DB-Init] meeting_participants 表创建失败:', e.message)
    }
  }
}

async function initPaintings() {
  if (await tableExists('paintings')) {
    return
  }
  logger.info('[DB-Init] 创建 paintings 表')
  try {
    await db.query(`
      CREATE TABLE paintings (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL COMMENT '用户ID',
        prompt TEXT NOT NULL COMMENT '正向提示词',
        negative_prompt TEXT DEFAULT NULL COMMENT '负面提示词',
        style VARCHAR(50) DEFAULT NULL COMMENT '风格',
        size VARCHAR(20) DEFAULT NULL COMMENT '尺寸',
        model VARCHAR(100) DEFAULT NULL COMMENT '使用的模型ID',
        image_url TEXT DEFAULT NULL COMMENT '生成的本地图片地址',
        status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/completed/failed',
        width INT DEFAULT 0,
        height INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_status (user_id, status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    logger.info('[DB-Init] paintings 表创建成功')
  } catch (e) {
    logger.error('[DB-Init] paintings 表创建失败:', e.message)
  }
}

async function init() {
  try {
    await initAuthColumns()
    await initPromptSuggestions()
    await initAiModelsColumns()
    await initUserImageQuotaColumns()
    await initImageModels()
    await initSystemSettings()
    await initPaintings()
    await initDocumentColumns()
    await initDocumentChunks()
    await initMeetings()
    logger.info('[DB-Init] 数据库初始化完成')
  } catch (e) {
    logger.error('[DB-Init] 数据库初始化失败:', e.message || e)
  }
}

module.exports = { init }
