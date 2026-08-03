param name string
param location string

// Instance count baseline (issue #376). The historical "keep at 1" guard is gone:
// issue #109 shipped (PR #454 moved the rate-limit buckets, RSVP throttle, and
// OAuth CSRF state behind a shared store), and main.bicep now provisions the
// Redis that backs it and wires REDIS_URL, so instances no longer multiply rate
// limits or break OAuth callbacks. Two instances is the HA floor: one can restart
// (crash, deploy) while the other keeps the public wedding sites up.
@description('App Service Plan instance count baseline; autoscale floor matches this.')
@minValue(1)
@maxValue(3)
param capacity int = 2

// Tier ladder (issue #376). B2 (Basic) is the committed default at today's scale
// (~12 couples): it supports MANUAL scale-out to 3 instances, which is all HA
// needs, but no autoscale and no deployment slots. P1v3 (PremiumV3, 2 vCPU/8 GB)
// adds autoscale, a real staging slot for zero-downtime swaps (#379), and BCrypt
// headroom (signup/login are synchronous BCrypt-12 hashes, the most CPU-expensive
// request in the system); step up to it for the marketing push by passing
// planSku=P1v3 at deploy time, no template edit needed. S1 is the cheap middle
// step if autoscale/slots are wanted before Premium prices are.
@description('Plan SKU. B2 = HA-capable baseline (manual scale only); S1/P1v3 add autoscale + staging slot.')
@allowed(['B2', 'S1', 'P1v3'])
param skuName string = 'B2'

var skuTiers = {
  B2: 'Basic'
  S1: 'Standard'
  P1v3: 'PremiumV3'
}

// Basic tier cannot have autoscale settings or slots; both are gated on this.
var supportsAutoscale = skuName != 'B2'

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: name
  location: location
  sku: {
    name: skuName
    tier: skuTiers[skuName]
    capacity: capacity
  }
  kind: 'linux'
  properties: {
    reserved: true  // required for Linux
  }
}

// Autoscale, deployed and enabled ONLY on tiers that support it (Basic does not;
// deploying autoscale settings against a Basic plan fails the apply). The #109
// Redis gate is satisfied, so instances no longer multiply rate limits.
//
// Rule shape: scale OUT when average CPU > 65% for 5 min (add 1, cool down 5 min),
// scale IN when average CPU < 30% for 10 min (remove 1, cool down 10 min). The
// asymmetric windows (out fast, in slow) avoid flapping around a steady load.
// Floor is 2, matching the capacity baseline: autoscale owns the instance count
// once enabled, and a floor of 1 would quietly scale the HA pair back down to a
// single point of failure on the first quiet night.
resource autoscale 'Microsoft.Insights/autoscalesettings@2022-10-01' = if (supportsAutoscale) {
  name: '${name}-autoscale'
  location: location
  properties: {
    enabled: true
    targetResourceUri: plan.id
    profiles: [
      {
        name: 'cpu-scale-out'
        capacity: {
          minimum: '2'
          maximum: '3'
          default: '2'
        }
        rules: [
          {
            // Scale OUT: sustained CPU pressure means the BCrypt hashing box is hot.
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: plan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 65
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            // Scale IN: give it back only once load is clearly gone, slow window.
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: plan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: 30
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT10M'
            }
          }
        ]
      }
    ]
  }
}

output planId string = plan.id
