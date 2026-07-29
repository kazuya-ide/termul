import { describe, expect, it } from 'vitest'
import { normalizePath } from './app-hub-detect'

describe('normalizePath', () => {
  it('バックスラッシュをスラッシュに統一し小文字化する', () => {
    expect(normalizePath('C:\\Users\\Owner\\Desktop\\App')).toBe('c:/users/owner/desktop/app')
  })

  it('末尾スラッシュ(複数含む)を除去する', () => {
    expect(normalizePath('C:/foo/bar//')).toBe('c:/foo/bar')
    expect(normalizePath('C:\\foo\\bar\\')).toBe('c:/foo/bar')
  })

  it('台帳のバックスラッシュ表記と走査のスラッシュ表記が同一に正規化される', () => {
    // 台帳 paths.local はバックスラッシュ、readDirectory の返す path はスラッシュ。
    const fromRegistry = 'C:\\Users\\Owner\\Desktop\\LITアプリ一覧\\lp-editor-app'
    const fromScan = 'C:/Users/Owner/Desktop/LITアプリ一覧/lp-editor-app'
    expect(normalizePath(fromRegistry)).toBe(normalizePath(fromScan))
  })

  it('大文字小文字の違いを吸収する(Windowsはパスを区別しない)', () => {
    expect(normalizePath('C:/Foo/Bar')).toBe(normalizePath('c:/foo/bar'))
  })
})
