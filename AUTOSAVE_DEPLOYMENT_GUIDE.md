# Autosave Feature - Deployment & Operations Guide

## 📋 Pre-Deployment Checklist

### Code Quality
- [ ] All TypeScript types properly defined
- [ ] No console.error statements (except logger)
- [ ] Error boundaries in place
- [ ] Try-catch blocks cover all async operations
- [ ] No hardcoded values (all configurable)

### Testing
- [ ] Basic functionality tested (type and see "saved")
- [ ] Debounce tested (rapid typing = 1 save)
- [ ] Throttling tested (2s minimum between saves)
- [ ] Offline mode tested
- [ ] Error scenarios tested
- [ ] Manual "Save Draft" still works
- [ ] Form validation still works

### Database
- [ ] Supabase upsert() verified working
- [ ] All field mappings correct
- [ ] Status field defaults to 'draft'
- [ ] updated_at auto-updates
- [ ] No permission errors on insert/update
- [ ] Backup exists

### Documentation
- [ ] All docs created and reviewed
- [ ] Examples tested and working
- [ ] Troubleshooting section complete
- [ ] Team trained on new feature

### Performance
- [ ] localStorage not exceeding limits
- [ ] Network requests reasonable frequency
- [ ] No memory leaks during long sessions
- [ ] CPU usage minimal (debounce working)

---

## 🚀 Deployment Steps

### Step 1: Final Code Review

```bash
# Review changes
git diff src/pages/Apply.tsx
git diff src/hooks/useAutoSave.ts
git diff src/components/SaveStatusIndicator.tsx

# Verify imports work
npm run build  # Should have no errors
```

### Step 2: Test in Staging

```bash
# Deploy to staging environment
vercel deploy --prod  # or your staging deployment

# Test autosave
1. Go to staging Apply form
2. Type data
3. Wait 900ms
4. See "All changes saved"
5. Refresh page
6. Data persists
7. Check staging database
```

### Step 3: Monitor Before Full Deploy

```bash
# Run for 1-2 hours on staging
# Monitor:
- Network requests (POST to tutor_applications)
- Supabase logs for errors
- Browser console for warnings
- Database for data corruption
- Performance metrics
```

### Step 4: Production Deployment

```bash
# Merge to main
git merge feature/autosave-implementation

# Tag release
git tag -a v1.x.x -m "Add autosave feature"
git push origin v1.x.x

# Deploy to production
vercel --prod

# Verify deployment
# Wait 5 minutes for deployment to finish
```

### Step 5: Post-Deployment Monitoring

```bash
# First 24 hours: Active monitoring
- Check error logs every hour
- Monitor database writes
- Track user sessions with autosave
- Gather user feedback

# First week: Regular checks
- Monitor error rates (should be <0.1%)
- Check database growth (normal?)
- Review slow queries
- Collect user feedback

# Ongoing: Weekly reviews
- Error trend analysis
- Performance metrics
- User adoption rate
- Feature effectiveness
```

---

## 🔍 Monitoring & Alerting

### Key Metrics to Monitor

```
REAL-TIME DASHBOARD:

Autosave Success Rate
  Target: > 99%
  Alert if: < 98%
  What to check: Supabase logs for errors

Failed Saves
  Target: < 1 per minute
  Alert if: > 5 per minute
  What to check: Network errors, Supabase down

Save Frequency
  Expected: 1 per ~2-5 seconds during active typing
  Alert if: > 1 per second (throttle not working)
  Alert if: < 1 per 10 seconds (debounce too long)

Database Write Frequency
  Expected: 1 write per application user per ~2 seconds
  Alert if: Spike in writes (check for infinite loop)

Offline Users
  Expected: 0 during normal operation
  Alert if: > 5% of users (network issue)

localStorage Usage
  Expected: < 100 KB per user
  Alert if: > 1 MB (leak detected)
```

### Logging Points

```typescript
// useAutoSave.ts already has logging at:

logger.log('Autosave successful for application:', applicationId);
logger.log('No changes detected, skipping autosave');
logger.error('Autosave failed:', error);
logger.log('Autosave stored in localStorage:', key);
logger.error('Failed to save to localStorage:', error);

// Check these in production logs
```

### Setting Up Alerts

