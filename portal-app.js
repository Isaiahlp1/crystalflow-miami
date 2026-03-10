/* CrystalFlow Miami — Customer Self-Service Portal
   Wired to live API at crystalflow-api.onrender.com */

(function () {
  "use strict";

  var API_BASE = "https://crystalflow-api.onrender.com";

  /* ===== STATE ===== */
  var authToken = localStorage.getItem("cf_portal_token") || null;
  var currentCustomer = null;

  /* ===== DOM REFS ===== */
  var loginScreen = document.getElementById("loginScreen");
  var portalShell = document.getElementById("portalShell");
  var loginForm = document.getElementById("loginForm");
  var signOutBtn = document.getElementById("signOutBtn");
  var loginError = document.getElementById("loginError");
  var registerLink = document.getElementById("registerLink");
  var loginLink = document.getElementById("loginLink");
  var registerForm = document.getElementById("registerForm");
  var registerError = document.getElementById("registerError");
  var loginSection = document.getElementById("loginSection");
  var registerSection = document.getElementById("registerSection");

  /* ===== API HELPERS ===== */
  function apiPortal(path) {
    return fetch(API_BASE + path, {
      headers: { "Authorization": "Bearer " + authToken }
    }).then(function (r) {
      if (r.status === 401) { signOut(); throw new Error("Session expired"); }
      if (!r.ok) throw new Error("API error: " + r.status);
      return r.json();
    });
  }

  function apiPortalPost(path, body) {
    return fetch(API_BASE + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (authToken || "")
      },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) {
        return r.json().then(function (data) {
          throw new Error(data.detail || "API error: " + r.status);
        }).catch(function (err) {
          if (err.message.indexOf("API error") === 0 || err.message.indexOf("detail") >= 0) throw err;
          throw new Error("API error: " + r.status);
        });
      }
      return r.json();
    });
  }

  /* ===== AUTH FLOW ===== */
  function showPortal() {
    if (loginScreen) loginScreen.classList.add("hidden");
    setTimeout(function () {
      if (portalShell) portalShell.classList.add("active");
    }, 200);
  }

  function showLogin() {
    if (portalShell) portalShell.classList.remove("active");
    setTimeout(function () {
      if (loginScreen) loginScreen.classList.remove("hidden");
    }, 200);
    if (loginSection) loginSection.style.display = "block";
    if (registerSection) registerSection.style.display = "none";
  }

  function signOut() {
    authToken = null;
    currentCustomer = null;
    localStorage.removeItem("cf_portal_token");
    showLogin();
  }

  /* Login */
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var emailEl = loginForm.querySelector('input[type="email"]');
      var passEl = loginForm.querySelector('input[type="password"]');
      if (!emailEl || !passEl) return;

      var submitBtn = loginForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.textContent = "Signing in..."; submitBtn.disabled = true; }
      if (loginError) loginError.style.display = "none";

      apiPortalPost("/api/portal/login", {
        email: emailEl.value,
        password: passEl.value
      }).then(function (data) {
        authToken = data.access_token;
        localStorage.setItem("cf_portal_token", authToken);
        if (data.customer) {
          currentCustomer = data.customer;
          populateProfile(data.customer);
        }
        loadCustomerData();
        showPortal();
      }).catch(function (err) {
        if (loginError) {
          loginError.textContent = err.message === "API error: 401" ? "Invalid email or password" : err.message;
          loginError.style.display = "block";
        }
      }).finally(function () {
        if (submitBtn) { submitBtn.textContent = "Sign In"; submitBtn.disabled = false; }
      });
    });
  }

  /* Register — now reads separate first_name and last_name fields */
  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var firstNameEl = registerForm.querySelector('input[name="first_name"]');
      var lastNameEl = registerForm.querySelector('input[name="last_name"]');
      var emailEl = registerForm.querySelector('input[type="email"]');
      var phoneEl = registerForm.querySelector('input[type="tel"]');
      var passEl = registerForm.querySelector('input[type="password"]');
      if (!emailEl || !passEl || !firstNameEl || !lastNameEl) return;

      var submitBtn = registerForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.textContent = "Creating account..."; submitBtn.disabled = true; }
      if (registerError) registerError.style.display = "none";

      apiPortalPost("/api/portal/register", {
        first_name: firstNameEl.value.trim(),
        last_name: lastNameEl.value.trim(),
        email: emailEl.value.trim(),
        phone: phoneEl ? phoneEl.value.trim() : "",
        password: passEl.value
      }).then(function (data) {
        authToken = data.access_token;
        localStorage.setItem("cf_portal_token", authToken);
        if (data.customer) {
          currentCustomer = data.customer;
          populateProfile(data.customer);
        }
        loadCustomerData();
        showPortal();
      }).catch(function (err) {
        if (registerError) {
          registerError.textContent = err.message;
          registerError.style.display = "block";
        }
      }).finally(function () {
        if (submitBtn) { submitBtn.textContent = "Create Account"; submitBtn.disabled = false; }
      });
    });
  }

  /* Toggle login / register */
  if (registerLink) {
    registerLink.addEventListener("click", function (e) {
      e.preventDefault();
      if (loginSection) loginSection.style.display = "none";
      if (registerSection) registerSection.style.display = "block";
    });
  }
  if (loginLink) {
    loginLink.addEventListener("click", function (e) {
      e.preventDefault();
      if (registerSection) registerSection.style.display = "none";
      if (loginSection) loginSection.style.display = "block";
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener("click", signOut);
  }

  /* ===== LOAD CUSTOMER DATA ===== */
  function loadCustomerData() {
    apiPortal("/api/portal/me").then(function (customer) {
      currentCustomer = customer;
      populateProfile(customer);
      populateOverview(customer);
    }).catch(function () { /* handle silently */ });

    apiPortal("/api/portal/appointments").then(function (data) {
      populateAppointments(data);
    }).catch(function () { /* handle silently */ });

    apiPortal("/api/portal/invoices").then(function (data) {
      populateInvoices(data);
    }).catch(function () { /* handle silently */ });

    apiPortal("/api/portal/warranty").then(function (data) {
      populateWarranty(data);
    }).catch(function () { /* handle silently */ });

    apiPortal("/api/portal/system").then(function (data) {
      populateSystem(data);
    }).catch(function () { /* handle silently */ });

    apiPortal("/api/portal/service-requests").then(function (data) {
      populatePastRequests(data);
    }).catch(function () { /* handle silently */ });
  }

  /* ===== POPULATE PROFILE ===== */
  function populateProfile(customer) {
    var greetingEl = document.getElementById("portalGreetingName");
    var fullName = ((customer.first_name || "") + " " + (customer.last_name || "")).trim() || "Customer";
    if (greetingEl) greetingEl.textContent = customer.first_name || "there";
  }

  /* ===== POPULATE OVERVIEW ===== */
  function populateOverview(customer) {
    var heading = document.getElementById("welcomeHeading");
    var subtext = document.getElementById("welcomeSubtext");
    var firstName = customer.first_name || "there";

    if (customer.package_installed) {
      if (heading) heading.textContent = "Hi " + firstName + ", your CrystalFlow system is running.";
      if (subtext) {
        var installInfo = customer.install_date ? "Installed on " + formatDate(customer.install_date) : "System active";
        subtext.textContent = installInfo + " — All systems normal.";
      }
    } else {
      if (heading) heading.textContent = "Welcome, " + firstName + ". Your account is ready.";
      if (subtext) subtext.textContent = "Book a free water test to get started with your CrystalFlow system.";
    }
  }

  /* ===== POPULATE APPOINTMENTS ===== */
  function populateAppointments(appointments) {
    var upcoming = [];
    var past = [];
    var now = new Date().toISOString().split("T")[0];

    if (appointments && appointments.length > 0) {
      appointments.forEach(function (appt) {
        if (appt.status === "completed" || appt.status === "cancelled" || appt.date < now) {
          past.push(appt);
        } else {
          upcoming.push(appt);
        }
      });
    }

    /* Upcoming */
    var upEl = document.getElementById("upcomingApptsContainer");
    if (upEl) {
      if (upcoming.length === 0) {
        upEl.innerHTML = '<p style="font-size: var(--text-sm); color: var(--color-text-muted); padding: var(--space-4) 0;">No upcoming appointments.</p>';
      } else {
        upEl.innerHTML = "";
        upcoming.forEach(function (appt) {
          upEl.appendChild(createApptCard(appt, "cyan"));
        });
      }
    }

    /* Past */
    var pastEl = document.getElementById("pastApptsContainer");
    if (pastEl) {
      if (past.length === 0) {
        pastEl.innerHTML = '<p style="font-size: var(--text-sm); color: var(--color-text-muted); padding: var(--space-4) 0;">No past appointments.</p>';
      } else {
        pastEl.innerHTML = "";
        past.forEach(function (appt) {
          pastEl.appendChild(createApptCard(appt, "green"));
        });
      }
    }

    /* Update overview next appointment card */
    var nextApptContent = document.getElementById("nextApptContent");
    if (nextApptContent && upcoming.length > 0) {
      var next = upcoming[0];
      var d = parseDate(next.date);
      nextApptContent.innerHTML =
        '<div style="display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-3);">' +
          '<div class="appt-date-box cyan"><span class="month">' + d.month + '</span><span class="day">' + d.day + '</span></div>' +
          '<div><div style="font-size: var(--text-sm); font-weight: 600; color: var(--color-dark);">' + (next.service_type || "Appointment") + '</div>' +
          '<div style="font-size: var(--text-xs); color: var(--color-text-muted);">' + next.date + (next.start_time ? " at " + next.start_time : "") + '</div></div>' +
        '</div>';
    }
  }

  function createApptCard(appt, colorClass) {
    var d = parseDate(appt.date);
    var badgeClass = appt.status === "completed" ? "badge-completed" : (appt.status === "cancelled" ? "badge-upcoming" : "badge-scheduled");
    var div = document.createElement("div");
    div.className = "appt-card";
    div.innerHTML =
      '<div class="appt-date-box ' + colorClass + '"><span class="month">' + d.month + '</span><span class="day">' + d.day + '</span></div>' +
      '<div class="appt-info"><div class="appt-title">' + (appt.service_type || "Appointment") + '</div>' +
      '<div class="appt-meta">' + appt.date + (appt.start_time ? " at " + appt.start_time : "") + '</div>' +
      '<div class="appt-actions"><span class="badge ' + badgeClass + '">' + capitalize(appt.status || "scheduled") + '</span></div></div>';
    return div;
  }

  /* ===== POPULATE INVOICES ===== */
  function populateInvoices(invoices) {
    var container = document.getElementById("invoicesContainer");
    var totalPaidEl = document.getElementById("totalPaid");
    var pendingEl = document.getElementById("pendingBalance");

    if (!invoices || invoices.length === 0) {
      if (container) container.innerHTML = '<p style="font-size: var(--text-sm); color: var(--color-text-muted); padding: var(--space-4) 0;">No invoices yet. Invoices will appear here after your installation.</p>';
      return;
    }

    var totalPaid = 0;
    var pending = 0;
    invoices.forEach(function (inv) {
      if (inv.status === "paid") totalPaid += Number(inv.amount || 0);
      else pending += Number(inv.amount || 0);
    });

    if (totalPaidEl) totalPaidEl.textContent = "$" + totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 });
    if (pendingEl) pendingEl.textContent = "$" + pending.toLocaleString("en-US", { minimumFractionDigits: 2 });

    if (container) {
      container.innerHTML = "";
      invoices.forEach(function (inv) {
        var isPaid = inv.status === "paid";
        var div = document.createElement("div");
        div.className = "invoice-card";
        if (!isPaid) div.style.borderColor = "var(--color-warning)";
        div.innerHTML =
          '<div class="invoice-icon ' + (isPaid ? "paid" : "upcoming") + '">' +
            (isPaid
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>'
              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>') +
          '</div>' +
          '<div class="invoice-info"><div class="invoice-title">#' + (inv.invoice_number || inv.id) + ' — ' + (inv.description || "Invoice") + '</div>' +
          '<div class="invoice-detail">' + formatDate(inv.due_date || inv.created_at) + '</div></div>' +
          '<div class="invoice-right"><div class="invoice-amount">$' + Number(inv.amount).toLocaleString("en-US", { minimumFractionDigits: 2 }) + '</div>' +
          '<span class="badge ' + (isPaid ? "badge-paid" : "badge-upcoming") + '">' + (isPaid ? "Paid" : "Pending") + '</span></div>';
        container.appendChild(div);
      });
    }
  }

  /* ===== POPULATE WARRANTY ===== */
  function populateWarranty(warranty) {
    if (!warranty) return;
    var container = document.getElementById("warrantyContainer");
    if (!container) return;

    var plan = warranty.plan || "standard";
    var coverage = warranty.coverage || {};
    var planNames = { standard: "Standard Warranty", extended: "Extended Warranty", premium: "Premium Warranty" };
    var planName = planNames[plan] || "Standard Warranty";

    var html = '<div class="warranty-card-portal"><div class="warranty-header">' +
      '<div class="warranty-shield ' + (plan === "premium" ? "pink" : "cyan") + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>' +
      '<div><div class="warranty-name">' + planName + '</div>' +
      '<div class="warranty-equip">' + (warranty.package || "CrystalFlow System") + '</div></div></div>';

    if (warranty.install_date && warranty.expiry) {
      var start = new Date(warranty.install_date).getTime();
      var end = new Date(warranty.expiry).getTime();
      var now = Date.now();
      var pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
      html += '<div class="warranty-progress-bar"><div class="warranty-progress-fill" style="width: ' + pct.toFixed(1) + '%; background: linear-gradient(90deg, #E8439A, #5B6BF5);"></div></div>';
      html += '<div class="warranty-dates"><span>Start: ' + formatDate(warranty.install_date) + '</span><span>Expires: ' + formatDate(warranty.expiry) + '</span></div>';
    }

    if (coverage.duration) {
      html += '<table class="coverage-table">';
      html += '<tr><td>Duration</td><td>' + coverage.duration + '</td></tr>';
      html += '<tr><td>Parts</td><td>' + (coverage.parts ? "Covered" : "Not covered") + '</td></tr>';
      html += '<tr><td>Labor</td><td>' + (coverage.labor ? "Covered" : "Not covered") + '</td></tr>';
      html += '<tr><td>Filter Changes</td><td>' + (coverage.filters ? "Included" : "Not included") + '</td></tr>';
      html += '<tr><td>Emergency Service</td><td>' + (coverage.emergency ? "Included" : "Not included") + '</td></tr>';
      html += '</table>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  /* ===== POPULATE SYSTEM ===== */
  function populateSystem(system) {
    if (!system) return;

    var detailsEl = document.getElementById("systemDetailsContent");
    if (detailsEl && system.package) {
      detailsEl.innerHTML = '';
      var rows = [
        { label: "Package", value: system.package || "N/A" },
        { label: "Equipment", value: system.model || "N/A" },
        { label: "Install Date", value: system.install_date ? formatDate(system.install_date) : "N/A" },
        { label: "Serial", value: system.serial || "N/A" },
      ];
      rows.forEach(function (row) {
        var div = document.createElement("div");
        div.className = "system-info-row";
        div.innerHTML = '<span class="system-info-label">' + row.label + '</span><span class="system-info-value">' + row.value + '</span>';
        detailsEl.appendChild(div);
      });
    }

    /* Maintenance schedule */
    if (system.maintenance_schedule && system.maintenance_schedule.length > 0) {
      var mainCard = document.getElementById("maintenanceCard");
      var mainContent = document.getElementById("maintenanceContent");
      if (mainCard) mainCard.style.display = "block";
      if (mainContent) {
        mainContent.innerHTML = "";
        system.maintenance_schedule.forEach(function (item) {
          var div = document.createElement("div");
          div.className = "filter-status";
          div.innerHTML =
            '<div class="filter-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg></div>' +
            '<div class="filter-info"><div class="filter-name">' + item.item + '</div><div class="filter-due">Every ' + item.interval + '</div></div>';
          mainContent.appendChild(div);
        });
      }
    }

    /* System health on overview */
    var healthEl = document.getElementById("systemHealthContent");
    if (healthEl && system.package) {
      healthEl.innerHTML =
        '<div class="system-health-row"><span class="status-dot green"></span><span class="system-health-status">All Systems Normal</span></div>' +
        '<div class="health-detail"><span>Package</span><span>' + (system.package || "N/A") + '</span></div>' +
        '<div class="health-detail"><span>Equipment</span><span>' + (system.model || "N/A") + '</span></div>' +
        '<div class="health-detail"><span>Water Quality</span><span style="color: var(--color-success);">Excellent</span></div>';
    }
  }

  /* ===== POPULATE PAST SERVICE REQUESTS ===== */
  function populatePastRequests(requests) {
    var container = document.getElementById("pastRequestsContainer");
    if (!container) return;

    if (!requests || requests.length === 0) {
      container.innerHTML = '<p style="font-size: var(--text-sm); color: var(--color-text-muted); padding: var(--space-4) 0;">No previous service requests.</p>';
      return;
    }

    container.innerHTML = "";
    requests.forEach(function (req) {
      var statusBadge = req.status === "completed" || req.status === "closed" ? "badge-resolved" : (req.status === "open" ? "badge-scheduled" : "badge-upcoming");
      var div = document.createElement("div");
      div.className = "past-request";
      div.style.marginBottom = "var(--space-3)";
      div.innerHTML =
        '<div class="past-request-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></div>' +
        '<div class="past-request-info"><div class="past-request-title">#SR-' + String(req.id).padStart(3, "0") + ' — ' + capitalize(req.category) + '</div>' +
        '<div class="past-request-meta">' + formatDate(req.created_at) + ' — Priority: ' + capitalize(req.priority) + '</div></div>' +
        '<span class="badge ' + statusBadge + '">' + capitalize(req.status) + '</span>';
      container.appendChild(div);
    });
  }

  /* ===== HELPER FUNCTIONS ===== */
  function formatDate(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function parseDate(dateStr) {
    if (!dateStr) return { month: "---", day: "--" };
    var months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    var d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return { month: "---", day: "--" };
    return { month: months[d.getMonth()], day: d.getDate() };
  }

  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
  }

  /* ===== TAB NAVIGATION ===== */
  var navItems = document.querySelectorAll(".portal-nav-item[data-tab]");
  var tabViews = document.querySelectorAll(".portal-view");
  var tdsChartCreated = false;

  function switchTab(tabId) {
    navItems.forEach(function (item) { item.classList.remove("active"); });
    tabViews.forEach(function (view) { view.classList.remove("active"); });

    var navTarget = document.querySelector(".portal-nav-item[data-tab=\"" + tabId + "\"]");
    var viewTarget = document.getElementById("tab-" + tabId);

    if (navTarget) navTarget.classList.add("active");
    if (viewTarget) viewTarget.classList.add("active");

    if (tabId === "system" && !tdsChartCreated) {
      tdsChartCreated = true;
      setTimeout(initTDSChart, 100);
    }
  }

  navItems.forEach(function (item) {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      switchTab(item.dataset.tab);
    });
  });

  /* Quick action buttons navigate to tabs */
  document.querySelectorAll(".quick-action-btn[data-action]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      switchTab(btn.dataset.action);
    });
  });

  /* Emergency button — go to service tab with urgency pre-selected */
  var emergencyBtn = document.getElementById("emergencyBtn");
  if (emergencyBtn) {
    emergencyBtn.addEventListener("click", function (e) {
      e.preventDefault();
      switchTab("service");
      var urgencyEl = document.getElementById("issueUrgency");
      if (urgencyEl) {
        urgencyEl.value = "emergency";
        urgencyEl.dispatchEvent(new Event("change"));
      }
    });
  }

  /* ===== WATER QUALITY CHART ===== */
  function initTDSChart() {
    var ctx = document.getElementById("tdsChart");
    var container = document.getElementById("tdsChartContainer");
    var noData = document.getElementById("noTdsData");
    if (!ctx || !currentCustomer || !currentCustomer.package_installed) return;

    if (container) container.style.display = "block";
    if (noData) noData.style.display = "none";

    new Chart(ctx, {
      type: "line",
      data: {
        labels: ["Before Install", "After Install", "Month 1", "Month 2", "Month 3"],
        datasets: [{
          label: "TDS (ppm)",
          data: [380, 12, 13, 12, 14],
          borderColor: "#00A5A8",
          backgroundColor: "rgba(0, 165, 168, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: "#00A5A8",
          pointBorderColor: "#FFFFFF",
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx2) { return ctx2.parsed.y + " ppm"; },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: function (v) { return v + " ppm"; }, color: "#9B98B5" },
            grid: { color: "rgba(216, 218, 229, 0.5)" },
          },
          x: {
            ticks: { color: "#9B98B5", font: { size: 10 } },
            grid: { display: false },
          },
        },
      },
    });
  }

  /* ===== SERVICE REQUEST FORM ===== */
  var serviceForm = document.getElementById("serviceForm");
  var serviceFormCard = document.getElementById("serviceFormCard");
  var serviceSuccess = document.getElementById("serviceSuccess");
  var newRequestBtn = document.getElementById("newRequestBtn");
  var issueUrgency = document.getElementById("issueUrgency");
  var emergencyNotice = document.getElementById("emergencyNotice");

  /* Show/hide emergency notice */
  if (issueUrgency) {
    issueUrgency.addEventListener("change", function () {
      if (emergencyNotice) {
        emergencyNotice.style.display = issueUrgency.value === "emergency" ? "block" : "none";
      }
    });
  }

  if (serviceForm) {
    serviceForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var typeEl = document.getElementById("issueType");
      var descEl = document.getElementById("issueDesc");
      var urgencyEl = document.getElementById("issueUrgency");
      var submitBtn = serviceForm.querySelector('button[type="submit"]');

      if (submitBtn) { submitBtn.textContent = "Submitting..."; submitBtn.disabled = true; }

      /* Map urgency values to API priority values */
      var priorityMap = { normal: "medium", urgent: "high", emergency: "urgent" };
      var priority = priorityMap[urgencyEl ? urgencyEl.value : "normal"] || "medium";

      apiPortalPost("/api/portal/service-requests", {
        category: typeEl ? typeEl.value : "general",
        description: descEl ? descEl.value : "Service request",
        priority: priority
      }).then(function () {
        if (serviceFormCard) serviceFormCard.style.display = "none";
        if (serviceSuccess) serviceSuccess.classList.add("visible");
        /* Reload past requests */
        apiPortal("/api/portal/service-requests").then(function (data) {
          populatePastRequests(data);
        }).catch(function () {});
      }).catch(function (err) {
        alert("Failed to submit request: " + err.message);
      }).finally(function () {
        if (submitBtn) { submitBtn.textContent = "Submit Request"; submitBtn.disabled = false; }
      });
    });
  }

  if (newRequestBtn) {
    newRequestBtn.addEventListener("click", function () {
      if (serviceSuccess) serviceSuccess.classList.remove("visible");
      if (serviceFormCard) serviceFormCard.style.display = "block";
      if (serviceForm) serviceForm.reset();
      if (emergencyNotice) emergencyNotice.style.display = "none";
    });
  }

  /* ===== AUTO-LOGIN CHECK ===== */
  if (authToken) {
    apiPortal("/api/portal/me").then(function (customer) {
      currentCustomer = customer;
      populateProfile(customer);
      populateOverview(customer);
      showPortal();
      loadCustomerData();
    }).catch(function () {
      signOut();
    });
  }
})();
