import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AIModelStatus, AbuseLexicon, DatasetMetadata, TextModelVersionInfo, TrainTextModelResult } from "@/lib/types";
import {
  downloadTextAsFile,
  exportTableToPdf,
  keyValueToRows,
  parseCsvToTable,
  rowsToCsv,
  type ExportFormat,
} from "@/lib/export";

export default function Settings() {
  const { toast } = useToast();
  const [aiSettings, setAiSettings] = useState({
    textThreshold: 0.7,
    imageThreshold: 0.8,
    autoBlock: true,
    multiLanguage: true,
    realTimeProcessing: true,
  });

  const [datasetName, setDatasetName] = useState("");
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [lastTrainResult, setLastTrainResult] = useState<TrainTextModelResult | null>(null);

  const [blockTermsText, setBlockTermsText] = useState("");
  const [reviewTermsText, setReviewTermsText] = useState("");
  const [selectedTextModelVersion, setSelectedTextModelVersion] = useState<string>("");

  // Fetch AI model status
  const { data: aiModels } = useQuery<AIModelStatus[]>({
    queryKey: ['/api/ai/models'],
  });

  const { data: textDatasets } = useQuery<DatasetMetadata[]>({
    queryKey: ['/api/datasets/text'],
  });

  // Fetch reputation config
  const { data: reputationConfig } = useQuery<any>({
    queryKey: ['/api/reputation/config'],
  });

  const { data: lexicon } = useQuery<AbuseLexicon>({
    queryKey: ['/api/moderation/lexicon'],
  });

  const { data: textModels } = useQuery<TextModelVersionInfo[]>({
    queryKey: ['/api/ai/text-models'],
  });

  useEffect(() => {
    if (!lexicon) return;
    setBlockTermsText((lexicon.blockTerms || []).join("\n"));
    setReviewTermsText((lexicon.reviewTerms || []).join("\n"));
  }, [lexicon]);

  useEffect(() => {
    if (selectedTextModelVersion) return;
    if (textModels && textModels.length > 0) {
      setSelectedTextModelVersion(textModels[0].version);
    }
  }, [textModels, selectedTextModelVersion]);

  const parseTerms = (text: string) => {
    return text
      .split(/\r?\n/g)
      .map((t) => t.trim())
      .filter(Boolean);
  };

  const lexiconStats = useMemo(() => {
    const block = parseTerms(blockTermsText).length;
    const review = parseTerms(reviewTermsText).length;
    return { block, review };
  }, [blockTermsText, reviewTermsText]);

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
      const res = await apiRequest('POST', '/api/ai/health-check', { modelName });
      const json = await res.json();
      const data = (json && typeof json === 'object' && 'data' in json) ? (json as any).data : json;

      await queryClient.invalidateQueries({ queryKey: ['/api/ai/models'] });

      toast({
        title: "Health check completed",
        description: `${modelName}: ${data.status}${data.message ? ` - ${data.message}` : ''}`,
      });
    } catch (error) {
      toast({
        title: "Health check failed",
        description: `Error checking ${modelName} status.`,
        variant: "destructive",
      });
    }
  };

  const handleTrainTextModel = async () => {
    if (!datasetFile) {
      toast({
        title: "Dataset required",
        description: "Please choose a CSV file before training.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsTraining(true);
      const token = localStorage.getItem("auth_token");
      const form = new FormData();
      form.append("dataset", datasetFile);
      if (datasetName.trim()) {
        form.append("datasetName", datasetName.trim());
      }

      const res = await fetch("/api/ai/train/text", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Training failed");
      }

      const json = await res.json();
      const data = (json && typeof json === "object" && "data" in json) ? (json as any).data : json;
      setLastTrainResult(data as TrainTextModelResult);

      toast({
        title: "Training complete",
        description: `Text model v${data.modelVersion} trained (accuracy ${(data.holdoutAccuracy * 100).toFixed(1)}%).`,
      });

      queryClient.invalidateQueries({ queryKey: ['/api/ai/models'] });
      queryClient.invalidateQueries({ queryKey: ['/api/datasets/text'] });
    } catch (error: any) {
      toast({
        title: "Training failed",
        description: error?.message || "Unable to train text model.",
        variant: "destructive",
      });
    } finally {
      setIsTraining(false);
    }
  };

  const handleSaveLexicon = async () => {
    try {
      const blockTerms = parseTerms(blockTermsText);
      const reviewTerms = parseTerms(reviewTermsText);

      await apiRequest('PUT', '/api/moderation/lexicon', { blockTerms, reviewTerms });
      await queryClient.invalidateQueries({ queryKey: ['/api/moderation/lexicon'] });

      toast({
        title: 'Lexicon updated',
        description: `Saved ${blockTerms.length} block terms and ${reviewTerms.length} review terms.`,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to update lexicon',
        description: error?.message || 'Unable to save lexicon.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadManualTrainingExport = async (format: ExportFormat) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/moderation/training/export-text', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Export failed');
      }

      const csvText = await res.text();

      if (format === "csv") {
        downloadTextAsFile(csvText, 'manual-review-training-text.csv', 'text/csv;charset=utf-8');
        return;
      }

      const { columns, rows } = parseCsvToTable(csvText);
      exportTableToPdf({
        title: "Manual Review Training Export",
        filename: "manual-review-training-text.pdf",
        tables: [
          {
            columns,
            rows,
          },
        ],
      });
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error?.message || 'Unable to export training dataset.',
        variant: 'destructive',
      });
    }
  };

  const handleExportConfiguration = async (format: ExportFormat) => {
    try {
      const exportedAt = new Date().toISOString();
      const configObj = {
        exportedAt,
        aiSettings,
        textModelVersionActive: selectedTextModelVersion || null,
        lexicon: {
          blockTerms: parseTerms(blockTermsText),
          reviewTerms: parseTerms(reviewTermsText),
        },
        reputationConfig: reputationConfig || null,
      };

      const rows = keyValueToRows(configObj);
      const columns = ["key", "value"];

      if (format === "csv") {
        const csv = rowsToCsv(rows, columns);
        downloadTextAsFile(csv, "system-configuration.csv", "text/csv;charset=utf-8");
        return;
      }

      exportTableToPdf({
        title: "System Configuration Export",
        filename: "system-configuration.pdf",
        tables: [
          {
            headerLabel: "Key / Value",
            columns,
            rows,
          },
        ],
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error?.message || "Unable to export configuration.",
        variant: "destructive",
      });
    }
  };

  const handleActivateTextModel = async () => {
    if (!selectedTextModelVersion) return;
    try {
      await apiRequest('POST', '/api/ai/text-models/activate', { modelVersion: selectedTextModelVersion });
      await queryClient.invalidateQueries({ queryKey: ['/api/ai/models'] });
      toast({
        title: 'Text model activated',
        description: `Now using v${selectedTextModelVersion}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Activation failed',
        description: error?.message || 'Unable to activate selected model.',
        variant: 'destructive',
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
                  {aiModels?.map((model: AIModelStatus) => (
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

            {/* Text Dataset & Training */}
            <Card>
              <CardHeader>
                <CardTitle>Text Datasets & Training</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="dataset-file">Upload CSV Dataset</Label>
                  <Input
                    id="dataset-file"
                    type="file"
                    accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setDatasetFile(file);
                      if (file && !datasetName) {
                        setDatasetName(file.name.replace(/\.csv$/i, ""));
                      }
                    }}
                    data-testid="input-dataset-file"
                  />
                  <p className="text-xs text-gray-500">
                    Supported schemas include: <code>text</code> + <code>label</code> (optional <code>language</code>),
                    <code>text</code> + <code>hate_label</code> (0/1), <code>tweet</code> + <code>class</code> (0/1/2),
                    and <code>Post</code> + <code>Labels Set</code>.
                  </p>
                </div>

                <div>
                  <Label htmlFor="dataset-name">Dataset Name</Label>
                  <Input
                    id="dataset-name"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    placeholder="e.g. Kaggle Toxic Comments v1"
                    className="mt-1"
                    data-testid="input-dataset-name"
                  />
                </div>

                <Button
                  onClick={handleTrainTextModel}
                  disabled={isTraining || !datasetFile}
                  className="w-full"
                  data-testid="button-train-text-model"
                >
                  <i className="fas fa-brain mr-2"></i>
                  {isTraining ? "Training..." : "Train Text Model"}
                </Button>

                {lastTrainResult && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                    <p className="font-semibold mb-1">
                      Latest training: v{lastTrainResult.modelVersion} ·
                      accuracy {(lastTrainResult.holdoutAccuracy * 100).toFixed(1)}%
                    </p>
                    <p>
                      {lastTrainResult.rowCount} rows · vocabulary {lastTrainResult.vocabularySize} tokens
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Recent Datasets</Label>
                    <span className="text-xs text-gray-500">
                      {textDatasets?.length || 0} uploaded
                    </span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {textDatasets?.length ? (
                      textDatasets.map((ds) => (
                        <div key={ds.id} className="border rounded-md p-2 text-xs flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate" title={ds.name}>{ds.name}</span>
                            <span className="text-gray-500">
                              {new Date(ds.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(ds.labelCounts).map(([label, count]) => (
                              <Badge key={label} variant="outline" className="text-[10px]">
                                {label}: {count}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-gray-500">
                            <span>Rows: {ds.rowCount}</span>
                            <span>Lang: {ds.languages.join(", ")}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">No datasets uploaded yet.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Text Model Versions */}
            <Card>
              <CardHeader>
                <CardTitle>Text Model Versions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Roll back to an older model by activating a previous version.
                </p>
                {textModels && textModels.length > 0 ? (
                  <>
                    <Label htmlFor="text-model-version">Select Version</Label>
                    <select
                      id="text-model-version"
                      aria-label="Text model version"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={selectedTextModelVersion}
                      onChange={(e) => setSelectedTextModelVersion(e.target.value)}
                      data-testid="select-text-model-version"
                    >
                      {textModels.map((m) => (
                        <option key={m.version} value={m.version}>
                          v{m.version}{m.trainedAt ? ` • ${new Date(m.trainedAt).toLocaleString()}` : ''}
                        </option>
                      ))}
                    </select>
                    <Button onClick={handleActivateTextModel} className="w-full" data-testid="button-activate-text-model">
                      <i className="fas fa-rotate-left mr-2"></i>
                      Activate Selected Model
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No trained models found yet.</p>
                )}
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

            {/* Abuse Lexicon */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Abuse Lexicon</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Terms in <strong>Block</strong> are immediately rejected. Terms in <strong>Review</strong> are flagged.
                  Matching includes basic normalization to catch spacing/punctuation/repeat-character bypasses.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lexicon-block">Block terms</Label>
                    <Textarea
                      id="lexicon-block"
                      value={blockTermsText}
                      onChange={(e) => setBlockTermsText(e.target.value)}
                      rows={8}
                      placeholder="One term per line"
                      data-testid="textarea-lexicon-block"
                    />
                    <p className="text-xs text-gray-500">{lexiconStats.block} terms</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lexicon-review">Review terms</Label>
                    <Textarea
                      id="lexicon-review"
                      value={reviewTermsText}
                      onChange={(e) => setReviewTermsText(e.target.value)}
                      rows={8}
                      placeholder="One term per line"
                      data-testid="textarea-lexicon-review"
                    />
                    <p className="text-xs text-gray-500">{lexiconStats.review} terms</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <Button onClick={handleSaveLexicon} data-testid="button-save-lexicon">
                    <i className="fas fa-save mr-2"></i>
                    Save Lexicon
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" data-testid="button-export-manual-training">
                        <i className="fas fa-download mr-2"></i>
                        Export Manual Reviews
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownloadManualTrainingExport("csv")}>
                        Download CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadManualTrainingExport("pdf")}>
                        Download PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full" data-testid="button-export-settings">
                          <i className="fas fa-download mr-2"></i>
                          Export Configuration
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExportConfiguration("csv")}>
                          Download CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportConfiguration("pdf")}>
                          Download PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
