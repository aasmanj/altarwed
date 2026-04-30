# AltarWed Infrastructure

Azure Bicep IaC for all core resources.

## Resources provisioned
- App Service Plan (Linux B2)
- App Service (Java 21, Spring Boot backend)
- Azure SQL Server + Database (Basic 5 DTU)
- Key Vault (RBAC mode, stores all secrets)
- Blob Storage (altarwed-media container, public blob access)

## Deploy

### Prerequisites
```bash
az login
az account set --subscription YOUR_SUBSCRIPTION_ID
```

### First-time deploy
```bash
az group create --name altarwed-rg --location eastus2

az deployment group create \
  --resource-group altarwed-rg \
  --template-file main.bicep \
  --parameters environment=prod \
               sqlAdminUsername=altarwed-admin \
               sqlAdminPassword='YOUR_STRONG_PASSWORD' \
               jwtSecret='YOUR_JWT_SECRET_MIN_32_CHARS' \
               resendApiKey='YOUR_RESEND_KEY'
```

### Subsequent deploys (idempotent)
Same command — Bicep is declarative, re-running updates only what changed.

## Secrets flow
App Service uses Key Vault references in app settings — secrets are never stored in the app config directly. The App Service managed identity is granted `Key Vault Secrets User` role automatically.

## Scale up
When traffic grows, change the App Service Plan SKU in `modules/app-service-plan.bicep`:
- B2 → B3 (more RAM, same price tier)  
- B3 → P1v3 (production-grade, auto-scale capable)
