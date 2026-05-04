// Targeted deployment — provisions ONLY the frontend-app Static Web App.
// Run this once to create the resource and capture the deploy token.
// All other infrastructure is already live; avoid re-running main.bicep
// just to add one resource (it would re-validate all secret references).

param location string = resourceGroup().location
param environment string = 'prod'

var name = 'altarwed-${environment}-app'

resource swa 'Microsoft.Web/staticSites@2023-01-01' = {
  name: name
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

output defaultHostname string = swa.properties.defaultHostname
// listSecrets() is the only way to retrieve the deploy token via ARM.
// This output is marked sensitive in the Azure portal and not logged in plain text.
output deployToken string = swa.listSecrets().properties.apiKey
