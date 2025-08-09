import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const [aiSettings, setAiSettings] = useState({
    textThreshold: 0.7,
    imageThreshold: 0.8,
    autoBlock: true,
    multiLanguage: true,
    realTimeProcessing: true,
  });

  // Fetch AI model status
  const { data: aiModels } = useQuery({
    queryKey: ['/api/ai/models'],
  });

  // Fetch reputation config
  const { data: reputationConfig } = useQuery({
    queryKey: ['/api/reputation/config'],
  });

  const handleAiSettingChange = (key: string, value: any) => {
    setAiSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSettings = () => {
    toast({
      title: "Settings saved",
      description: "Your configuration has been updated successfully.",
    });
  };

  const handleRunHealthCheck = async (modelName: string) => {
    try {
      // Simulate health check - in real app this would call the API
      toast({
        title: "Health check completed",
        description: `${modelName} is running normally.`,
      });
    } catch (error) {
      toast({
        title: "Health check failed",
        description: `Error checking ${modelName} status.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600">Configure AI models, moderation rules, and system preferences</p>
      </div>

      <Tabs defaultValue="ai-models" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai-models" data-testid="tab-ai-models">AI Models</TabsTrigger>
          <TabsTrigger value="moderation" data-testid="tab-moderation">Moderation Rules</TabsTrigger>
          <TabsTrigger value="reputation" data-testid="tab-reputation">Reputation System</TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="ai-models" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Model Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>AI Model Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="text-threshold">Text Analysis Threshold</Label>
                  <div className="flex items-center space-x-4 mt-2">
                    <Input
                      id="text-threshold"
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={aiSettings.textThreshold}
                      onChange={(e) => handleAiSettingChange('textThreshold', parseFloat(e.target.value))}
                      className="w-24"
                      data-testid="input-text-threshold"
                    />
                    <span className="text-sm text-gray-500">
                      Confidence threshold for flagging text content
                    </span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="image-threshold">Image Detection Threshold</Label>
                  <div className="flex items-center space-x-4 mt-2">
                    <Input
                      id="image-threshold"
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={aiSettings.imageThreshold}
                      onChange={(e) => handleAiSettingChange('imageThreshold', parseFloat(e.target.value))}
                      className="w-24"
                      data-testid="input-image-threshold"
                    />
                    <span className="text-sm text-gray-500">
                      Confidence threshold for flagging image content
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-block">Auto-block High Confidence Violations</Label>
                    <Switch
                      id="auto-block"
                      checked={aiSettings.autoBlock}
                      onCheckedChange={(checked) => handleAiSettingChange('autoBlock', checked)}
                      data-testid="switch-auto-block"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="multi-language">Multi-language Support</Label>
                    <Switch
                      id="multi-language"
                      checked={aiSettings.multiLanguage}
                      onCheckedChange={(checked) => handleAiSettingChange('multiLanguage', checked)}
                      data-testid="switch-multi-language"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="real-time">Real-time Processing</Label>
                    <Switch
                      id="real-time"
                      checked={aiSettings.realTimeProcessing}
                      onCheckedChange={(checked) => handleAiSettingChange('realTimeProcessing', checked)}
                      data-testid="switch-real-time"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveSettings} className="w-full" data-testid="button-save-ai-settings">
                  <i className="fas fa-save mr-2"></i>
                  Save AI Configuration
                </Button>
              </CardContent>
            </Card>

            {/* Model Status & Health */}
            <Card>
              <CardHeader>
                <CardTitle>Model Status & Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {aiModels?.map((model) => (
                    <div key={model.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className={`w-3 h-3 rounded-full ${
                          model.status === 'active' ? 'bg-green-500' :
                          model.status === 'loading' ? 'bg-yellow-500 animate-pulse' :
                          model.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                        }`}></div>
                        <div>
                          <h4 className="font-medium">{model.modelName}</h4>
                          <p className="text-sm text-gray-500">
                            {model.modelType.charAt(0).toUpperCase() + model.modelType.slice(1)} Analysis
                            {model.version && ` • v${model.version}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={
                          model.status === 'active' ? 'default' :
                          model.status === 'loading' ? 'secondary' :
                          model.status === 'error' ? 'destructive' : 'outline'
                        }>
                          {model.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRunHealthCheck(model.modelName)}
                          data-testid={`button-health-check-${model.modelName.toLowerCase().replace(' ', '-')}`}
                        >
                          <i className="fas fa-stethoscope mr-1"></i>
                          Check
                        </Button>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center py-8 text-gray-500">
                      <i className="fas fa-robot text-4xl mb-4"></i>
                      <p>No AI models configured</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="moderation" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Moderation Rules */}
            <Card>
              <CardHeader>
                <CardTitle>Content Moderation Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Violation Types to Auto-Block</Label>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {[
                      'Hate Speech',
                      'Nudity/Adult',
                      'Violence',
                      'Spam',
                      'Harassment',
                      'Illegal Content'
                    ].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Switch id={type.toLowerCase().replace(/[^a-z0-9]/g, '')} defaultChecked />
                        <Label htmlFor={type.toLowerCase().replace(/[^a-z0-9]/g, '')} className="text-sm">
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="review-queue-size">Max Review Queue Size</Label>
                  <Input
                    id="review-queue-size"
                    type="number"
                    defaultValue="100"
                    className="mt-2"
                    data-testid="input-review-queue-size"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Maximum number of items in the moderation queue
                  </p>
                </div>

                <div>
                  <Label htmlFor="auto-escalation">Auto-escalation Time (hours)</Label>
                  <Input
                    id="auto-escalation"
                    type="number"
                    defaultValue="24"
                    className="mt-2"
                    data-testid="input-auto-escalation"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Time before flagged content is auto-escalated
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Language & Regional Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Language & Regional Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Supported Languages</Label>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {[
                      { code: 'en', name: 'English', enabled: true },
                      { code: 'hi', name: 'Hindi', enabled: true },
                      { code: 'ta', name: 'Tamil', enabled: false },
                      { code: 'te', name: 'Telugu', enabled: false },
                      { code: 'bn', name: 'Bengali', enabled: false },
                      { code: 'mr', name: 'Marathi', enabled: false },
                    ].map((lang) => (
                      <div key={lang.code} className="flex items-center space-x-2">
                        <Switch id={lang.code} defaultChecked={lang.enabled} />
                        <Label htmlFor={lang.code} className="text-sm">
                          {lang.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Regional Content Policies</Label>
                  <div className="space-y-2 mt-3">
                    <div className="flex items-center space-x-2">
                      <Switch id="regional-hate-speech" defaultChecked />
                      <Label htmlFor="regional-hate-speech" className="text-sm">
                        Enhanced hate speech detection for regional languages
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="cultural-context" defaultChecked />
                      <Label htmlFor="cultural-context" className="text-sm">
                        Apply cultural context in moderation decisions
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reputation" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reputation Scoring */}
            <Card>
              <CardHeader>
                <CardTitle>Reputation Scoring Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {reputationConfig && (
                  <>
                    <div>
                      <Label>Score Thresholds</Label>
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <Label htmlFor="ban-threshold" className="text-sm">Ban Threshold</Label>
                          <Input
                            id="ban-threshold"
                            type="number"
                            min="0"
                            max="5"
                            step="0.1"
                            defaultValue={reputationConfig.thresholds?.ban || 1.0}
                            data-testid="input-ban-threshold"
                          />
                        </div>
                        <div>
                          <Label htmlFor="warning-threshold" className="text-sm">Warning Threshold</Label>
                          <Input
                            id="warning-threshold"
                            type="number"
                            min="0"
                            max="5"
                            step="0.1"
                            defaultValue={reputationConfig.thresholds?.warning || 2.0}
                            data-testid="input-warning-threshold"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Violation Penalties</Label>
                      <div className="space-y-3 mt-3">
                        {Object.entries(reputationConfig.penalties || {}).map(([type, penalty]) => (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-sm">
                              {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            <Input
                              type="number"
                              min="-5"
                              max="0"
                              step="0.1"
                              defaultValue={penalty as number}
                              className="w-24"
                              data-testid={`input-penalty-${type}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Good Behavior Bonuses</Label>
                      <div className="space-y-3 mt-3">
                        {Object.entries(reputationConfig.bonuses || {}).map(([type, bonus]) => (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-sm">
                              {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            <Input
                              type="number"
                              min="0"
                              max="1"
                              step="0.01"
                              defaultValue={bonus as number}
                              className="w-24"
                              data-testid={`input-bonus-${type}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Automated Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Automated Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Automatic Restrictions</Label>
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Auto-ban at low reputation</p>
                        <p className="text-xs text-gray-500">Automatically ban users below threshold</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-auto-ban" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Shadow ban repeat offenders</p>
                        <p className="text-xs text-gray-500">Hide content from repeat violators</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-shadow-ban" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Rate limit low reputation users</p>
                        <p className="text-xs text-gray-500">Limit posting frequency for low-rep users</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-rate-limit" />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Rehabilitation Settings</Label>
                  <div className="space-y-3 mt-3">
                    <div>
                      <Label htmlFor="reputation-recovery" className="text-sm">Reputation Recovery Rate</Label>
                      <Input
                        id="reputation-recovery"
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        defaultValue="0.1"
                        className="mt-1"
                        data-testid="input-reputation-recovery"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Daily reputation recovery for good behavior
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="probation-period" className="text-sm">Probation Period (days)</Label>
                      <Input
                        id="probation-period"
                        type="number"
                        min="1"
                        max="365"
                        defaultValue="30"
                        className="mt-1"
                        data-testid="input-probation-period"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Probation period for banned users
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Performance */}
            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Processing Limits</Label>
                  <div className="space-y-3 mt-3">
                    <div>
                      <Label htmlFor="max-concurrent" className="text-sm">Max Concurrent Processing</Label>
                      <Input
                        id="max-concurrent"
                        type="number"
                        min="1"
                        max="100"
                        defaultValue="10"
                        className="mt-1"
                        data-testid="input-max-concurrent"
                      />
                    </div>
                    <div>
                      <Label htmlFor="queue-timeout" className="text-sm">Queue Timeout (minutes)</Label>
                      <Input
                        id="queue-timeout"
                        type="number"
                        min="1"
                        max="60"
                        defaultValue="5"
                        className="mt-1"
                        data-testid="input-queue-timeout"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Data Retention</Label>
                  <div className="space-y-3 mt-3">
                    <div>
                      <Label htmlFor="log-retention" className="text-sm">Log Retention (days)</Label>
                      <Input
                        id="log-retention"
                        type="number"
                        min="1"
                        max="365"
                        defaultValue="90"
                        className="mt-1"
                        data-testid="input-log-retention"
                      />
                    </div>
                    <div>
                      <Label htmlFor="content-retention" className="text-sm">Flagged Content Retention (days)</Label>
                      <Input
                        id="content-retention"
                        type="number"
                        min="1"
                        max="365"
                        defaultValue="180"
                        className="mt-1"
                        data-testid="input-content-retention"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notifications & Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Notifications & Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Alert Thresholds</Label>
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">High violation rate alerts</p>
                        <p className="text-xs text-gray-500">Alert when violation rate exceeds threshold</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-high-violation-alerts" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">AI model failure alerts</p>
                        <p className="text-xs text-gray-500">Alert when AI models go offline</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-ai-failure-alerts" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Queue overflow alerts</p>
                        <p className="text-xs text-gray-500">Alert when moderation queue is full</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-queue-overflow-alerts" />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Export & Backup</Label>
                  <div className="space-y-3 mt-3">
                    <Button variant="outline" className="w-full" data-testid="button-export-settings">
                      <i className="fas fa-download mr-2"></i>
                      Export Configuration
                    </Button>
                    <Button variant="outline" className="w-full" data-testid="button-backup-data">
                      <i className="fas fa-database mr-2"></i>
                      Backup Data
                    </Button>
                    <Button variant="outline" className="w-full" data-testid="button-system-health">
                      <i className="fas fa-heartbeat mr-2"></i>
                      Run System Health Check
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
