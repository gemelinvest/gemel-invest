(() => {
  "use strict";

  const APP = () => window.InvestoPwa;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let wizard = null;

  function newInsuredId() {
    return "ins_" + Math.random().toString(36).slice(2, 14);
  }

  function newProposalId() {
    return "prop_" + Date.now().toString(16) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function createSession() {
    const id = newInsuredId();
    return {
      proposalId: null,
      currentStep: 1,
      createdAtIso: nowIso(),
      insureds: [{
        id,
        type: "primary",
        label: "מבוטח ראשי",
        data: {}
      }],
      newPolicies: []
    };
  }

  function primaryData() {
    return wizard.insureds[0].data;
  }

  function fullName() {
    const d = primaryData();
    return [d.firstName, d.lastName].filter(Boolean).join(" ").trim() || "הצעה ללא שם";
  }

  function buildDraftPayload() {
    const primary = wizard.insureds[0];
    return {
      savedAt: nowIso(),
      currentStep: wizard.currentStep,
      flowType: "health",
      elementaryProduct: "",
      activeInsId: primary.id,
      insureds: wizard.insureds,
      newPolicies: wizard.newPolicies,
      companyAgentNumbers: {},
      mirrorSchedule: {},
      operational: {
        createdAt: nowIso(),
        flowType: "health",
        insureds: wizard.insureds,
        newPolicies: wizard.newPolicies,
        primary: primary.data
      }
    };
  }

  function validateStep(step) {
    const d = primaryData();
    if (step === 1) {
      if (!String(d.firstName || "").trim()) return "נא למלא שם פרטי";
      if (!String(d.lastName || "").trim()) return "נא למלא שם משפחה";
      if (String(d.idNumber || "").trim().length < 5) return "נא למלא ת.ז. תקינה";
      if (!String(d.phone || "").trim()) return "נא למלא טלפון";
    }
    if (step === 2 && !wizard.newPolicies.length) {
      return "הוסף לפחות פוליסה חדשה";
    }
    return "";
  }

  async function duplicateCustomer(idNumber) {
    if (idNumber.length < 5) return false;
    const rows = await APP().apiGet("customers", {
      id_number: `eq.${idNumber}`,
      select: "id",
      limit: "3"
    });
    return rows.length > 0;
  }

  async function saveDraft() {
    const session = APP().getSession();
    const d = primaryData();
    const idNum = String(d.idNumber || "").trim();
    if (await duplicateCustomer(idNum)) throw new Error("הלקוח כבר קיים במערכת");

    if (!wizard.proposalId) wizard.proposalId = newProposalId();
    const row = {
      id: wizard.proposalId,
      status: "פתוחה",
      full_name: fullName(),
      id_number: idNum,
      phone: d.phone || "",
      email: d.email || "",
      city: d.city || "",
      agent_name: session.displayName || "",
      agent_role: session.role || "",
      created_at: wizard.createdAtIso,
      updated_at: nowIso(),
      current_step: wizard.currentStep,
      insured_count: wizard.insureds.length,
      payload: buildDraftPayload()
    };
    await APP().apiUpsert("proposals", row);
    return wizard.proposalId;
  }

  async function finishWizard() {
    await saveDraft();
    const session = APP().getSession();
    const d = primaryData();
    const idNum = String(d.idNumber || "").trim();
    const payload = buildDraftPayload();
    const customerId = "cust_" + Math.random().toString(36).slice(2, 18);
    const row = {
      id: customerId,
      status: "חדש",
      full_name: fullName(),
      id_number: idNum,
      phone: d.phone || "",
      email: d.email || "",
      city: d.city || "",
      agent_name: session.displayName || "",
      agent_role: session.role || "",
      created_at: nowIso(),
      updated_at: nowIso(),
      insured_count: wizard.insureds.length,
      existing_policies_count: 0,
      new_policies_count: wizard.newPolicies.length,
      wizard_completed: true,
      payload
    };
    await APP().apiUpsert("customers", row);
    if (wizard.proposalId) {
      await APP().apiUpsert("proposals", {
        id: wizard.proposalId,
        status: "הושלמה",
        updated_at: nowIso(),
        current_step: 8
      });
    }
    return customerId;
  }

  function readStep1() {
    const d = primaryData();
    d.firstName = $("#wizFirstName").value.trim();
    d.lastName = $("#wizLastName").value.trim();
    d.idNumber = $("#wizIdNumber").value.trim();
    d.phone = $("#wizPhone").value.trim();
    d.email = $("#wizEmail").value.trim();
    d.city = $("#wizCity").value.trim();
    d.gender = $("#wizGender").value;
    d.birthDate = $("#wizBirthDate").value.trim();
  }

  function fillStep1() {
    const d = primaryData();
    $("#wizFirstName").value = d.firstName || "";
    $("#wizLastName").value = d.lastName || "";
    $("#wizIdNumber").value = d.idNumber || "";
    $("#wizPhone").value = d.phone || "";
    $("#wizEmail").value = d.email || "";
    $("#wizCity").value = d.city || "";
    $("#wizGender").value = d.gender || "";
    $("#wizBirthDate").value = d.birthDate || "";
  }

  function renderPolicies() {
    const list = $("#wizPolicyList");
    if (!wizard.newPolicies.length) {
      list.innerHTML = `<div class="ivEmpty">טרם נוספו פוליסות</div>`;
      return;
    }
    list.innerHTML = wizard.newPolicies.map((p, i) => `
      <article class="ivListItem ivListItem--row">
        <div>
          <div class="ivListItem__title">${APP().escapeHtml(p.productLabel || "פוליסה")}</div>
          <div class="ivListItem__sub">${APP().formatMoney(p.premiumMonthly)}/חודש</div>
        </div>
        <button type="button" class="ivBtn ivBtn--ghost ivBtn--sm" data-remove-policy="${i}">הסר</button>
      </article>
    `).join("");
    list.querySelectorAll("[data-remove-policy]").forEach(btn => {
      btn.addEventListener("click", () => {
        wizard.newPolicies.splice(Number(btn.dataset.removePolicy), 1);
        renderPolicies();
      });
    });
  }

  function renderReview() {
    readStep1();
    const total = wizard.newPolicies.reduce((s, p) => s + (Number(p.premiumMonthly) || 0), 0);
    $("#wizReview").innerHTML = `
      <article class="ivListItem">
        <div class="ivListItem__title">${APP().escapeHtml(fullName())}</div>
        <div class="ivListItem__sub">${APP().escapeHtml(primaryData().phone || "")} · ${APP().escapeHtml(primaryData().city || "")}</div>
        <div class="ivListItem__meta">
          <span>${wizard.newPolicies.length} פוליסות חדשות</span>
          <span class="ivListItem__amount">${APP().formatMoney(total)}/חודש</span>
        </div>
      </article>
    `;
  }

  function showWizardStep(step) {
    wizard.currentStep = step;
    $$(".ivWizardStep").forEach(el => { el.hidden = el.dataset.step !== String(step); });
    $("#wizStepLabel").textContent = `שלב ${step} מתוך 3`;
    $("#wizBackBtn").hidden = step === 1;
    $("#wizNextBtn").textContent = step === 3 ? "סיים ושמור לקוח" : "המשך";
    $("#wizDraftBtn").hidden = step !== 3;
    if (step === 1) fillStep1();
    if (step === 2) renderPolicies();
    if (step === 3) renderReview();
  }

  function bindWizardEvents() {
    $("#wizAddPolicyBtn").addEventListener("click", () => {
      const productLabel = $("#wizProductLabel").value.trim();
      const premium = Number($("#wizPremium").value);
      if (!productLabel) {
        APP().toast("נא למלא סוג ביטוח");
        return;
      }
      if (!Number.isFinite(premium) || premium <= 0) {
        APP().toast("נא למלא פרמיה חודשית");
        return;
      }
      wizard.newPolicies.push({ productLabel, premiumMonthly: premium });
      $("#wizProductLabel").value = "";
      $("#wizPremium").value = "";
      renderPolicies();
    });

    $("#wizBackBtn").addEventListener("click", () => {
      if (wizard.currentStep > 1) showWizardStep(wizard.currentStep - 1);
    });

    $("#wizDraftBtn").addEventListener("click", async () => {
      readStep1();
      $("#wizDraftBtn").disabled = true;
      try {
        await saveDraft();
        APP().toast("הטיוטה נשמרה");
        APP().refreshData();
      } catch (err) {
        APP().toast(err.message || "שגיאה בשמירה");
      } finally {
        $("#wizDraftBtn").disabled = false;
      }
    });

    $("#wizNextBtn").addEventListener("click", async () => {
      readStep1();
      const err = validateStep(wizard.currentStep);
      if (err) {
        APP().toast(err);
        return;
      }
      if (wizard.currentStep < 3) {
        showWizardStep(wizard.currentStep + 1);
        return;
      }
      const btn = $("#wizNextBtn");
      btn.disabled = true;
      btn.textContent = "שומר…";
      try {
        await finishWizard();
        APP().toast("הלקוח נשמר בהצלחה");
        await APP().refreshData();
        APP().showView("dashboard");
      } catch (e) {
        APP().toast(e.message || "שגיאה בשמירה");
      } finally {
        btn.disabled = false;
        btn.textContent = "סיים ושמור לקוח";
      }
    });

    $("#wizCloseBtn").addEventListener("click", () => {
      if (confirm("לצאת מהאשף? שינויים שלא נשמרו יאבדו.")) {
        APP().showView("dashboard");
      }
    });
  }

  function startWizard() {
    wizard = createSession();
    showWizardStep(1);
    APP().showView("wizard");
  }

  window.InvestoWizard = { init: bindWizardEvents, start: startWizard };
})();
