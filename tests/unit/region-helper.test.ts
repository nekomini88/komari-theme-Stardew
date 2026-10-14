import { describe, expect, it } from 'vitest'
import {
  emojiToRegionMap,
  extractRegionEmojis,
  getEmojiByCode,
  getRegionByAlias,
  getRegionCode,
  getRegionDisplayName,
  getSupportedRegions,
  isRegionMatch,
  searchRegions,
} from '@/utils/regionHelper'

type RegionInfo = { en: string, zh: string, code: string, aliases: string[] }

// 从真实数据表推导样本，绝不硬编码猜测值
const regionEntries = Object.entries(emojiToRegionMap) as Array<[string, RegionInfo]>
const [sampleEmoji, sampleInfo] = regionEntries[0]!
const hkEmoji = '🇭🇰'
const hkInfo = emojiToRegionMap[hkEmoji]!

// lowercase alias -> 出现的地区 emoji（按数据表顺序去重）
const aliasToEmojis = new Map<string, string[]>()
for (const [emoji, info] of regionEntries) {
  for (const alias of info.aliases) {
    const key = alias.toLowerCase()
    const list = aliasToEmojis.get(key) ?? []
    if (!list.includes(emoji))
      list.push(emoji)
    aliasToEmojis.set(key, list)
  }
}
// 同一别名指向多个地区 —— 由真实数据推导出的冲突别名
const ambiguousAliases = [...aliasToEmojis.entries()].filter(([, emojis]) => emojis.length > 1)

