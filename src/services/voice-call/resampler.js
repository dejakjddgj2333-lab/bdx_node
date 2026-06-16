/**
 * PCM 16bit 单声道重采样（线性插值）
 * 输入输出均为 Node.js Buffer / Uint8Array，采样点为小端 16bit 有符号整数。
 */
function resamplePcm16Mono(inputBuffer, fromRate, toRate) {
  if (fromRate === toRate) {
    return Buffer.from(inputBuffer)
  }

  const inputBytes = Buffer.from(inputBuffer)
  const inputSamples = Math.floor(inputBytes.length / 2)
  if (inputSamples === 0) {
    return Buffer.alloc(0)
  }

  const ratio = toRate / fromRate
  const outputSamples = Math.floor(inputSamples * ratio)
  const outputBytes = Buffer.alloc(outputSamples * 2)

  const inputView = new DataView(inputBytes.buffer, inputBytes.byteOffset, inputBytes.byteLength)
  const outputView = new DataView(outputBytes.buffer, outputBytes.byteOffset, outputBytes.byteLength)

  for (let i = 0; i < outputSamples; i++) {
    const srcPos = i / ratio
    const index = Math.floor(srcPos)
    const frac = srcPos - index

    const s1 = index < inputSamples ? inputView.getInt16(index * 2, true) : 0
    const s2 = index + 1 < inputSamples ? inputView.getInt16((index + 1) * 2, true) : s1

    let sample = s1 + (s2 - s1) * frac
    if (sample > 32767) sample = 32767
    if (sample < -32768) sample = -32768

    outputView.setInt16(i * 2, Math.round(sample), true)
  }

  return outputBytes
}

module.exports = {
  resamplePcm16Mono
}
