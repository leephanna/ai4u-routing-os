/* ═══════════════════════════════════════════════════════════
   AI4U Routing OS V4 — Supabase Persistence Layer
   supabase-persistence.js

   SECURITY:
   ✓ Uses public anon key only
   ✓ RLS policies on all tables enforce auth.uid() ownership
   ✗ Never put the service_role key in this file

   OFFLINE STRATEGY:
   Every write goes to localStorage first as the primary local
   store. If Supabase is configured and the user is signed in,
   the record is also written to Supabase. On failure the local
   record is marked sync_failed for retry via Sync Now.
═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var SB = {
    client:     null,
    user:       null,
    lastSynced: localStorage.getItem('ai4u_last_synced') || null,
    status:     'not-configured',
    statusMsg:  ''
  };

  /* ── Config resolution ──────────────────────────────────── */
  function getConfig() {
    var fc = global.AI4U_SUPABASE_CONFIG;
    if (fc && fc.url && fc.anonKey &&
        fc.url !== 'https://YOUR_PROJECT_REF.supabase.co') {
      return fc;
    }
    var url     = localStorage.getItem('ai4u_sb_url');
    var anonKey = localStorage.getItem('ai4u_sb_anon_key');
    if (url && anonKey) return { url: url, anonKey: anonKey };
    return null;
  }

  /* ── Initialize ─────────────────────────────────────────── */
  async function init() {
    var config = getConfig();
    if (!config) {
      setStatus('not-configured');
      updateStatusUI();
      return false;
    }

    if (global.supabaseFailed || typeof global.supabase === 'undefined') {
      setStatus('error', 'Supabase CDN failed to load — check network');
      updateStatusUI();
      return false;
    }

    try {
      SB.client = global.supabase.createClient(config.url, config.anonKey);
      setStatus('connecting');

      var res = await SB.client.auth.getSession();
      if (res.error) throw res.error;

      SB.user = res.data.session ? res.data.session.user : null;
      setStatus(SB.user ? 'connected' : 'auth-required');

      SB.client.auth.onAuthStateChange(function (_event, session) {
        SB.user = session ? session.user : null;
        setStatus(SB.user ? 'connected' : 'auth-required');
        updateStatusUI();
        if (typeof global.refreshIntelligence === 'function') {
          global.refreshIntelligence();
        }
      });

      updateStatusUI();
      return true;
    } catch (err) {
      setStatus('error', err.message || String(err));
      updateStatusUI();
      return false;
    }
  }

  /* ── Status helpers ─────────────────────────────────────── */
  function setStatus(s, msg) {
    SB.status    = s;
    SB.statusMsg = msg || '';
  }

  function canSync() {
    return SB.client !== null && SB.user !== null;
  }

  function markSynced() {
    SB.lastSynced = new Date().toISOString();
    localStorage.setItem('ai4u_last_synced', SB.lastSynced);
    var el = document.getElementById('sb-last-synced');
    if (el) el.textContent = 'Last synced: ' + new Date(SB.lastSynced).toLocaleString();
  }

  /* ── Auth ───────────────────────────────────────────────── */
  async function signIn(email, password) {
    if (!SB.client) {
      return { error: { message: 'Not initialized — save connection settings first.' } };
    }
    var result;
    if (password) {
      result = await SB.client.auth.signInWithPassword({ email: email, password: password });
    } else {
      result = await SB.client.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: global.location.href }
      });
    }
    if (!result.error) {
      SB.user = (result.data && result.data.user) ? result.data.user : null;
      setStatus(SB.user ? 'connected' : 'magic-link-sent');
      updateStatusUI();
    }
    return result;
  }

  async function signOut() {
    if (!SB.client) return;
    await SB.client.auth.signOut();
    SB.user = null;
    setStatus('auth-required');
    updateStatusUI();
  }

  /* ── Generic insert with local-only fallback ────────────── */
  async function sbInsert(table, payload) {
    if (!canSync()) return { local_only: true };
    var res = await SB.client
      .from(table)
      .insert(Object.assign({ user_id: SB.user.id }, payload))
      .select('id')
      .single();
    if (!res.error) markSynced();
    return { error: res.error || null, remote_id: res.data ? res.data.id : null };
  }

  /* ── Generic load ───────────────────────────────────────── */
  async function sbLoad(table, limit) {
    if (!canSync()) return [];
    var res = await SB.client
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit || 200);
    return res.error ? [] : (res.data || []);
  }

  /* ── Route Decisions ────────────────────────────────────── */
  async function saveRouteDecision(data)  { return sbInsert('route_decisions', data); }
  async function loadRouteDecisions()     { return sbLoad('route_decisions'); }

  /* ── Proof Receipts ─────────────────────────────────────── */
  async function saveProofReceipt(data)   { return sbInsert('proof_receipts', data); }
  async function loadProofReceipts()      { return sbLoad('proof_receipts'); }

  /* ── Outcome Logs ───────────────────────────────────────── */
  async function saveOutcomeLog(data)     { return sbInsert('outcome_logs', data); }
  async function loadOutcomeLogs()        { return sbLoad('outcome_logs'); }

  /* ── Success Patterns ───────────────────────────────────── */
  async function saveSuccessPattern(data) { return sbInsert('success_patterns', data); }
  async function loadSuccessPatterns()    { return sbLoad('success_patterns'); }

  /* ── Failure Rules ──────────────────────────────────────── */
  async function saveFailureRule(data)    { return sbInsert('failure_rules', data); }
  async function loadFailureRules()       { return sbLoad('failure_rules'); }

  /* ── Artifact Links ─────────────────────────────────────── */
  async function saveArtifactLink(data)   { return sbInsert('artifact_links', data); }

  /* ── Routing Settings ───────────────────────────────────── */
  async function loadRoutingSettings() {
    if (!canSync()) return null;
    var res = await SB.client.from('routing_settings').select('*').single();
    return res.error ? null : res.data;
  }

  async function saveRoutingSettings(data) {
    if (!canSync()) return { local_only: true };
    var res = await SB.client
      .from('routing_settings')
      .upsert(Object.assign({ user_id: SB.user.id }, data), { onConflict: 'user_id' });
    if (!res.error) markSynced();
    return { error: res.error || null };
  }

  /* ── Sync Queue ─────────────────────────────────────────── */
  async function syncNow() {
    if (!canSync()) return { synced: 0, failed: 0, note: 'Not authenticated' };

    var ledger  = JSON.parse(localStorage.getItem('ai4u_ledger') || '[]');
    var synced  = 0;
    var failed  = 0;

    for (var i = 0; i < ledger.length; i++) {
      var entry = ledger[i];
      if (entry.sync_status === 'synced') continue;

      var result = await saveOutcomeLog({
        task_title:    entry.task,
        platform_used: entry.platform,
        task_stage:    entry.stage    || null,
        outcome:       entry.outcome,
        why_it_worked: entry.outcome !== 'failed' ? (entry.why  || null) : null,
        why_it_failed: entry.outcome === 'failed'  ? (entry.why  || null) : null,
        evidence:      entry.proof    || null,
        artifact_url:  entry.artifact || null
      });

      if (!result.error && !result.local_only) {
        ledger[i].sync_status = 'synced';
        ledger[i].remote_id   = result.remote_id;

        if (entry.outcome === 'worked' && entry.framework) {
          await saveSuccessPattern({
            pattern_title:         entry.task,
            platform:              entry.platform,
            framework_to_duplicate: entry.framework,
            source_outcome_id:     result.remote_id
          });
        }
        if (entry.outcome === 'failed' && entry.framework) {
          await saveFailureRule({
            failure_title:     entry.task,
            platform:          entry.platform,
            avoidance_rule:    entry.framework,
            source_outcome_id: result.remote_id
          });
        }
        if (entry.artifact) {
          await saveArtifactLink({
            artifact_type:  'output',
            artifact_title: entry.task,
            artifact_url:   entry.artifact,
            platform:       entry.platform,
            outcome_log_id: result.remote_id
          });
        }
        synced++;
      } else {
        ledger[i].sync_status = 'sync_failed';
        failed++;
      }
    }

    localStorage.setItem('ai4u_ledger', JSON.stringify(ledger));
    return { synced: synced, failed: failed };
  }

  /* ── Export all data ────────────────────────────────────── */
  async function exportAllData() {
    var result = {
      exported: new Date().toISOString(),
      version:  '4.0',
      local: {
        ledger:         JSON.parse(localStorage.getItem('ai4u_ledger')         || '[]'),
        settings:       JSON.parse(localStorage.getItem('ai4u_settings')        || '{}'),
        routeDecisions: JSON.parse(localStorage.getItem('ai4u_route_decisions') || '[]')
      },
      supabase: null
    };

    if (canSync()) {
      var all = await Promise.all([
        loadOutcomeLogs(),
        loadRouteDecisions(),
        loadProofReceipts(),
        loadSuccessPatterns(),
        loadFailureRules()
      ]);
      result.supabase = {
        outcomeLogs:     all[0],
        routeDecisions:  all[1],
        proofReceipts:   all[2],
        successPatterns: all[3],
        failureRules:    all[4]
      };
    }
    return result;
  }

  /* ── Learning Intelligence stats ────────────────────────── */
  async function getIntelligenceStats() {
    var logs;
    if (canSync()) {
      var raw = await loadOutcomeLogs();
      logs = raw.map(function (l) {
        return { outcome: l.outcome, platform_used: l.platform_used };
      });
    } else {
      var ledger = JSON.parse(localStorage.getItem('ai4u_ledger') || '[]');
      logs = ledger.map(function (e) {
        return { outcome: e.outcome, platform_used: e.platform };
      });
    }
    return computeStats(logs);
  }

  function computeStats(logs) {
    var total   = logs.length;
    var worked  = logs.filter(function (l) { return l.outcome === 'worked'; }).length;
    var winRate = total ? Math.round((worked / total) * 100) : 0;

    var wins = {}, fails = {};
    logs.forEach(function (l) {
      var p = l.platform_used || '(unknown)';
      if (l.outcome === 'worked') wins[p]  = (wins[p]  || 0) + 1;
      if (l.outcome === 'failed') fails[p] = (fails[p] || 0) + 1;
    });

    var topWin  = Object.entries(wins).sort(function(a,b){return b[1]-a[1];})[0];
    var topFail = Object.entries(fails).sort(function(a,b){return b[1]-a[1];})[0];

    return {
      total:      total,
      worked:     worked,
      winRate:    winRate,
      topWin:     topWin  ? topWin[0]  : '—',
      topFail:    topFail ? topFail[0] : '—',
      lastSynced: SB.lastSynced
    };
  }

  /* ── Test connection ────────────────────────────────────── */
  async function testConnection() {
    if (!SB.client) return { ok: false, msg: 'Client not initialized — save settings first.' };
    try {
      var res = await SB.client.from('routing_settings').select('id').limit(1);
      if (!res.error) return { ok: true, msg: 'Connection successful ✓' };
      var msg = res.error.message || '';
      if (msg.toLowerCase().includes('jwt') || res.error.code === 'PGRST301') {
        return { ok: true, msg: 'Connected ✓ — sign in to access your data' };
      }
      return { ok: false, msg: msg };
    } catch (err) {
      return { ok: false, msg: err.message || String(err) };
    }
  }

  /* ── Status UI update ───────────────────────────────────── */
  function updateStatusUI() {
    var statusEl   = document.getElementById('sb-status-indicator');
    var userEl     = document.getElementById('sb-user-email');
    var signInArea = document.getElementById('sb-signin-area');
    var signOutBtn = document.getElementById('sb-signout-btn');
    var lastSyncEl = document.getElementById('sb-last-synced');
    var v4badge    = document.getElementById('sb-v4-badge');

    if (!statusEl) return;

    var statusMap = {
      'not-configured':  { text: 'Not Configured',                      cls: 'badge-red' },
      'connecting':      { text: 'Connecting…',                         cls: 'badge-gold' },
      'auth-required':   { text: 'Connected — Sign In Required',        cls: 'badge-gold' },
      'magic-link-sent': { text: 'Magic Link Sent — Check Email',        cls: 'badge-gold' },
      'connected':       { text: 'Persistent V4 Enabled ✓',             cls: 'badge-green' },
      'error':           { text: 'Error — ' + SB.statusMsg,             cls: 'badge-red' }
    };

    var info = statusMap[SB.status] || { text: SB.status, cls: 'badge-cyan' };
    statusEl.textContent = info.text;
    statusEl.className   = 'badge ' + info.cls;

    if (userEl)     userEl.textContent           = SB.user ? SB.user.email : 'Not signed in';
    if (signInArea) signInArea.style.display      = SB.user ? 'none' : 'block';
    if (signOutBtn) signOutBtn.style.display      = SB.user ? 'inline-flex' : 'none';
    if (v4badge)    v4badge.style.display         = (SB.status === 'connected') ? 'inline-flex' : 'none';
    if (lastSyncEl && SB.lastSynced) {
      lastSyncEl.textContent = 'Last synced: ' + new Date(SB.lastSynced).toLocaleString();
    }

    var banner = document.getElementById('ledger-mode-banner');
    if (banner) {
      if (SB.status === 'connected') {
        banner.innerHTML = '<div class="info-banner-icon">🔒</div><div><strong>Persistent V4 Ledger Active</strong> — Records sync to Supabase. localStorage is the offline fallback. Signed in as <strong>' + (SB.user ? SB.user.email : '') + '</strong>.</div>';
        banner.style.borderColor = 'rgba(16,185,129,0.4)';
      } else if (SB.status === 'auth-required' || SB.status === 'magic-link-sent') {
        banner.innerHTML = '<div class="info-banner-icon">🔐</div><div><strong>Supabase Connected</strong> — Sign in via the Settings panel to activate Persistent V4 Ledger. Currently saving locally only.</div>';
        banner.style.borderColor = 'rgba(240,180,41,0.4)';
      } else {
        banner.innerHTML = '<div class="info-banner-icon">💾</div><div><strong>Local V3 Ledger</strong> — Entries saved to browser localStorage only. Configure Supabase in Settings to upgrade to Persistent V4.</div>';
        banner.style.borderColor = '';
      }
    }
  }

  /* ── Public API ─────────────────────────────────────────── */
  global.AI4U_SB = {
    init:                 init,
    getStatus:            function () { return SB.status; },
    getUser:              function () { return SB.user; },
    getLastSynced:        function () { return SB.lastSynced; },
    canSync:              canSync,
    signIn:               signIn,
    signOut:              signOut,
    saveRouteDecision:    saveRouteDecision,
    loadRouteDecisions:   loadRouteDecisions,
    saveProofReceipt:     saveProofReceipt,
    loadProofReceipts:    loadProofReceipts,
    saveOutcomeLog:       saveOutcomeLog,
    loadOutcomeLogs:      loadOutcomeLogs,
    saveSuccessPattern:   saveSuccessPattern,
    loadSuccessPatterns:  loadSuccessPatterns,
    saveFailureRule:      saveFailureRule,
    loadFailureRules:     loadFailureRules,
    saveArtifactLink:     saveArtifactLink,
    loadRoutingSettings:  loadRoutingSettings,
    saveRoutingSettings:  saveRoutingSettings,
    syncNow:              syncNow,
    exportAllData:        exportAllData,
    getIntelligenceStats: getIntelligenceStats,
    testConnection:       testConnection,
    updateStatusUI:       updateStatusUI
  };

}(window));
