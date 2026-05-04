@description('Name of the Static Web App resource')
param name string

@description('Azure region')
param location string

@description('SKU tier — Free for dev, Standard for custom domains + auth')
param sku string = 'Standard'

resource swa 'Microsoft.Web/staticSites@2023-01-01' = {
  name: name
  location: location
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    // GitHub integration is wired via GitHub Actions using the deploy token,
    // not the Bicep-native buildProperties — this keeps CI/CD portable.
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

output id string = swa.id
output defaultHostname string = swa.properties.defaultHostname
@description('Deploy token — save this as a GitHub secret')
output deployToken string = swa.listSecrets().properties.apiKey
