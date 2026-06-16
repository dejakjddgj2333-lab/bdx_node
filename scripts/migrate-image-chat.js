const db = require('../src/utils/db')

async function columnExists(table, column) {
  const rows = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`)
  return rows.length > 0
}

async function migrate() {
  try {
    if (!(await columnExists('ai_models', 'supports_vision'))) {
      await db.query(`ALTER TABLE ai_models ADD COLUMN supports_vision BOOLEAN DEFAULT FALSE`)
      console.log('[Migrate] ai_models.supports_vision 添加成功')
    } else {
      console.log('[Migrate] ai_models.supports_vision 已存在')
    }

    await db.query(`ALTER TABLE messages MODIFY COLUMN content_type VARCHAR(20) DEFAULT 'text'`)
    console.log('[Migrate] messages.content_type 确认成功')
  } catch (e) {
    console.error('[Migrate] 迁移失败:', e.message)
    process.exit(1)
  } finally {
    process.exit(0)
  }
}

migrate()