**Supabase:**
```
Go to project → Logs
Filter: tutor_applications
Alert if errors appear
```

**Vercel Analytics:**
```
Go to project → Analytics
Monitor: API response times
Alert if > 2000ms
```

**Browser Monitoring (optional):**
```
Add to your monitoring service:
- Track useAutoSave errors
- Track failed saves
- Track offline duration
```

---

## 📊 Performance Baselines

### Expected Database Load

```
WITHOUT AUTOSAVE:
- 1 write per manual save (~1-2 per form per session)
- ~10,000 writes per day (100 concurrent users)

WITH AUTOSAVE:
- 1 write per 2-5 seconds during active typing
- Each user typing for 5 minutes = 60-150 writes
- ~50,000 writes per day (100 concurrent users typing simultaneously)
  [More writes, but more distributed, better UX]

ACCEPTABLE LOAD:
Supabase free tier: 50K operations/month = fine
Supabase pro tier: unlimited = no problem
```

### Network Impact

```
Requests per user per session:

WITHOUT autosave:    1-5 requests
WITH autosave:       50-300 requests (spread over 5-10 minutes)

Per-request payload:  2-5 KB
Total data:           100-1500 KB per session
Compression (gzip):   30-50 KB per session

Acceptable for:
- Mobile (< 2MB per session) ✅
- Slow connections ✅
- Users in developing regions ✅
```

---

## 🔧 Configuration After Deployment

### Tuning Autosave Delay

**If users complain about "too frequent" saves:**
```typescript
// In Apply.tsx, increase debounce
debounceMs: 1500,  // was 900ms
```

**If users complain about "delayed saves":**
```typescript
// In Apply.tsx, decrease debounce
debounceMs: 500,   // was 900ms
```

**Monitor impact for 24 hours, then commit if satisfied**

### Tuning Throttle Interval

**If database write load is too high:**
```typescript
// In useAutoSave.ts, increase minimum interval
if (now - lastSaveTimeRef.current < 3000) {  // was 2000ms
  return;
}
```

**If users report delayed saves despite waiting:**
```typescript
// In useAutoSave.ts, decrease minimum interval
if (now - lastSaveTimeRef.current < 1000) {  // was 2000ms
  return;
}
```

---

## 🚨 Troubleshooting Common Issues

### Issue: "Autosave not working for some users"

**Diagnosis:**
1. Check browser console for errors
2. Check Supabase logs for permission errors
3. Verify user is authenticated
4. Check if applicationId exists

**Solution:**
```
1. Verify Supabase RLS policies allow insert/update
2. Check user has valid session
3. Ensure application is created before form loads
4. Check network connectivity
```

---

### Issue: "Database filling up too fast"

**Diagnosis:**
1. Check write frequency (should be 1 per 2s)
2. Check for duplicate applications
3. Monitor failed saves (may be retrying)

**Solution:**
```
1. Increase throttle interval (3000ms instead of 2000ms)
2. Clean up duplicate draft applications
3. Fix any failed save loops
4. Monitor for infinite loop patterns
```

---

### Issue: "High CPU usage on browsers"

**Diagnosis:**
1. Check debounce delay (should be 900ms)
2. Check for rapid onChange triggers
3. Check React re-render frequency

**Solution:**
```
1. Increase debounce delay (1200ms instead of 900ms)
2. Optimize form inputs (memo components)
3. Check for unnecessary state updates
4. Profile with React DevTools
```

---

### Issue: "Offline users losing data"

**Diagnosis:**
1. Check localStorage is enabled
2. Check for storage quota errors
3. Verify sync on reconnection

**Solution:**
```
1. Ensure localStorage enabled in browser settings
2. Clear old drafts (set expiration)
3. Manually trigger sync when online
4. Show user warnings when offline
```

---

## 📈 Analytics & Reporting

### Weekly Report Template