describe('数据表一致性（全部由真实数据推导）', () => {
  it('getSupportedRegions 长度 === emojiToRegionMap 键数，且集合一致', () => {
    const regions = getSupportedRegions()
    const keys = Object.keys(emojiToRegionMap)
    expect(regions).toHaveLength(keys.length)
    expect(new Set(regions)).toEqual(new Set(keys))
    // 数据表非空
    expect(keys.length).toBeGreaterThan(0)
  })

  it('每个地区的 code 唯一（getEmojiByCode 才能无歧义反查）', () => {
    const codes = regionEntries.map(([, info]) => info.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('getRegionCode 与 getEmojiByCode 对全表互逆', () => {
    for (const [emoji, info] of regionEntries) {
      expect(getRegionCode(emoji)).toBe(info.code)
      expect(getEmojiByCode(info.code)).toBe(emoji)
    }
  })

  it('每个地区的 code 出现在自身别名中（大小写不敏感）', () => {
    const lowerAliases = (info: RegionInfo) => info.aliases.map(a => a.toLowerCase())
    for (const [, info] of regionEntries)
      expect(lowerAliases(info)).toContain(info.code.toLowerCase())
  })
})

describe('isRegionMatch', () => {
  it('emoji 与搜索词完全相同时命中', () => {
    expect(isRegionMatch(hkEmoji, hkEmoji)).toBe(true)
  })

  it('英文名子串命中（大小写不敏感）', () => {
    const term = sampleInfo.en.toLowerCase()
    expect(isRegionMatch(sampleEmoji, term)).toBe(true)
    expect(isRegionMatch(sampleEmoji, sampleInfo.en.toUpperCase())).toBe(true)
  })

  it('中文名子串命中', () => {
    expect(isRegionMatch(sampleEmoji, sampleInfo.zh)).toBe(true)
    expect(isRegionMatch(hkEmoji, '香')).toBe(true)
  })

  it('别名命中（大小写不敏感 + trim）', () => {
    const alias = hkInfo.aliases[0]! // 'hk'
    expect(isRegionMatch(hkEmoji, alias)).toBe(true)
    expect(isRegionMatch(hkEmoji, alias.toUpperCase())).toBe(true)
    expect(isRegionMatch(hkEmoji, `  ${alias}  `)).toBe(true)
  })

  it('无关搜索词不命中', () => {
    expect(isRegionMatch(hkEmoji, 'zzz-definitely-not-a-region')).toBe(false)
  })

  it('未知 emoji 走简单包含匹配：命中子串、未命中返回 false', () => {
    expect(isRegionMatch('xyz', 'xy')).toBe(true)
    expect(isRegionMatch('xyz', 'zzz')).toBe(false)
  })

  it('边界：空搜索词对任意 emoji 都返回 true（子串恒真，待重构时注意）', () => {
    expect(isRegionMatch(hkEmoji, '')).toBe(true)
    expect(isRegionMatch(hkEmoji, '   ')).toBe(true)
    expect(isRegionMatch('xyz-not-a-region', '')).toBe(true)
  })
})

describe('getRegionDisplayName', () => {
  it('默认返回中文名', () => {
    expect(getRegionDisplayName(hkEmoji)).toBe(hkInfo.zh)
  })

  it('language="zh" 返回中文名，language="en" 返回英文名', () => {
    expect(getRegionDisplayName(hkEmoji, 'zh')).toBe(hkInfo.zh)
    expect(getRegionDisplayName(hkEmoji, 'en')).toBe(hkInfo.en)
  })

  it('全表：按语言取值与数据表一致', () => {
    for (const [emoji, info] of regionEntries) {
      expect(getRegionDisplayName(emoji, 'zh')).toBe(info.zh)
      expect(getRegionDisplayName(emoji, 'en')).toBe(info.en)
    }
  })

  it('未知 emoji 原样返回', () => {
    expect(getRegionDisplayName('not-a-region')).toBe('not-a-region')
    expect(getRegionDisplayName('')).toBe('')
  })
})

describe('getSupportedRegions', () => {
  it('返回的每个键都能在数据表中查到', () => {
    for (const emoji of getSupportedRegions())
      expect(emojiToRegionMap[emoji]).toBeDefined()
  })

  it('返回的是新数组（调用方改动不影响数据表）', () => {
    const a = getSupportedRegions()
    a.push('mutated')
    expect(getSupportedRegions()).not.toContain('mutated')
  })
})

describe('getRegionCode', () => {
  it('已知 emoji 返回 code', () => {
    expect(getRegionCode(hkEmoji)).toBe(hkInfo.code)
    expect(getRegionCode(regionEntries[0]![0])).toBe(regionEntries[0]![1].code)
  })

  it('未知 emoji 原样返回', () => {
    expect(getRegionCode('not-a-region')).toBe('not-a-region')
    expect(getRegionCode('')).toBe('')
  })
})

describe('getEmojiByCode', () => {
  it('已知 code 返回对应 emoji（大小写不敏感）', () => {
    expect(getEmojiByCode(hkInfo.code)).toBe(hkEmoji)
    expect(getEmojiByCode(hkInfo.code.toLowerCase())).toBe(hkEmoji)
  })

  it('未知 code 原样返回', () => {
    expect(getEmojiByCode('ZZ')).toBe('ZZ')
    expect(getEmojiByCode('')).toBe('')
  })
})

describe('searchRegions', () => {
  it('已知搜索词返回全部 isRegionMatch 命中的地区', () => {
    const results = searchRegions(sampleInfo.code)
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(isRegionMatch(r.emoji, sampleInfo.code.toLowerCase())).toBe(true)
    }
    // 结果条目形状完整
    for (const r of results) {
      expect(r).toEqual({
        emoji: r.emoji,
        en: emojiToRegionMap[r.emoji]!.en,
        zh: emojiToRegionMap[r.emoji]!.zh,
        code: emojiToRegionMap[r.emoji]!.code,
      })
    }
  })

  it('空搜索词返回全部地区（数据表全表，待重构时注意）', () => {
    expect(searchRegions('')).toHaveLength(regionEntries.length)
    expect(searchRegions('   ')).toHaveLength(regionEntries.length)
  })

  it('无命中返回空数组', () => {
    expect(searchRegions('zzz-definitely-not-a-region')).toEqual([])
  })

  it('中文搜索命中', () => {
    const r = searchRegions(hkInfo.zh)
    expect(r.some(x => x.emoji === hkEmoji)).toBe(true)
  })
})

describe('别名冲突：同一别名指向多个地区（真实数据推导）', () => {
  it('真实数据中确实存在冲突别名', () => {
    expect(ambiguousAliases.length).toBeGreaterThan(0)
  })

  it('searchRegions(冲突别名) 返回全部对应地区', () => {
    for (const [alias, emojis] of ambiguousAliases) {
      const codes = searchRegions(alias).map(r => r.code)
      for (const emoji of emojis)
        expect(codes).toContain(emojiToRegionMap[emoji]!.code)
      // 覆盖到全部冲突地区
      expect(new Set(codes)).toEqual(new Set(emojis.map(e => emojiToRegionMap[e]!.code)))
    }
  })

  it('getRegionByAlias(冲突别名) 返回数据表中首个匹配项（按插入顺序，待重构时注意）', () => {
    for (const [alias] of ambiguousAliases) {
      const firstEmoji = regionEntries.find(([, info]) =>
        info.aliases.some(a => a.toLowerCase() === alias),
      )![0]
      const got = getRegionByAlias(alias)
      expect(got).not.toBeNull()
      expect(got!.emoji).toBe(firstEmoji)
    }
  })

  it('别名冲突集合与 congo/刚果/剛果 一致（数据表事实）', () => {
    const aliasNames = ambiguousAliases.map(([a]) => a).sort()
    expect(aliasNames).toEqual(['congo', '刚果', '剛果'].sort())
  })
})

describe('getRegionByAlias', () => {
  it('按代码精确匹配（大小写不敏感）', () => {
    expect(getRegionByAlias(hkInfo.code)).toEqual({
      emoji: hkEmoji,
      en: hkInfo.en,
      zh: hkInfo.zh,
      code: hkInfo.code,
    })
    expect(getRegionByAlias(hkInfo.code.toLowerCase())!.emoji).toBe(hkEmoji)
    expect(getRegionByAlias(`  ${hkInfo.code}  ` )!.emoji).toBe(hkEmoji)
  })

  it('按别名精确匹配（大小写不敏感）', () => {
    expect(getRegionByAlias('hongkong')!.emoji).toBe(hkEmoji)
    expect(getRegionByAlias('HONGKONG')!.emoji).toBe(hkEmoji)
  })

  it('中文别名命中', () => {
    expect(getRegionByAlias(hkInfo.zh)!.emoji).toBe(hkEmoji)
  })

  it('仅精确匹配：部分子串不命中（与 isRegionMatch 不同，待重构时注意）', () => {
    expect(getRegionByAlias('hong')).toBeNull()
    expect(getRegionByAlias('united')).toBeNull()
  })

  it('空串/空白/未知 返回 null', () => {
    expect(getRegionByAlias('')).toBeNull()
    expect(getRegionByAlias('   ')).toBeNull()
    expect(getRegionByAlias('zzz-definitely-not-a-region')).toBeNull()
  })

  it('全表：按 code 反查与 getEmojiByCode 结果一致', () => {
    for (const [emoji, info] of regionEntries) {
      const got = getRegionByAlias(info.code)
      expect(got!.emoji).toBe(emoji)
    }
  })
})

describe('extractRegionEmojis', () => {
  it('从文本中提取全部已知国旗 emoji', () => {
    expect(extractRegionEmojis(`hello ${hkEmoji} and ${sampleEmoji} bye`)).toEqual([hkEmoji, sampleEmoji])
  })

  it('保留重复出现（不去重，待重构时注意）', () => {
    expect(extractRegionEmojis(`${hkEmoji}${hkEmoji}${sampleEmoji}`)).toEqual([hkEmoji, hkEmoji, sampleEmoji])
  })

  it('过滤不在数据表中的旗形 emoji', () => {
    expect(extractRegionEmojis('🇿🇿')).toEqual([])
  })

  it('无旗标返回空数组', () => {
    expect(extractRegionEmojis('no flags here')).toEqual([])
    expect(extractRegionEmojis('')).toEqual([])
  })

  it('全表：任一地区的 emoji 都能被单独提取', () => {
    for (const [emoji] of regionEntries)
      expect(extractRegionEmojis(`x${emoji}y`)).toEqual([emoji])
  })
})
