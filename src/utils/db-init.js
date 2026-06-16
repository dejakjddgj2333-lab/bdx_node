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

async function init() {
  try {
    await initPromptSuggestions()
    await initAiModelsColumns()
    logger.info('[DB-Init] 数据库初始化完成')
  } catch (e) {
    logger.error('[DB-Init] 数据库初始化失败:', e.message || e)
  }
}

module.exports = { init }