```
AUTOSAVE FEATURE REPORT
Week of: [DATE]

METRICS:
- Active forms with autosave: [COUNT]
- Average saves per session: [NUMBER]
- Save success rate: [%]
- Average save time: [MS]
- Offline users encountered: [COUNT]

ERRORS:
- Database permission errors: [COUNT]
- Network timeouts: [COUNT]
- Storage quota exceeded: [COUNT]
- Other errors: [COUNT]

USER FEEDBACK:
- Positive comments: [SUMMARY]
- Issues reported: [SUMMARY]
- Improvement requests: [SUMMARY]

ACTIONS TAKEN:
- [ACTION 1]
- [ACTION 2]
- [ACTION 3]

NEXT WEEK:
- [PLAN 1]
- [PLAN 2]
```

---

## 🔐 Security Considerations

### Autosave Security Checklist

- [ ] Data sent over HTTPS only (Vercel/Supabase default)
- [ ] Supabase RLS policies verify user ownership
- [ ] No sensitive data in localStorage (only form draft)
- [ ] Rate limiting on API endpoints (Supabase default)
- [ ] No user PII in logs (check logger.ts)
- [ ] CORS properly configured
- [ ] No sensitive fields in unencrypted localStorage

### Recommended RLS Policy

```sql
-- Ensure users can only save their own applications
CREATE POLICY "Users can only manage their own applications"
ON tutor_applications
FOR ALL
USING (auth.uid() = user_id);

-- This should already exist, verify it's correct
SELECT * FROM auth.policies();
```

---

## 📝 Rollback Plan

**If autosave causes critical issues:**

### Option 1: Disable Autosave (Quick Fix)

```typescript
// In Apply.tsx, temporarily disable
enabled: false,  // Quick kill switch
```

```bash
git commit -m "Temporarily disable autosave"
vercel --prod
```

### Option 2: Revert to Previous Version

```bash
git revert HEAD --no-edit
vercel --prod
```

### Option 3: Hotfix Alternative Save Method

```typescript
// Fallback to manual save only while investigating
const { saveStatus } = useAutoSave({
  // ... props
  enabled: false,  // Disable until fixed
});
```

**After rollback:**
1. Analyze logs to find root cause
2. Fix the issue
3. Test thoroughly
4. Re-deploy

---

## 📚 Knowledge Base

### Create Internal Wiki

Document:
- How autosave works (link to AUTOSAVE_DOCUMENTATION.md)
- Common issues and fixes (link to AUTOSAVE_QUICK_REFERENCE.md)
- How to add to new forms (link to AUTOSAVE_CODE_EXAMPLES.md)
- Deployment procedures (this file)
- Monitoring dashboard setup
- Contact for feature requests

---

## 👥 Team Communication

### Notify Teams

**Developers:**
- Link to AUTOSAVE_INTEGRATION_GUIDE.md
- Show how to customize
- Share monitoring dashboard

**QA Team:**
- Share testing checklist
- Explain edge cases
- Provide test scenarios

**Support Team:**
- Explain what autosave does
- Share troubleshooting guide
- Provide common solutions

**Management:**
- Highlight benefits (no more data loss)
- Show performance impact (minimal)
- Report success metrics

---

## 🎯 Success Criteria (Post-Deployment)

After 1 week:
- ✅ Save success rate > 99%
- ✅ Zero critical errors
- ✅ User feedback positive
- ✅ Performance within baseline
- ✅ No data loss reported

After 1 month:
- ✅ Feature adopted by 80%+ of users
- ✅ Time-to-complete application reduced
- ✅ Saved-draft recovery used by users
- ✅ Offline mode useful to 5%+ users
- ✅ No regression in other features

---

## 📞 Escalation Path

**Issue Type → Escalate To:**

Minor bugs → Frontend Dev  
Database errors → Backend Dev  
Performance issues → DevOps  
User experience → Product Manager  
Security concerns → Security Team  
Production emergency → Tech Lead  

---

## ✅ Final Deployment Checklist

Before going live:

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation complete
- [ ] Team trained
- [ ] Monitoring configured
- [ ] Rollback plan ready
- [ ] Database backups current
- [ ] Performance baseline set
- [ ] Alerting configured
- [ ] Stakeholders notified

**Sign-off:** ________________  Date: ________

---

## 📞 Support

For issues post-deployment:

1. Check AUTOSAVE_QUICK_REFERENCE.md (troubleshooting)
2. Review monitoring dashboard
3. Check Supabase logs
4. Check browser console
5. Review deployment notes
6. Contact technical lead

**Feature is production-ready and fully supported.**
