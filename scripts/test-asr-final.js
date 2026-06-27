require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const fs = require('fs')
const { v4: uuid } = require('uuid')
const WebSocket = require('ws')
const zlib = require('zlib')
const { MsgType, Flag, Serialization, Compression, marshal, parseMessage, jsonBuf } = require('../src/services/voice-call/plan-protocol')

;(async () => {
  const wav = fs.readFileSync(require('path').join(__dirname, '../voice_16k.wav'))
  const ws = new WebSocket('wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_nostream', {
    headers: {
      'X-Api-Key': process.env.ARK_API_KEY,
      'X-Api-Resource-Id': 'volc.seedasr.sauc.duration',
      'X-Api-Request-Id': uuid(),
      'X-Api-Connect-Id': uuid(),
      'X-Api-Sequence': '-1'
    }
  })
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej) })
  console.log('握手成功, wav', wav.length, '字节')
  let cnt = 0
  ws.on('message', d => {
    cnt++
    const m = parseMessage(d)
    let text = ''
    try { const j = JSON.parse(m.payload.toString('utf8')); text = j.result && j.result.text || '' } catch (e) {}
    console.log('#' + cnt + ' isLast=' + m.isLast + ' flags=' + m.flags + ' text=' + JSON.stringify(text))
  })
  const payload = { user: { uid: 'bdx' }, audio: { format: 'wav', codec: 'raw', rate: 16000, bits: 16, channel: 1 }, request: { model_name: 'bigmodel', enable_itn: true, enable_punc: true, enable_ddc: true, show_utterances: true, enable_nonstream: false } }
  let seq = 1
  ws.send(marshal({ type: MsgType.FullClientRequest, flag: Flag.PositiveSeq, sequence: seq, serialization: Serialization.JSON, compression: Compression.Gzip, payload: zlib.gzipSync(jsonBuf(payload)) }))
  seq++
  await new Promise(r => setTimeout(r, 500))
  const segs = []
  for (let o = 0; o < wav.length; o += 6400) segs.push(wav.slice(o, o + 6400))
  console.log('分', segs.length, '块发送')
  for (let i = 0; i < segs.length; i++) {
    const isLast = i === segs.length - 1
    const flag = isLast ? Flag.NegativeSeq : Flag.PositiveSeq
    const pkt = marshal({ type: MsgType.AudioOnlyClient, flag, sequence: seq, payload: zlib.gzipSync(segs[i]) })
    if (isLast) console.log('最后包 seq=' + seq + ' flag=NegativeSeq(0b0011) bytes=' + pkt.length)
    ws.send(pkt)
    if (!isLast) seq++
    await new Promise(r => setTimeout(r, 200))
  }
  await new Promise(r => setTimeout(r, 6000))
  console.log('总响应:', cnt)
  ws.close()
  process.exit(0)
})().catch(e => { console.error('ERR:', e.message); process.exit(1) })
