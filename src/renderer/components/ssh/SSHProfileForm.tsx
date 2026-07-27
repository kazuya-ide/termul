import type { SSHAuthMethod, SSHProfile } from '@shared/types/ssh.types'
import { FolderOpen, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { dialogApi } from '@/lib/api'
import { useSSHActions } from '@/stores/ssh-store'

interface SSHProfileFormProps {
  profile: SSHProfile | null
  onClose: () => void
  onSaved: () => void
}

export function SSHProfileForm({
  profile,
  onClose,
  onSaved
}: SSHProfileFormProps): React.JSX.Element {
  const { saveProfile } = useSSHActions()

  const [name, setName] = useState(profile?.name ?? '')
  const [host, setHost] = useState(profile?.host ?? '')
  const [port, setPort] = useState(profile?.port ?? 22)
  const [username, setUsername] = useState(profile?.username ?? '')
  const [authMethod, setAuthMethod] = useState<SSHAuthMethod>(profile?.authMethod ?? 'key')
  const [privateKeyPath, setPrivateKeyPath] = useState(profile?.privateKeyPath ?? '')
  // Security: never hydrate credentials from stored profile - require re-entry
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSelectKeyFile = async () => {
    try {
      const result = await dialogApi.selectFile({
        title: '秘密鍵を選択',
        filters: [{ name: 'すべてのファイル', extensions: ['*'] }]
      })
      if (result.success) {
        setPrivateKeyPath(result.data)
      } else if (result.code !== 'CANCELLED') {
        toast.error(`ファイルの選択に失敗しました: ${result.error}`)
      }
    } catch (error) {
      toast.error(
        `ファイル選択ダイアログの起動に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !host.trim() || !username.trim()) {
      toast.error('名前、ホスト、ユーザー名は必須です')
      return
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error('ポートは1〜65535の整数で指定してください')
      return
    }

    setSaving(true)
    try {
      const profileData: SSHProfile = {
        id: profile?.id ?? Date.now().toString(),
        name: name.trim(),
        host: host.trim(),
        port,
        username: username.trim(),
        authMethod,
        privateKeyPath: authMethod === 'key' ? privateKeyPath.trim() || undefined : undefined,
        // Only send password/passphrase if user entered a new value
        password: authMethod === 'password' && password ? password : undefined,
        passphrase: authMethod === 'key' && passphrase ? passphrase : undefined,
        portForwards: profile?.portForwards ?? [],
        tags: profile?.tags,
        lastConnected: profile?.lastConnected,
        importedFrom: profile?.importedFrom,
        hasStoredPassword: profile?.hasStoredPassword,
        hasStoredPassphrase: profile?.hasStoredPassphrase
      }

      const success = await saveProfile(profileData)
      if (success) {
        toast.success(profile ? 'プロファイルを更新しました' : 'プロファイルを作成しました')
        onSaved()
      } else {
        toast.error('プロファイルの保存に失敗しました')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-lg w-[420px] max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">
            {profile ? 'SSHプロファイルを編集' : '新規SSHプロファイル'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="マイサーバー"
              className="mt-1 w-full px-3 py-1.5 text-sm bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Host + Port */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">ホスト</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.100 または example.com"
                className="mt-1 w-full px-3 py-1.5 text-sm bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="w-20">
              <label className="text-xs font-medium text-muted-foreground">ポート</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                min={1}
                max={65535}
                className="mt-1 w-full px-3 py-1.5 text-sm bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">ユーザー名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              className="mt-1 w-full px-3 py-1.5 text-sm bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Auth Method */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">認証</label>
            <select
              value={authMethod}
              onChange={(e) => setAuthMethod(e.target.value as SSHAuthMethod)}
              className="mt-1 w-full px-3 py-1.5 text-sm bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="key">秘密鍵</option>
              <option value="password">パスワード</option>
              <option value="agent">SSHエージェント</option>
            </select>
          </div>

          {/* Private Key Path (conditional) */}
          {authMethod === 'key' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">秘密鍵のパス</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={privateKeyPath}
                  onChange={(e) => setPrivateKeyPath(e.target.value)}
                  placeholder="~/.ssh/id_rsa"
                  className="flex-1 px-3 py-1.5 text-sm bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={handleSelectKeyFile}
                  className="px-2 py-1.5 text-xs rounded border border-border bg-muted hover:bg-accent text-muted-foreground flex items-center"
                  title="秘密鍵ファイルを参照"
                >
                  <FolderOpen className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Passphrase for key (conditional) */}
          {authMethod === 'key' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">鍵のパスフレーズ</label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={
                  profile?.hasStoredPassphrase ? '••••••••' : 'パスフレーズがない場合は空欄'
                }
                className="mt-1 w-full px-3 py-1.5 text-sm bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {profile?.hasStoredPassphrase && (
                <p className="mt-1 text-3xs text-muted-foreground">
                  🔒
                  パスフレーズはOSのキーチェーンに安全に保存されています。既存の値を維持する場合は空欄にしてください。
                </p>
              )}
            </div>
          )}

          {/* Password (conditional) */}
          {authMethod === 'password' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={profile?.hasStoredPassword ? '••••••••' : 'パスワードを入力'}
                className="mt-1 w-full px-3 py-1.5 text-sm bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="mt-1 text-3xs text-muted-foreground">
                {profile?.hasStoredPassword
                  ? '🔒 パスワードはOSのキーチェーンに安全に保存されています。既存の値を維持する場合は空欄にしてください。'
                  : '🔒 パスワードはOSのキーチェーン(Windows Credential Manager / macOS Keychain)に保存されます'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded border border-border hover:bg-accent"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? '保存中...' : profile ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
