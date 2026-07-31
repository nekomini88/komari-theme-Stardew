import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const specPath = resolve(__dirname, '../..', 'spec.yaml')
const specText = readFileSync(specPath, 'utf-8')

describe('spec.yaml', () => {
  it('MUST exist', () => {
    expect(specText).toBeTruthy()
  })

  it('MUST have schema 1.0', () => {
    const yaml = require('yaml')
    const data = yaml.parse(specText)
    expect(data.schema).toBe('1.0')
  })

  it('MUST be version 1.2.0', () => {
    const yaml = require('yaml')
    const data = yaml.parse(specText)
    expect(data.version).toBe('1.2.0')
  })

  it('MUST be web_fullstack', () => {
    const yaml = require('yaml')
    const data = yaml.parse(specText)
    expect(data.project.type).toBe('web_fullstack')
  })

  it('MUST reference architecture, devops, testing, security', () => {
    const yaml = require('yaml')
    const data = yaml.parse(specText)
    const refs = data.references.items
    expect(refs).toContain('architecture')
    expect(refs).toContain('devops')
    expect(refs).toContain('testing')
    expect(refs).toContain('security')
  })
})

  it('MUST include stardew-visual-style reference', () => {
    const yaml = require('yaml')
    const data = yaml.parse(specText)
    const refs = data.references?.items ?? []
    expect(refs).toContain('stardew-visual-style')
  })

  it('MUST define themes.visual_style with allowed baseline+stardew', () => {
    const yaml = require('yaml')
    const data = yaml.parse(specText)
    expect(data.themes?.visual_style?.allowed).toEqual(['stardew', 'baseline'])
  })
