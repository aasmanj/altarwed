param name string
param location string

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: name
  location: location
  sku: {
    name: 'B2'
    tier: 'Basic'
  }
  kind: 'linux'
  properties: {
    reserved: true  // required for Linux
  }
}

output planId string = plan.id
