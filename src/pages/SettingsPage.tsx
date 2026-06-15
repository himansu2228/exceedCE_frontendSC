import { useState } from 'react'
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
} from 'lucide-react'

export function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false)

  // Configuration state
  const [config, setConfig] = useState({
    // ExceedCE
    exceedce_base_url: 'https://exceedce.com/api',
    exceedce_api_key: '••••••••••••••••',
    
    // CE Broker
    ceb_endpoint: 'https://api.cebroker.com/UploadXMLString',
    ceb_provider_id: '32093',
    ceb_upload_key: '••••••••',
    ceb_mode: 'test',
    ceb_dry_run: true,
    ceb_print_xml: false,
    
    // SC Specific
    ceb_sc_profession: 'RE',
    ceb_default_profession: 'RE',
    ceb_test_license_override: '99999999',
    ceb_test_course_override: '900105',
    
    // Ledger
    ledger_path: './data/submissions.json',
    
    // Notifications
    enable_notifications: true,
    email_on_error: true,
    email_recipients: 'admin@example.com',
  })

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSaving(false)
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
                    onValueChange={(v) => setConfig({ ...config, ceb_mode: v })}
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
      <div className="flex justify-end gap-3">
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
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
  )
}
