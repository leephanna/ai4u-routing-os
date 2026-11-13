(function (global) {
  "use strict";
  const cfg = global.AI4U_BILLING_CONFIG || {};
  const state = {
    client: null, session: null, enabled: false, subscriptionActive: false,
    hasPortal: false, portalAvailable: false,
    currentTaskAccess: null, pendingTask: null, handlingReturn: false
  };
  const STORAGE_TASK = "ai4u_router_pending_task";
  const STORAGE_ACCESS = "ai4u_router_current_task_access";

  function byId(id) { return document.getElementById(id); }
  function money(cents) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Number(cents) || 0) / 100);
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function notify(message, duration) {
    if (typeof global.showToast === "function") global.showToast(message, duration || 3500);
  }
  function showModal(html) {
    const modal = byId("billing-modal");
    const content = byId("billing-modal-content");
    if (!modal || !content) return;
    content.innerHTML = html;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    const modal = byId("billing-modal");
    if (modal) {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
  }
  function token() {
    return state.session && state.session.access_token ? state.session.access_token : "";
  }
  async function freshToken() {
    if(state.client&&state.client.auth&&typeof state.client.auth.getSession==="function"){
      const result=await state.client.auth.getSession();
      if(result.error)throw new Error("Your account session could not be refreshed. Sign in again under Settings.");
      state.session=result.data&&result.data.session?result.data.session:null;
    }
    return token();
  }
  async function api(path, options) {
    const opts = options || {};
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (token()) headers.Authorization = "Bearer " + token();
    const response = await fetch(path, Object.assign({}, opts, { headers: headers, cache: "no-store" }));
    let data = {};
    try { data = await response.json(); } catch (error) {}
    if (!response.ok) throw new Error(data.error || "The request could not be completed.");
    return data;
  }
  function savePending(task, purpose) {
    state.pendingTask = { task: task, purpose: purpose || "route" };
    try { sessionStorage.setItem(STORAGE_TASK, JSON.stringify(state.pendingTask)); } catch (error) {}
  }
  function readPending() {
    if (state.pendingTask) return state.pendingTask;
    try {
      const raw = sessionStorage.getItem(STORAGE_TASK);
      state.pendingTask = raw ? JSON.parse(raw) : null;
    } catch (error) { state.pendingTask = null; }
    return state.pendingTask;
  }
  function clearPending() {
    state.pendingTask = null;
    try { sessionStorage.removeItem(STORAGE_TASK); sessionStorage.removeItem("ai4u_router_pending_quote"); } catch (error) {}
  }
  function saveAccess(access) {
    state.currentTaskAccess = access;
    try { sessionStorage.setItem(STORAGE_ACCESS, JSON.stringify(access)); } catch (error) {}
  }
  function readAccess() {
    if (state.currentTaskAccess) return state.currentTaskAccess;
    try {
      const raw = sessionStorage.getItem(STORAGE_ACCESS);
      state.currentTaskAccess = raw ? JSON.parse(raw) : null;
    } catch (error) { state.currentTaskAccess = null; }
    return state.currentTaskAccess;
  }
  function sameTask(goal) {
    const access = readAccess();
    return !!(access && access.mode === "task" && access.goal && String(access.goal).trim() === String(goal || "").trim());
  }
  function taskFromRoute() {
    return {
      goal: (byId("r-goal") && byId("r-goal").value || "").trim(),
      stage: byId("r-stage") ? byId("r-stage").value : "idea",
      risk: byId("r-risk") ? byId("r-risk").value : "medium",
      asset: byId("r-asset") ? byId("r-asset").value.trim() : "",
      failure: byId("r-failure") ? byId("r-failure").value.trim() : "",
      output: byId("r-output") ? byId("r-output").value.trim() : ""
    };
  }
  function taskFromPrompt() {
    return {
      goal: (byId("p-goal") && byId("p-goal").value || "").trim(),
      stage: byId("r-stage") && byId("r-stage").value || "idea",
      risk: byId("r-risk") && byId("r-risk").value || "medium",
      asset: "",
      failure: "",
      output: byId("p-format") && byId("p-format").value || ""
    };
  }
  function restoreTask(task) {
    if (!task) return;
    const fields = {
      "r-goal": task.goal, "r-stage": task.stage, "r-risk": task.risk,
      "r-asset": task.asset, "r-failure": task.failure, "r-output": task.output
    };
    Object.keys(fields).forEach(function (id) {
      const field = byId(id);
      if (field && fields[id] != null) field.value = fields[id];
    });
  }
  function runAfterAccess(purpose) {
    closeModal();
    if (purpose === "prompt" && typeof global.generatePromptCore === "function") {
      global.generatePromptCore();
    } else if (typeof global.runRouterCore === "function") {
      global.runRouterCore();
    }
  }
  function showAuthModal(purpose) {
    const forPortal = purpose === "portal";
    showModal(
      '<div class="billing-modal-kicker">AI4U ACCOUNT</div>' +
      '<h2 id="billing-modal-title">' + (forPortal ? 'Manage your Router membership' : 'Claim your free starter task') + '</h2>' +
      '<p>' + (forPortal ? 'Sign in with the email associated with your Router membership to securely manage billing.' : 'Sign in with your email to claim your one free eligible task and keep your access connected to your account.') + '</p>' +
      '<label class="billing-field-label" for="billing-email">Email address</label>' +
      '<input class="form-input billing-email-input" id="billing-email" type="email" autocomplete="email" placeholder="you@example.com">' +
      '<div id="billing-auth-message" class="billing-modal-note">We will email you a secure sign-in link. No password required.</div>' +
      '<div class="billing-modal-actions"><button class="btn btn-primary" onclick="AI4UBilling.sendMagicLink()">Email Me a Sign-In Link</button>' +
      '<button class="btn btn-ghost" onclick="AI4UBilling.closeModal()">Cancel</button></div>'
    );
  }
  async function ensureSignedIn(task, purpose) {
    if (token()) return true;
    if (task) savePending(task, purpose);
    showAuthModal(purpose);
    return false;
  }
  async function sendMagicLink() {
    const email = (byId("billing-email") && byId("billing-email").value || "").trim();
    const message = byId("billing-auth-message");
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      if (message) message.textContent = "Enter a valid email address.";
      return;
    }
    if (!state.client) {
      if (message) message.textContent = "Account sign-in is not available right now. Please try again later.";
      return;
    }
    if (message) message.textContent = "Sending your secure sign-in link…";
    const result = await state.client.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: global.location.origin + "/?billing_auth=1", shouldCreateUser: true }
    });
    if (result.error) {
      if (message) message.textContent = result.error.message || "The sign-in link could not be sent.";
      return;
    }
    if (message) message.textContent = "Sign-in link sent. Open the email on this device, click the link, then return here. Your task will be waiting.";
    notify("Secure sign-in link sent. Check your email.", 5000);
  }
  function updatePortalButton() {
    const button = byId("billing-manage-subscription");
    if (button) {
      const show = state.hasPortal && state.portalAvailable;
      button.hidden = !show;
      button.style.display = show ? "inline-flex" : "none";
    }
  }
  async function refreshAccountStatus() {
    const status = byId("billing-account-status");
    if (!token()) {
      state.subscriptionActive = false;
      state.hasPortal = false;
      updatePortalButton();
      if (status) status.textContent = state.enabled ?
        "Sign in when you are ready to use your free task or purchase access." :
        "Payments are being prepared. The free experience remains available.";
      return;
    }
    try {
      const access = await api("/api/access/check", { method: "GET" });
      state.subscriptionActive = !!access.subscription_active;
      state.hasPortal = !!access.has_portal;
      updatePortalButton();
      if (status) {
        if (access.subscription_active) {
          status.textContent = "Active " + (access.plan_code === "annual" ? "annual" : "monthly") +
            " membership" + (access.cancel_at_period_end ? " · Scheduled to end at the billing period's close." : ".");
        } else if (state.hasPortal) {
          status.textContent = "Signed in as " + (access.email || "your account") +
            ". Your previous membership billing records are available.";
        } else {
          status.textContent = "Signed in as " + (access.email || "your account") +
            (state.enabled ? ". One free eligible task is available if you have not used it." :
              ". Checkout is being prepared; the free experience remains available.");
        }
        if (state.hasPortal && !state.portalAvailable) {
          status.textContent += " Self-service billing setup is being finalized.";
        }
      }
    } catch (error) {
      state.hasPortal = false;
      updatePortalButton();
      if (status) status.textContent = "Account status could not be checked right now.";
    }
  }
  async function requestTaskAccess(task, purpose) {
    if (!state.enabled) return true;
    if (!task || !task.goal) {
      notify("Enter a task first, then request an estimate.");
      return false;
    }
    if (sameTask(task.goal)) return true;
    if (!await ensureSignedIn(task, purpose)) return false;
    try {
      const access = await api("/api/access/check", { method: "GET" });
      state.subscriptionActive = !!access.subscription_active;
      if (state.subscriptionActive) {
        saveAccess({ mode: "subscription", goal: task.goal });
        return true;
      }
      const quote = await api("/api/task/quote", {
        method: "POST",
        body: JSON.stringify(task)
      });
      if (quote.allowed) {
        saveAccess({ mode: "subscription", goal: task.goal });
        return true;
      }
      state.pendingTask = { task: task, purpose: purpose || "route", quote: quote };
      if (quote.amount_cents === 0 && quote.free_eligible) {
        showModal(
          '<div class="billing-modal-kicker">YOUR FIRST TASK</div>' +
          '<h2 id="billing-modal-title">Your starter task is free</h2>' +
          '<div class="billing-quote-price">' + money(0) + '</div>' +
          '<p>This task is below the free-task complexity limit. You can use one eligible starter task per account.</p>' +
          '<div class="billing-quote-row"><span>Complexity score</span><strong>' + quote.complexity_score + ' / 2</strong></div>' +
          '<div class="billing-modal-note">No payment method required. Your free task is used only when you click the button below.</div>' +
          '<div class="billing-modal-actions"><button class="btn btn-primary" onclick="AI4UBilling.claimFreeTask()">Use My Free Task</button>' +
          '<button class="btn btn-ghost" onclick="AI4UBilling.cancelQuote()">Cancel</button></div>'
        );
      } else {
        const tierLabel = quote.tier === "basic" ? "Basic task" : quote.tier === "standard" ? "Standard task" : "Advanced task";
        const amount = money(quote.amount_cents);
        showModal(
          '<div class="billing-modal-kicker">TASK COST ESTIMATE</div>' +
          '<h2 id="billing-modal-title">Review your task price</h2>' +
          '<div class="billing-quote-price">' + amount + '</div>' +
          '<div class="billing-quote-row"><span>Complexity category</span><strong>' + tierLabel + '</strong></div>' +
          '<div class="billing-quote-row"><span>Complexity score</span><strong>' + quote.complexity_score + '</strong></div>' +
          '<div class="billing-quote-row"><span>Maximum AI4U fee for this task</span><strong>' + amount + '</strong></div>' +
          '<div class="billing-modal-note">This fixed fee covers AI4U routing, a prepared prompt, and task-specific verification guidance. It does not include separate charges from the AI platform you choose. Your quote is held for 30 minutes. You will not be charged unless you continue to Stripe Checkout.</div>' +
          '<div class="billing-modal-actions"><button class="btn btn-primary" onclick="AI4UBilling.payForTask()">Pay &amp; Continue</button>' +
          '<button class="btn btn-ghost" onclick="AI4UBilling.cancelQuote()">Cancel</button></div>'
        );
      }
      return false;
    } catch (error) {
      notify(error.message || "The access check failed. No payment was taken.", 5000);
      return false;
    }
  }
  async function claimFreeTask() {
    const pending = state.pendingTask;
    if (!pending || !pending.quote) return;
    try {
      const result = await api("/api/task/claim", {
        method: "POST",
        body: JSON.stringify({ quote_id: pending.quote.quote_id, task_hash: pending.quote.task_hash })
      });
      saveAccess({ mode: "task", goal: pending.task.goal, quote_id: result.quote_id, task_hash: result.task_hash });
      const purpose = pending.purpose;
      clearPending();
      runAfterAccess(purpose);
      notify("Free starter task activated.");
    } catch (error) {
      notify(error.message || "The free task could not be claimed.", 5000);
    }
  }
  function payForTask() {
    const pending = state.pendingTask;
    if (!pending || !pending.quote || !pending.quote.payment_url) {
      notify("The payment option is not ready yet.");
      return;
    }
    savePending(pending.task, pending.purpose);
    try {
      sessionStorage.setItem("ai4u_router_pending_quote", pending.quote.quote_id);
    } catch (error) {}
    global.location.href = pending.quote.payment_url;
  }
  async function cancelQuote() {
    const pending = state.pendingTask;
    if (pending && pending.quote && pending.quote.quote_id && token()) {
      try {
        await api("/api/task/cancel", {
          method: "POST",
          body: JSON.stringify({ quote_id: pending.quote.quote_id })
        });
      } catch (error) {}
    }
    clearPending();
    closeModal();
  }
  async function openPortal() {
    if (!token()) {
      try { sessionStorage.setItem("ai4u_router_pending_portal", "1"); } catch (error) {}
      showAuthModal("portal");
      return;
    }
    if (!state.portalAvailable) {
      notify("Subscription management is being configured. Please try again later.", 5000);
      return;
    }
    try {
      const result = await api("/api/billing/portal", { method: "POST", body: "{}" });
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com") {
        throw new Error("Stripe returned an unexpected portal destination.");
      }
      global.location.assign(url.toString());
    } catch (error) {
      notify(error.message || "Subscription management is temporarily unavailable.", 5000);
    }
  }
  async function startSubscription(plan) {
    if (!state.enabled) {
      notify("Checkout is not active yet. Please try again later.");
      return;
    }
    if (!await ensureSignedIn(null, "subscribe")) {
      try { sessionStorage.setItem("ai4u_router_pending_plan", plan); } catch (error) {}
      return;
    }
    try {
      const result = await api("/api/access/start", {
        method: "POST",
        body: JSON.stringify({ plan: plan })
      });
      if (result.already_active) {
        state.subscriptionActive = true;
        notify("Your AI4U Router membership is already active.");
        await refreshAccountStatus();
        return;
      }
      global.location.href = result.checkout_url;
    } catch (error) {
      notify(error.message || "Checkout could not be started. No payment was taken.", 5000);
    }
  }
  async function confirmPaymentReturn(sessionId) {
    if (!token()) {
      showAuthModal();
      return false;
    }
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        const taskResult = await api("/api/task/confirm?session_id=" + encodeURIComponent(sessionId), { method: "GET" });
        if (taskResult.confirmed) {
          const pending = readPending();
          if (pending && pending.task) {
            restoreTask(pending.task);
            const claim = await api("/api/task/claim", {
              method: "POST",
              body: JSON.stringify({ quote_id: taskResult.quote_id, task_hash: taskResult.task_hash })
            });
            saveAccess({ mode: "task", goal: pending.task.goal, quote_id: claim.quote_id, task_hash: claim.task_hash });
            const purpose = pending.purpose;
            clearPending();
            runAfterAccess(purpose);
            notify("Payment confirmed. Your task is unlocked.");
          } else {
            notify("Payment confirmed. Return to Route Engine to continue.");
          }
          return true;
        }
      } catch (error) {}
      try {
        const accessResult = await api("/api/access/confirm?session_id=" + encodeURIComponent(sessionId), { method: "GET" });
        if (accessResult.confirmed) {
          state.subscriptionActive = true;
          const pending = readPending();
          if (pending && pending.task) {
            restoreTask(pending.task);
            const purpose = pending.purpose;
            clearPending();
            saveAccess({ mode: "subscription", goal: pending.task.goal });
            runAfterAccess(purpose);
          }
          notify("Your AI4U Router membership is active.");
          await refreshAccountStatus();
          return true;
        }
      } catch (error) {}
      await new Promise(function (resolve) { global.setTimeout(resolve, 1500); });
    }
    notify("Payment is still being confirmed. Refresh this page in a moment; no duplicate payment is needed.", 6000);
    return false;
  }
  async function handleReturn() {
    if (state.handlingReturn) return;
    state.handlingReturn = true;
    const params = new URLSearchParams(global.location.search);
    const sessionId = params.get("session_id");
    if (params.get("checkout") === "success" && sessionId) {
      const confirmed = await confirmPaymentReturn(sessionId);
      if (confirmed) global.history.replaceState({}, "", global.location.pathname);
      return;
    }
    if (params.get("portal") === "return") {
      await refreshAccountStatus();
      global.history.replaceState({}, "", global.location.pathname);
      return;
    }
    if (params.get("billing_auth") === "1") {
      const pending = readPending();
      if (pending && pending.task) {
        restoreTask(pending.task);
        const allowed = await requestTaskAccess(pending.task, pending.purpose);
        if (allowed) runAfterAccess(pending.purpose);
      }
      const plan = sessionStorage.getItem("ai4u_router_pending_plan");
      if (plan && token()) {
        sessionStorage.removeItem("ai4u_router_pending_plan");
        await startSubscription(plan);
      }
      if (token() && sessionStorage.getItem("ai4u_router_pending_portal") === "1") {
        sessionStorage.removeItem("ai4u_router_pending_portal");
        await openPortal();
      }
      global.history.replaceState({}, "", global.location.pathname);
    }
  }
  function refreshPricing() {
    refreshAccountStatus();
  }
  async function init() {
    try {
      const config = await fetch("/api/billing/config", { cache: "no-store" }).then(function (r) { return r.json(); });
      state.enabled = !!config.enabled;
      state.portalAvailable = !!config.portal_available;
    } catch (error) { state.enabled = false; }
    if (global.supabase && typeof global.supabase.createClient === "function" && cfg.supabaseUrl && cfg.supabasePublishableKey) {
      state.client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
        auth: {
          storageKey: "ai4u_router_billing_auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      const current = await state.client.auth.getSession();
      state.session = current.data ? current.data.session : null;
      state.client.auth.onAuthStateChange(function (event, session) {
        state.session = session;
        refreshAccountStatus();
      });
    }
    await refreshAccountStatus();
    await handleReturn();
  }

  global.AI4UBilling = {
    init: init,
    getAccessToken: token,
    getFreshAccessToken: freshToken,
    requestTaskAccess: requestTaskAccess,
    startSubscription: startSubscription,
    openPortal: openPortal,
    refreshPricing: refreshPricing,
    sendMagicLink: sendMagicLink,
    closeModal: closeModal,
    claimFreeTask: claimFreeTask,
    payForTask: payForTask,
    cancelQuote: cancelQuote
  };
}(window));