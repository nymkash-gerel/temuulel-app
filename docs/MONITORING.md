# Monitoring & Alerting Setup

This guide covers the monitoring and alerting configuration for the Temuulel platform.

## Sentry Configuration

Sentry is already integrated. To complete the setup, configure alert rules in the Sentry dashboard.

### Prerequisites

1. Ensure `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are set in Vercel environment variables
2. Log in to [sentry.io](https://sentry.io) and navigate to your project

### Recommended Alert Rules

Configure these alerts at **Settings > Alerts > Create Alert**:

#### 1. Error Spike Alert (Critical)

Detects sudden increases in error rate.

```
Type: Issue Alert
Conditions:
  - When: An event is seen
  - If: The issue is seen more than 10 times in 5 minutes
Actions:
  - Send notification to: Default Sentry notifications
  - (Optional) Send Slack notification to #alerts channel
```

#### 2. New Issue Alert (High Priority)

Notifies when a new error type appears in production.

```
Type: Issue Alert
Conditions:
  - When: A new issue is created
  - If: The event's environment equals "production"
Actions:
  - Send notification to: Default Sentry notifications
```

#### 3. Unhandled Error Alert

Catches uncaught exceptions.

```
Type: Issue Alert
Conditions:
  - When: An event is seen
  - If: The event's tags["handled"] equals "no"
Actions:
  - Send notification to: Default Sentry notifications
```

#### 4. High Error Volume Alert

Detects sustained high error rates.

```
Type: Metric Alert
Metric: Number of Errors
Threshold: Critical when > 50 errors in 1 hour
Actions:
  - Send notification to: Default Sentry notifications
```

#### 5. API Latency Alert (P95)

Monitors API performance degradation.

```
Type: Metric Alert
Metric: Transaction Duration (p95)
Filter: transaction.op:http.server
Threshold: Warning when > 2000ms, Critical when > 5000ms
Actions:
  - Send notification to: Default Sentry notifications
```

#### 6. Database Latency Alert

Monitors slow database queries.

```
Type: Metric Alert
Metric: Span Duration (p95)
Filter: span.op:db
Threshold: Warning when > 500ms, Critical when > 1000ms
Actions:
  - Send notification to: Default Sentry notifications
```

### Quick Setup Checklist

- [ ] Create "Error Spike" alert (10+ errors in 5 min)
- [ ] Create "New Issue" alert for production
- [ ] Create "High Error Volume" metric alert (50+ errors/hour)
- [ ] Create "API Latency" metric alert (p95 > 2s warning, > 5s critical)
- [ ] (Optional) Connect Slack integration for real-time alerts
- [ ] (Optional) Connect email notifications for on-call rotation

### Slack Integration (Recommended)

1. Go to **Settings > Integrations > Slack**
2. Connect your workspace
3. Add `#temuulel-alerts` channel to receive notifications
4. Update alert rules to send to Slack channel

## Uptime Monitoring

The `/api/health` endpoint is designed for uptime monitoring.

### UptimeRobot Setup (Free)

1. Create account at [uptimerobot.com](https://uptimerobot.com)
2. Add new monitor:
   - Type: HTTP(s)
   - URL: `https://your-domain.com/api/health`
   - Interval: 5 minutes
3. Configure alert contacts (email, Slack, SMS)

### Health Endpoint Response

```json
{
  "status": "healthy",
  "checks": {
    "app": { "status": "ok" },
    "database": { "status": "ok", "latency_ms": 45 }
  },
  "uptime_seconds": 3600,
  "timestamp": "2026-02-19T12:00:00.000Z",
  "version": "0.1.0",
  "environment": "production"
}
```

- **200**: All systems operational
- **503**: Database or critical service degraded

## Vercel Analytics

Vercel provides built-in monitoring:

1. Go to Vercel Dashboard > Project > Analytics
2. Enable Web Analytics (free tier available)
3. Monitor Core Web Vitals (LCP, FID, CLS)

## Log Management

For production log analysis, consider:

- **Axiom**: Free tier with 500GB/month ingest
- **Logtail**: Better Vercel integration
- **Vercel Logs**: Limited to 1 hour retention on free tier

## Incident Response

When an alert fires:

1. Check Sentry for error details and stack trace
2. Check `/api/health` for system status
3. Check Vercel deployment logs
4. If database-related, check Supabase dashboard
5. Rollback if needed: `git revert HEAD && git push`
