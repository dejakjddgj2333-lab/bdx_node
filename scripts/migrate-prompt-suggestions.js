const db = require('../src/utils/db')

async function tableExists(table) {
  const rows = await db.query(`SHOW TABLES LIKE '${table}'`)
  return rows.length > 0
}

async function migrate() {
  try {
    if (!(await tableExists('prompt_suggestions'))) {
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
      console.log('[Migrate] prompt_suggestions 表创建成功')

      await db.query(`
        INSERT INTO prompt_suggestions (title, prompt, sort_order) VALUES
        ('预测冠军队，抢万亿Token', '帮我预测一下今年世界杯/电竞比赛的冠军队伍，并给出理由。', 0),
        ('属于Z世代的"Brain rot"现象', '什么是"Brain rot"？它反映了Z世代怎样的网络文化现象？', 1),
        ('第一性原理：从本质出发的思考', '用第一性原理的方法，帮我分析一个复杂问题。', 2)
      `)
      console.log('[Migrate] prompt_suggestions 默认数据插入成功')
    } else {
      console.log('[Migrate] prompt_suggestions 表已存在')
    }
  } catch (e) {
    console.error('[Migrate] 迁移失败:', e.message)
    process.exit(1)
  } finally {
    process.exit(0)
  }
}

migrate()
