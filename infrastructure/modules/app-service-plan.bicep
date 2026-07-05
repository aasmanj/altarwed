param name string
param location string

// Instance count baked into the committed default.
//
// WHY 1 AND NOT 2: the backend rate limiter (RateLimitingFilter) and the Resend
// send pacer (RESEND_RATE_LIMIT_PER_SECOND=2/sec) are in-memory and PER INSTANCE.
// Every extra instance multiplies both: 2 instances = 4/sec of Resend traffic
// against a 5/sec account cap, and the login/RSVP rate limits double, so an
// attacker gets 2x the allowance. Issue #109 moves those buckets to Redis (a
// shared store). Until #109 lands, running more than one instance silently
// degrades those limits, so the committed default stays at 1.
//
// TO SCALE OUT (only after #109 Redis ships): raise this to 2 (or more) and, if
// desired, flip the autoscale resource below to enabled: true. Both are one-line
// changes, intentionally left off so a plain `az deployment group create` cannot
// multiply the rate limits by surprise.
@description('App Service Plan instance count. Keep at 1 until issue #109 (Redis) ships; then raise to 2+.')
@minValue(1)
@maxValue(3)
param capacity int = 1

// P1v3 (PremiumV3): 2 vCPU / 8 GB, the first tier that supports both autoscale
// and a real (non-shared) deployment slot for zero-downtime swaps. B2 (Basic)
// supports neither. Signup and login are synchronous BCrypt-12 hashes, the most
// CPU-expensive request in the system, so headroom + horizontal scale during the
// marketing push is the load-bearing reason to move off a single Basic box.
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: name
  location: location
  sku: {
    name: 'P1v3'
    tier: 'PremiumV3'
    capacity: capacity
  }
  kind: 'linux'
  properties: {
    reserved: true  // required for Linux
  }
}

// Autoscale, staged but DISABLED by default (enabled: false).
//
// WHY DISABLED: autoscale would spin up 2-3 instances under load, and every extra
// instance multiplies the in-memory rate limiter and the Resend pacer (see the
// capacity note above). Enabling this before issue #109 (Redis) would let a CPU
// spike silently blow past the Resend 5/sec account cap and weaken the login/RSVP
// limits. It is defined here so the rule set is reviewed and ready; flip
// enabled: true in the SAME change that raises capacity, and only after #109.
//
// Rule shape: scale OUT when average CPU > 65% for 5 min (add 1, cool down 5 min),
// scale IN when average CPU < 30% for 10 min (remove 1, cool down 10 min). The
// asymmetric windows (out fast, in slow) avoid flapping around a steady load.
resource autoscale 'Microsoft.Insights/autoscalesettings@2022-10-01' = {
  name: '${name}-autoscale'
  location: location
  properties: {
    enabled: false  // gated on issue #109 (Redis); do not enable until then
    targetResourceUri: plan.id
    profiles: [
      {
        name: 'cpu-scale-out'
        capacity: {
          minimum: '1'
          maximum: '3'
          default: '1'
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
