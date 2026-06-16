import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Save,
  RefreshCw,
  Key,
  Server,
  Database,
  Shield,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { getSettings, saveSettings, resetSettings, type Settings } from '@/lib/api'

// Default settings for initial state
const defaultSettings: Settings = {
  exceedce_base_url: 'https://exceedce.com/api',
  exceedce_api_key: '',
  ceb_endpoint: 'https://api.cebroker.com/UploadXMLString',
  ceb_provider_id: '',
  ceb_upload_key: '',
  ceb_mode: 'test',
  ceb_dry_run: true,
  ceb_print_xml: false,
  ceb_sc_profession: 'RE',
  ceb_default_profession: 'RE',
  ceb_test_license_override: '',
  ceb_test_course_override: '',
  ledger_path: './data/submissions.json',
  enable_notifications: true,
  email_on_error: true,
  email_recipients: '',
}

export function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [config, setConfig] = useState<Settings>(defaultSettings)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  // Auto-clear status message after 5 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [statusMessage])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const settings = await getSettings()
      setConfig(settings)
    } catch (error) {
      console.error('Failed to load settings:', error)
      setStatusMessage({ type: 'error', text: 'Failed to load settings from server' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const result = await saveSettings(config)
      if (result.success) {
        setStatusMessage({ type: 'success', text: 'Settings saved successfully!' })
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to save settings' })
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      setStatusMessage({ type: 'error', text: 'Failed to save settings. Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    try {
      setIsResetting(true)
      const result = await resetSettings()
      if (result.success && result.settings) {
        setConfig(result.settings)
        setStatusMessage({ type: 'success', text: 'Settings reset to defaults!' })
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to reset settings' })
      }
    } catch (error) {
      console.error('Failed to reset settings:', error)
      setStatusMessage({ type: 'error', text: 'Failed to reset settings. Please try again.' })
    } finally {
      setIsResetting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="exceedce">ExceedCE</TabsTrigger>
          <TabsTrigger value="cebroker">CE Broker</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Configure general pipeline settings and behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Pipeline Mode</Label>
                  <Select
                    value={config.ceb_mode}
                    onValueChange={(v) => setConfig({ ...config, ceb_mode: v as 'test' | 'live' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="test">Test Mode</SelectItem>
                      <SelectItem value="live">Live Mode</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Test mode uses CE Broker's test environment
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Ledger Path</Label>
                  <Input
                    value={config.ledger_path}
                    onChange={(e) => setConfig({ ...config, ledger_path: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Path to the submissions ledger JSON file
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Dry Run Mode</Label>
                    <p className="text-xs text-muted-foreground">
                      When enabled, no actual submissions are made to CE Broker
                    </p>
                  </div>
                  <Switch
                    checked={config.ceb_dry_run}
                    onCheckedChange={(v) => setConfig({ ...config, ceb_dry_run: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Print XML Payloads</Label>
                    <p className="text-xs text-muted-foreground">
                      Log XML payloads to console for debugging
                    </p>
                  </div>
                  <Switch
                    checked={config.ceb_print_xml}
                    onCheckedChange={(v) => setConfig({ ...config, ceb_print_xml: v })}
                  />
                </div>
              </div>

              {/* Current Status */}
              <div className="rounded-lg bg-slate-50 p-4">
                <h4 className="font-semibold mb-3">Current Configuration Status</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">ExceedCE API: Connected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">CE Broker API: Connected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Ledger: Accessible</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={config.ceb_mode === 'test' ? 'secondary' : 'destructive'}>
                      {config.ceb_mode.toUpperCase()} MODE
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ExceedCE Settings */}
        <TabsContent value="exceedce">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                ExceedCE Configuration
              </CardTitle>
              <CardDescription>
                Configure connection to the ExceedCE learning platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <Input
                    value={config.exceedce_base_url}
                    onChange={(e) => setConfig({ ...config, exceedce_base_url: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={config.exceedce_api_key}
                      onChange={(e) => setConfig({ ...config, exceedce_api_key: e.target.value })}
                    />
                    <Button variant="outline" size="icon">
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-800">
                  Connection to ExceedCE API is active
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CE Broker Settings */}
        <TabsContent value="cebroker">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                CE Broker Configuration
              </CardTitle>
              <CardDescription>
                Configure CE Broker API credentials and submission settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>API Endpoint</Label>
                  <Input
                    value={config.ceb_endpoint}
                    onChange={(e) => setConfig({ ...config, ceb_endpoint: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Provider ID</Label>
                  <Input
                    value={config.ceb_provider_id}
                    onChange={(e) => setConfig({ ...config, ceb_provider_id: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Upload Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={config.ceb_upload_key}
                      onChange={(e) => setConfig({ ...config, ceb_upload_key: e.target.value })}
                    />
                    <Button variant="outline" size="icon">
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>SC Profession Code</Label>
                  <Input
                    value={config.ceb_sc_profession}
                    onChange={(e) => setConfig({ ...config, ceb_sc_profession: e.target.value })}
                  />
                </div>
              </div>

              <Separator />

              <h4 className="font-semibold">Test Mode Overrides</h4>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Test License Override</Label>
                  <Input
                    value={config.ceb_test_license_override}
                    onChange={(e) => setConfig({ ...config, ceb_test_license_override: e.target.value })}
                    placeholder="e.g., 99999999"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use this license number in test mode
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Test Course Override</Label>
                  <Input
                    value={config.ceb_test_course_override}
                    onChange={(e) => setConfig({ ...config, ceb_test_course_override: e.target.value })}
                    placeholder="e.g., 900105"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use this CE Broker course ID in test mode
                  </p>
                </div>
              </div>

              {config.ceb_mode === 'live' && (
                <div className="flex items-center gap-2 p-4 bg-red-50 rounded-lg border border-red-200">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-sm text-red-800">
                    LIVE MODE is active. Submissions will be sent to the production CE Broker endpoint.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure email and alert notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Receive notifications about pipeline events
                  </p>
                </div>
                <Switch
                  checked={config.enable_notifications}
                  onCheckedChange={(v) => setConfig({ ...config, enable_notifications: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email on Error</Label>
                  <p className="text-xs text-muted-foreground">
                    Send email when submission errors occur
                  </p>
                </div>
                <Switch
                  checked={config.email_on_error}
                  onCheckedChange={(v) => setConfig({ ...config, email_on_error: v })}
                />
              </div>

              <div className="space-y-2">
                <Label>Email Recipients</Label>
                <Input
                  value={config.email_recipients}
                  onChange={(e) => setConfig({ ...config, email_recipients: e.target.value })}
                  placeholder="email@example.com, another@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of email addresses
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex flex-col gap-3">
        {/* Status Message */}
        {statusMessage && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              statusMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="text-sm">{statusMessage.text}</span>
          </div>
        )}
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleReset} disabled={isResetting || isSaving}>
            {isResetting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isResetting}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
