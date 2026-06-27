const mysql = require('mysql2/promise')
const config = require('../config')
const logger = require('./logger')

const pool = mysql.createPool({
  host: '42.121.164.56',
  port: 3306,
  user: 'bdx',
  password: 'h3kZJk4mbrxSMJ5k',
  database: 'bdx',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
})

pool.on('connection', (connection) => {
  connection.execute('SET NAMES utf8mb4')
  logger.info('[DB] 数据库连接已建立')
})

pool.on('error', (err) => {
  logger.error('[DB] 数据库连接错误:', err)
})

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

async function queryRaw(sql, params) {
  const [rows] = await pool.query(sql, params)
  return rows
}

async function queryOne(sql, params) {
  const rows = await query(sql, params)
  return rows[0] || null
}

async function queryOneRaw(sql, params) {
  const rows = await queryRaw(sql, params)
  return rows[0] || null
}

async function insert(sql, params) {
  const [result] = await pool.execute(sql, params)
  return result.insertId
}

async function update(sql, params) {
  const [result] = await pool.execute(sql, params)
  return result.affectedRows
}

async function transaction(callback) {
  const connection = await pool.getConnection()
  await connection.beginTransaction()
  try {
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

module.exports = {
  pool,
  query,
  queryRaw,
  queryOne,
  queryOneRaw,
  insert,
  update,
  transaction
}
