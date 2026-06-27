require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const fs = require('fs')
const { v4: uuid } = require('uuid')
const WebSocket = require('ws')
const zlib = require('zlib')
const { MsgType, Flag, Serialization, Compression, marshal, parseMessage, jsonBuf } = require('../src/services/voice-call/plan-protocol')

;(async () => {
  const pcm = fs.readFileSync(require('path').join(__dirname, '../tmp_voice_diag.pcm'))
  const ws = new WebSocket('wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_async', {
    headers: {
      'X-Api-Key': process.env.ARK_API_KEY,
      'X-Api-Resource-Id': 'volc.seedasr.sauc.duration',
      'X-Api-Request-Id': uuid(),
      'X-Api-Connect-Id': uuid(),
      'X-Api-Sequence': '-1'
    }
  })
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej) })
  ws.on('message', d => {
    const buf = Buffer.from(d)
    const mt = buf[1] >> 4
    const fl = buf[1] & 0xf
    const m = parseMessage(d)
    console.log('msgType=' + mt + ' flags=' + fl.toString(2).padStart(4, '0') + ' isLast=' + m.isLast + ' seq=' + m.sequence + ': ' + m.payload.toString('utf8').slice(0, 400))
  })
  const payload = { user: { uid: 'bdx' }, audio: { format: 'pcm', codec: 'raw', rate: 16000, bits: 16, channel: 1 }, request: { model_name: 'bigmodel', enable_itn: true, enable_punc: true, show_utterances: true, enable_nonstream: false } }
  let seq = 1
  ws.send(marshal({ type: MsgType.FullClientRequest, flag: Flag.PositiveSeq, sequence: seq, serialization: Serialization.JSON, compression: Compression.Gzip, payload: zlib.gzipSync(jsonBuf(payload)) }))
  seq++
  await new Promise(r => setTimeout(r, 500))
  for (let o = 0; o < pcm.length; o += 3200) {
    ws.send(marshal({ type: MsgType.AudioOnlyClient, flag: Flag.PositiveSeq, sequence: seq, payload: zlib.gzipSync(pcm.slice(o, o + 3200)) }))
    seq++
    await new Promise(r => setTimeout(r, 120))
  }
  ws.send(marshal({ type: MsgType.AudioOnlyClient, flag: Flag.LastNoSeq, payload: zlib.gzipSync(pcm.slice(pcm.length - 3200)) }))
  await new Promise(r => setTimeout(r, 5000))
  ws.close()
  process.exit(0)
})().catch(e => { console.error('ERR:', e.message); process.exit(1) })
