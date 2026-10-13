/**
 * 最小 PNG 解码器（只覆盖本项目产物的形态：8 位 / RGBA 或 RGB / 非隔行 / 滤波 0-4）。
 *
 * 为什么要自己写：单测环境没有 pngjs/sharp，而「文字色是否配得上横幅」这件事
 * **必须对着真实底板像素校验** —— 读一份手写的 JSON 事实表等于没验（事实表会与实际脱节）。
 */
import { inflateSync } from 'node:zlib'

export interface RgbaImage {
  width: number
  height: number
  /** 逐像素 RGBA，长度 = width*height*4 */
  data: Uint8Array
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

export function decodePng(buf: Uint8Array): RgbaImage {
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== SIGNATURE[i])
      throw new Error('不是 PNG 文件')
  }

  let pos = 8
  let width = 0
  let height = 0
  let channels = 0
  let bitDepth = 0
  const idat: Uint8Array[] = []

  while (pos < buf.length) {
    const len = (buf[pos]! << 24 | buf[pos + 1]! << 16 | buf[pos + 2]! << 8 | buf[pos + 3]!) >>> 0
    const type = String.fromCharCode(buf[pos + 4]!, buf[pos + 5]!, buf[pos + 6]!, buf[pos + 7]!)
    const body = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = (body[0]! << 24 | body[1]! << 16 | body[2]! << 8 | body[3]!) >>> 0
      height = (body[4]! << 24 | body[5]! << 16 | body[6]! << 8 | body[7]!) >>> 0
      bitDepth = body[8]!
      const colorType = body[9]!
      if (bitDepth !== 8)
        throw new Error(`只支持 8 位色深，实际 ${bitDepth}`)
      if (body[12] !== 0)
        throw new Error('不支持隔行 PNG')
      channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : -1
      if (channels < 0)
        throw new Error(`不支持的颜色类型 ${colorType}`)
    }
    else if (type === 'IDAT') {
      idat.push(body)
    }
    else if (type === 'IEND') {
      break
    }
    pos += 12 + len
  }

  const raw = inflateSync(Buffer.concat(idat.map(b => Buffer.from(b))))
  const stride = width * channels
  const out = new Uint8Array(width * height * 4)
  const prev = new Uint8Array(stride)
  const cur = new Uint8Array(stride)

  let rp = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++]!
    cur.set(raw.subarray(rp, rp + stride))
    rp += stride
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels]! : 0
      const b = prev[x]!
      const c = x >= channels ? prev[x - channels]! : 0
      let v = cur[x]!
      if (filter === 1)
        v += a
      else if (filter === 2)
        v += b
      else if (filter === 3)
        v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
      }
      cur[x] = v & 0xff
    }
    for (let x = 0; x < width; x++) {
      const si = x * channels
      const di = (y * width + x) * 4
      if (channels === 4) {
        out[di] = cur[si]!
        out[di + 1] = cur[si + 1]!
        out[di + 2] = cur[si + 2]!
        out[di + 3] = cur[si + 3]!
      }
      else if (channels === 3) {
        out[di] = cur[si]!
        out[di + 1] = cur[si + 1]!
        out[di + 2] = cur[si + 2]!
        out[di + 3] = 255
      }
      else {
        const g = cur[si]!
        out[di] = g
        out[di + 1] = g
        out[di + 2] = g
        out[di + 3] = 255
      }
    }
    prev.set(cur)
  }
  return { width, height, data: out }
}

/** 取区域内的「主色」（各通道中位数 —— 避开描边/高光的少数极值） */
export function dominantColor(img: RgbaImage, x0: number, x1: number, y0: number, y1: number): string {
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4
      if (img.data[i + 3] === 0)
        continue
      rs.push(img.data[i]!)
      gs.push(img.data[i + 1]!)
      bs.push(img.data[i + 2]!)
    }
  }
  const med = (arr: number[]) => {
    arr.sort((a, b) => a - b)
    return arr[Math.floor(arr.length / 2)]!
  }
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(med(rs))}${h(med(gs))}${h(med(bs))}`
}

export function relativeLuminance(hex: string): number {
  const v = hex.replace('#', '')
  const ch = [0, 2, 4].map(i => Number.parseInt(v.slice(i, i + 2), 16) / 255)
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(ch[0]!) + 0.7152 * f(ch[1]!) + 0.0722 * f(ch[2]!)
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
