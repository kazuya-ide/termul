import { describe, expect, it } from 'vitest'
import { resolveThumbnailPath } from './app-hub-thumbnail'

describe('resolveThumbnailPath', () => {
  const registryApps = 'C:\\Users\\Owner\\Desktop\\アプリ台帳ハブ\\registry\\apps'

  it('registry/apps 末尾を親(registry)に戻し、相対パスを結合する', () => {
    expect(resolveThumbnailPath(registryApps, 'assets/craflow.png')).toBe(
      'C:\\Users\\Owner\\Desktop\\アプリ台帳ハブ\\registry\\assets\\craflow.png'
    )
  })

  it('registryRoot が / 区切りでも末尾 /apps を取り除く', () => {
    expect(resolveThumbnailPath('C:/foo/registry/apps', 'assets/x.png')).toBe(
      'C:/foo/registry\\assets\\x.png'
    )
  })

  it('registryRoot に apps 接尾辞が無ければそのまま親として使う', () => {
    expect(resolveThumbnailPath('C:\\foo\\registry', 'assets/x.png')).toBe(
      'C:\\foo\\registry\\assets\\x.png'
    )
  })

  it('前後の空白を落とし、区切りをバックスラッシュに正規化する', () => {
    expect(resolveThumbnailPath(registryApps, '  /assets//craflow.png  ')).toBe(
      'C:\\Users\\Owner\\Desktop\\アプリ台帳ハブ\\registry\\assets\\craflow.png'
    )
  })

  it('ドライブレター始まりの絶対パスはそのまま返す', () => {
    expect(resolveThumbnailPath(registryApps, 'D:\\images\\shot.png')).toBe('D:\\images\\shot.png')
  })

  it('UNC(\\\\wsl$ 形式)の絶対パスはそのまま返す', () => {
    const unc = '\\\\wsl$\\Ubuntu\\home\\owner\\shot.png'
    expect(resolveThumbnailPath(registryApps, unc)).toBe(unc)
  })
})
