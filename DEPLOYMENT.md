# BC Inventory - Deployment Guide

## Pre-Deployment Checklist

### Code Review
- [ ] All code reviewed and approved
- [ ] No console.log() statements in production code
- [ ] No commented-out code blocks
- [ ] All TODOs resolved or documented
- [ ] Code follows style guide
- [ ] No hardcoded credentials

### Testing
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual testing completed
- [ ] Cross-browser testing done
- [ ] Mobile device testing done
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed

### Documentation
- [ ] README updated
- [ ] API documentation current
- [ ] User guide written
- [ ] Changelog updated
- [ ] Known issues documented

### Database
- [ ] Migrations tested
- [ ] Rollback plan prepared
- [ ] Database backup created
- [ ] Seed data prepared (if needed)

### Configuration
- [ ] Environment variables set
- [ ] API keys configured
- [ ] Database connection strings updated
- [ ] CORS settings correct
- [ ] Security headers configured

---

## Deployment Steps

### 1. Merge Feature Branch

```bash
# Ensure feature branch is up to date
git checkout feature/issue-1-mobile-ui
git pull origin feature/issue-1-mobile-ui

# Switch to main branch
git checkout main
git pull origin main

# Merge feature branch
git merge feature/issue-1-mobile-ui

# Resolve any conflicts
# Test merged code locally

# Push to main
git push origin main
```

### 2. Create Release Tag

```bash
# Create annotated tag
git tag -a v1.1.0 -m "Release v1.1.0 - Device-Specific UI Enhancements"

# Push tag to remote
git push origin v1.1.0
```

### 3. Build for Production

```bash
# Install production dependencies only
npm ci --production

# Run any build scripts
npm run build

# Minify assets (if applicable)
npm run minify
```

### 4. Database Migration

```bash
# Backup current database
pg_dump bcinv > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
npm run migrate

# Verify migration success
npm run migrate:status
```

### 5. Deploy Application

#### Option A: Manual Deployment

```bash
# SSH to server
ssh user@your-server.com

# Navigate to app directory
cd /var/www/bcinv

# Pull latest code
git pull origin main

# Install dependencies
npm ci --production

# Restart application
pm2 restart bcinv

# Check status
pm2 status
pm2 logs bcinv --lines 50
```

#### Option B: Docker Deployment

```bash
# Build Docker image
docker build -t bcinv:v1.1.0 .

# Tag for registry
docker tag bcinv:v1.1.0 your-registry.com/bcinv:v1.1.0

# Push to registry
docker push your-registry.com/bcinv:v1.1.0

# Deploy to server
ssh user@your-server.com
docker pull your-registry.com/bcinv:v1.1.0
docker stop bcinv
docker rm bcinv
docker run -d --name bcinv \
  -p 3000:3000 \
  --env-file .env \
  your-registry.com/bcinv:v1.1.0
```

### 6. Post-Deployment Verification

```bash
# Health check
curl https://your-domain.com/api/health

# Check logs for errors
tail -f /var/log/bcinv/error.log

# Monitor performance
htop
```

---

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bcinv

# Server
PORT=3000
NODE_ENV=production

# Security
SESSION_SECRET=your-secret-key-here
CORS_ORIGIN=https://your-domain.com

# Optional: Camera/Scanner
CAMERA_DEFAULT=environment

# Optional: Exports
EXPORT_MAX_ROWS=10000
```

---

## Rollback Plan

### If Deployment Fails

1. **Revert Code**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Restore Database**
   ```bash
   psql bcinv < backup_YYYYMMDD_HHMMSS.sql
   ```

3. **Restart Previous Version**
   ```bash
   pm2 restart bcinv
   ```

4. **Notify Users**
   - Update status page
   - Send notification email
   - Post in Slack channel

---

## Monitoring

### Health Checks
- [ ] `/api/health` endpoint responding
- [ ] Database connections active
- [ ] No error spikes in logs
- [ ] Response times normal
- [ ] CPU/Memory usage normal

### Metrics to Monitor
- Request rate (requests/second)
- Error rate (errors/minute)
- Response time (95th percentile)
- Database query time
- Active connections
- Memory usage
- CPU usage

### Alert Thresholds
- Response time > 5 seconds
- Error rate > 5%
- Memory usage > 80%
- CPU usage > 80%
- Disk space < 20%

---

## Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Monitor error logs
- [ ] Check user feedback
- [ ] Verify all features working
- [ ] Performance metrics normal
- [ ] Database queries optimized

### Short-term (Week 1)
- [ ] User training completed
- [ ] Documentation distributed
- [ ] Support tickets reviewed
- [ ] Known issues logged
- [ ] Performance report generated

### Long-term (Month 1)
- [ ] User satisfaction survey
- [ ] Feature usage analytics
- [ ] Performance trends analyzed
- [ ] Optimization opportunities identified
- [ ] Next sprint planned

---

## Troubleshooting

### Common Issues

#### Issue: App won't start
**Check**:
- Environment variables set correctly
- Database connection string valid
- Port not already in use
- Node version compatible

#### Issue: Database connection errors
**Check**:
- PostgreSQL running
- Credentials correct
- Network connectivity
- Firewall rules

#### Issue: High memory usage
**Check**:
- Memory leaks in code
- Database connection pooling
- Large file uploads
- Caching strategy

#### Issue: Slow response times
**Check**:
- Database query performance
- Missing indexes
- N+1 query problems
- Network latency

---

## Support Contacts

### Development Team
- **Lead Developer**: dev@example.com
- **DevOps**: devops@example.com
- **DBA**: dba@example.com

### Emergency Contacts
- **On-call**: +1-555-0100
- **Slack**: #bcinv-support
- **Email**: support@example.com

---

## Version History

### v1.1.0 (Feb 2, 2026)
- Device-specific UI enhancements
- Mobile-first navigation
- Camera barcode scanning
- Batch tracking with FIFO
- Desktop export menu
- Accessibility improvements
- Performance optimizations

### v1.0.0 (Jan 1, 2026)
- Initial release
- Basic inventory management
- Product CRUD operations
- Stock tracking
- Export functionality

---

**Last Updated**: February 2, 2026  
**Deployment Version**: v1.1.0  
**Issue**: #1 - Device-Specific UI
