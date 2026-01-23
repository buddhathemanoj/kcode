"use client"

import { useSetAtom } from "jotai"
import { useState } from "react"
import { KeyFilledIcon, IconSpinner } from "../../components/ui/icons"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Logo } from "../../components/ui/logo"
import { apiKeyOnboardingCompletedAtom } from "../../lib/atoms"
import { trpc } from "../../lib/trpc"

export function AzureOnboardingPage() {
  const setApiKeyOnboardingCompleted = useSetAtom(apiKeyOnboardingCompletedAtom)

  const [endpoint, setEndpoint] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [deploymentName, setDeploymentName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveConfigMutation = trpc.claudeCode.saveConfig.useMutation()
  const testConnectionMutation = trpc.claudeCode.testConnection.useMutation()

  const isFormValid = endpoint.trim() && apiKey.trim() && deploymentName.trim()

  const handleSubmit = async () => {
    if (!isFormValid) return

    setIsSubmitting(true)
    setError(null)

    try {
      // Test connection first
      const testResult = await testConnectionMutation.mutateAsync({
        endpoint: endpoint.trim(),
        apiKey: apiKey.trim(),
        deploymentName: deploymentName.trim(),
      })

      if (!testResult.success) {
        setError(testResult.message)
        setIsSubmitting(false)
        return
      }

      // Save config
      await saveConfigMutation.mutateAsync({
        endpoint: endpoint.trim(),
        apiKey: apiKey.trim(),
        deploymentName: deploymentName.trim(),
      })

      // Mark onboarding as completed
      setApiKeyOnboardingCompleted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo className="w-12 h-12" />
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Configure Azure Claude API
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your Azure OpenAI credentials to connect to Claude
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="endpoint">Azure Endpoint</Label>
            <Input
              id="endpoint"
              type="url"
              placeholder="https://your-resource.openai.azure.com"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Your Azure OpenAI resource endpoint URL
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter your Azure API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deploymentName">Deployment Name</Label>
            <Input
              id="deploymentName"
              type="text"
              placeholder="claude-sonnet"
              value={deploymentName}
              onChange={(e) => setDeploymentName(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              The name of your Claude model deployment
            </p>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="w-full h-11 bg-primary text-primary-foreground rounded-md font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {isSubmitting ? (
              <>
                <IconSpinner className="w-4 h-4 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <KeyFilledIcon className="w-4 h-4" />
                <span>Connect</span>
              </>
            )}
          </button>
        </div>

        {/* Help text */}
        <p className="text-xs text-center text-muted-foreground">
          Your credentials are stored securely on your device using OS-level encryption.
        </p>
      </div>
    </div>
  )
}
