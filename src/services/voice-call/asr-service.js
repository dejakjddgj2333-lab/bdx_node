/**
 * ASR 服务：通过调用官方 Python demo（asr_demo.py）识别语音。
 *
 * 流程：PCM16 16k → 加 WAV 头存临时文件 → python asr_demo.py → 解析 ASR_RESULT
 *
 * 用 Python demo 是因为它已验证能正确识别（bigmodel_nostream + wav），
 * Node 原生协议实现在收最终 isLast 包上有未定位差异。
 */
const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')
const logger = require('../../utils/logger')

const PYTHON = process.env.PYTHON_BIN || 'python3'
// __dirname = src/services/voice-call → 根目录是 ../../../
const DEMO = path.join(__dirname, '..', '..', '..', 'scripts', 'asr_demo.py')
const ASR_URL = 'wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_nostream'

/** 给裸 PCM16 16k mono 数据加 WAV 头 */
function pcmToWav(pcm) {
  const wav = Buffer.alloc(44 + pcm.length)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + pcm.length, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(16000, 24)
  wav.writeUInt32LE(32000, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(pcm.length, 40)
  pcm.copy(wav, 44)
  return wav
}

/**
 * 识别一段 PCM 音频
 * @param {Buffer} pcm PCM16 16k mono
 * @returns {Promise<string>} 识别出的文字
 */
function recognize(pcm) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `bdx_asr_${Date.now()}.wav`)
    const wav = pcmToWav(pcm)
    fs.writeFileSync(tmpFile, wav)

    logger.info(`[ASR-Service] 识别 ${pcm.length} 字节 PCM，调 demo`)
    const env = { ...process.env, PYTHONPATH: path.dirname(DEMO) }
    execFile(PYTHON, [DEMO, '--file', tmpFile, '--url', ASR_URL], {
      env,
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024
    }, (err, stdout, stderr) => {
      try { fs.unlinkSync(tmpFile) } catch (e) {}
      if (err) {
        logger.error('[ASR-Service] demo 执行失败:', err.message)
        // stderr 里可能有线索
        if (stderr) logger.error('[ASR-Service] stderr:', stderr.slice(0, 300))
        return reject(new Error('ASR 识别失败: ' + err.message))
      }
      const m = stdout.match(/ASR_RESULT:\s*(.*)/)
      if (!m) {
        logger.warn('[ASR-Service] 无 ASR_RESULT，stdout:', stdout.slice(0, 200))
        return resolve('')
      }
      let text = ''
      try { text = JSON.parse(m[1].trim()) } catch (e) { text = m[1].trim() }
      logger.info(`[ASR-Service] 识别结果: "${text}"`)
      resolve(text)
    })
  })
}

module.exports = { recognize, pcmToWav }
