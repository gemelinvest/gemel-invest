/* BUILD: 2026-02-26_09-37-53+0000 | PATCH: remove_customer_file_build_new_customer_flow_add_insured_policies | FILE: app.js */
(() => {
  "use strict";

  // =====================================================
  // GEMEL INVEST CRM — New Customer Flow Only (No Customer File)
  // - Removes customer file UI and customer list UI
  // - Adds "הוסף ביטוח" → add insured (spouse/adult/minor) across all steps
  // - Policies per insured + grouped summary on step 5
  // =====================================================

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const on = (el, evt, fn, opts) => { if(el && el.addEventListener) el.addEventListener(evt, fn, opts); };
  const safeTrim = (v) => String(v ?? "").trim();
  const uid = () => "i_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

  // ---------------------------
  // Minimal Auth (kept simple)
  // ---------------------------
  const Auth = {
    current: null,

    init() {
      this.els = {
        wrap: $("#lcLogin"),
        form: $("#lcLoginForm"),
        user: $("#lcLoginUser"),
        pin: $("#lcLoginPin"),
        remember: $("#lcLoginRemember"),
        err: $("#lcLoginError"),
      };
      // show login overlay by default
      try {
        if (this.els.wrap) this.els.wrap.setAttribute("aria-hidden", "false");
        document.body.classList.add("lcAuthLock");
      } catch(_){}

      on(this.els.form, "submit", (e) => {
        e.preventDefault();
        this.login();
      });
    },

    login() {
      const u = safeTrim(this.els.user?.value);
      const p = safeTrim(this.els.pin?.value);
      this.setError("");
      if(!u) return this.setError("נא להזין שם משתמש");
      if(!p) return this.setError("נא להזין קוד כניסה");

      // Default admin
      if(u === "מנהל מערכת" && p === "1234") {
        this.current = { name: "מנהל מערכת", role: "admin" };
        this.unlock();
        return;
      }
      // Optional: allow any agent PIN 0000 for now (pilot)
      if(p === "0000") {
        this.current = { name: u, role: "agent" };
        this.unlock();
        return;
      }
      return this.setError("פרטי התחברות שגויים");
    },

    unlock() {
      try {
        document.body.classList.remove("lcAuthLock");
        if (this.els.wrap) this.els.wrap.setAttribute("aria-hidden", "true");
      } catch(_){}
      try { UI.showUserPill(); } catch(_){}
    },

    logout() {
      this.current = null;
      try {
        document.body.classList.add("lcAuthLock");
        if (this.els.wrap) this.els.wrap.setAttribute("aria-hidden", "false");
      } catch(_){}
      try { UI.hideUserPill(); } catch(_){}
    },

    setError(msg) {
      try { if(this.els.err) this.els.err.textContent = msg ? String(msg) : ""; } catch(_){}
    }
  };

  // ---------------------------
  // Insured model (in-modal only)
  // ---------------------------
  const KIND = {
    spouse: "בן/בת זוג",
    adult: "בגיר",
    minor: "קטין"
  };

  const Flow = {
    insureds: [
      { id: "primary", kind: "primary", label: "מבוטח ראשי" }
    ],
    // policies: { insuredId: [{company, product, number, premium, status, _id}] }
    policies: {},
  };

  // ---------------------------
  // UI
  // ---------------------------
  const UI = {
    init() {
      this.els = {
        // top
        btnNewCustomer: $("#btnNewCustomer"),
        userPill: $("#lcUserPill"),
        userPillText: $("#lcUserPillText"),
        btnLogout: $("#btnLogout"),

        // modal customer
        modalCustomer: $("#modalCustomer"),
        customerForm: $("#customerForm"),
        custSteps: $("#custSteps"),
        custTabs: $$(".lcTab", $("#modalCustomer")),
        progressBar: $("#custProgressBar"),
        progressText: $("#custProgressText"),

        // add insured
        btnAddInsured: $("#btnAddInsured"),
        modalAddInsured: $("#modalAddInsured"),

        // extra containers
        extra1: $("#insuredExtraStep1"),
        extra2: $("#insuredExtraStep2"),
        extra3: $("#insuredExtraStep3"),

        // policies & cancel
        policiesByInsured: $("#policiesByInsured"),
        cancelByInsured: $("#cancelByInsured"),
      };

      // open new-customer modal
      on(this.els.btnNewCustomer, "click", () => this.openCustomerModal());

      // close modals by backdrop / close buttons
      this.bindModalClose(this.els.modalCustomer);
      this.bindModalClose(this.els.modalAddInsured);

      // user pill
      on(this.els.btnLogout, "click", () => { Auth.logout(); });

      // add insured flow
      on(this.els.btnAddInsured, "click", () => this.openAddInsuredModal());
      on(this.els.modalAddInsured, "click", (e) => {
        const btn = e.target?.closest?.("[data-insured-kind]");
        if(!btn) return;
        const kind = safeTrim(btn.getAttribute("data-insured-kind"));
        if(!KIND[kind]) return;
        this.addInsured(kind);
        this.closeModal(this.els.modalAddInsured);
      });

      // step tabs
      this.els.custTabs.forEach(tab => {
        on(tab, "click", () => {
          const s = Number(tab.getAttribute("data-step") || 1);
          this.goStep(s);
        });
      });

      // live bindings: spouse copies address & children from primary
      this.bindPrimaryMirrors();

      // initial render
      this.goStep(1);
      this.renderAllExtras();
      this.renderPolicies();
      this.renderCancelSummary();
    },

    showUserPill() {
      if(this.els.userPill) this.els.userPill.style.display = "inline-flex";
      if(this.els.userPillText) this.els.userPillText.textContent = "מחובר: " + (Auth.current?.name || "משתמש");
    },
    hideUserPill() {
      if(this.els.userPill) this.els.userPill.style.display = "none";
    },

    bindModalClose(modal) {
      if(!modal) return;
      on(modal, "click", (e) => {
        const close = e.target?.closest?.("[data-close]");
        if(close) this.closeModal(modal);
      });
      on(document, "keydown", (e) => {
        if(e.key === "Escape" && modal.classList.contains("is-open")) this.closeModal(modal);
      });
    },

    openModal(modal) {
      if(!modal) return;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
    },
    closeModal(modal) {
      if(!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    },

    openCustomerModal() {
      // reset flow each time we start a new customer
      Flow.insureds = [{ id: "primary", kind: "primary", label: "מבוטח ראשי" }];
      Flow.policies = {};
      try { this.els.customerForm?.reset?.(); } catch(_){}
      this.renderAllExtras();
      this.renderPolicies();
      this.renderCancelSummary();
      this.goStep(1);
      this.openModal(this.els.modalCustomer);
    },

    openAddInsuredModal() {
      this.openModal(this.els.modalAddInsured);
    },

    addInsured(kind) {
      const id = uid();
      Flow.insureds.push({ id, kind, label: "מבוטח משני: " + KIND[kind] });
      this.renderAllExtras();
      this.renderPolicies();
      this.renderCancelSummary();
      // if spouse, mirror immediately
      this.applyMirrorsToSpouse();
    },

    removeInsured(id) {
      if(id === "primary") return;
      Flow.insureds = Flow.insureds.filter(x => x.id !== id);
      delete Flow.policies[id];
      this.renderAllExtras();
      this.renderPolicies();
      this.renderCancelSummary();
    },

    goStep(step) {
      const steps = $$(".lcStep", this.els.custSteps);
      steps.forEach(s => s.classList.toggle("is-active", Number(s.getAttribute("data-step")) === step));
      this.els.custTabs.forEach(t => t.classList.toggle("is-active", Number(t.getAttribute("data-step")) === step));
      this.updateProgress();
    },

    updateProgress() {
      const active = Number($(".lcStep.is-active", this.els.custSteps)?.getAttribute("data-step") || 1);
      const pct = Math.round((active-1) / 4 * 100);
      if(this.els.progressBar) this.els.progressBar.style.width = pct + "%";
      if(this.els.progressText) this.els.progressText.textContent = "שלב " + active + " מתוך 5";
    },

    // ---- mirrors (spouse) ----
    bindPrimaryMirrors() {
      const form = this.els.customerForm;
      if(!form) return;
      const addr = form.querySelector('[name="address"]');
      const kids = form.querySelector('[name="childrenCount"]');
      on(addr, "input", () => this.applyMirrorsToSpouse());
      on(kids, "input", () => this.applyMirrorsToSpouse());
    },

    applyMirrorsToSpouse() {
      const form = this.els.customerForm;
      if(!form) return;
      const primaryAddr = safeTrim(form.querySelector('[name="address"]')?.value);
      const primaryKids = safeTrim(form.querySelector('[name="childrenCount"]')?.value);

      Flow.insureds.filter(x => x.kind === "spouse").forEach(sp => {
        const root = form.querySelector('[data-insured-id="'+sp.id+'"]');
        if(!root) return;
        const addrEl = root.querySelector('[data-mirror="address"]');
        const kidsEl = root.querySelector('[data-mirror="childrenCount"]');
        if(addrEl) {
          addrEl.value = primaryAddr;
          addrEl.setAttribute("readonly", "readonly");
        }
        if(kidsEl) {
          kidsEl.value = primaryKids;
          kidsEl.setAttribute("readonly", "readonly");
        }
      });
    },

    // ---- extra insured fields ----
    renderAllExtras() {
      this.renderExtrasForStep(1, this.els.extra1, {
        fields: [
          { name:"firstName", label:"שם פרטי", type:"text", required:true },
          { name:"lastName", label:"שם משפחה", type:"text", required:true },
          { name:"idNumber", label:"ת״ז", type:"text" },
          { name:"birthDate", label:"תאריך לידה", type:"date" },
          { name:"gender", label:"מין", type:"select", options:["","זכר","נקבה"] },
          { name:"maritalStatus", label:"מצב משפחתי", type:"select", options:["","רווק/ה","נשוי/אה","גרוש/ה","אלמן/ה","ידוע/ה בציבור"] },
          { name:"childrenCount", label:"ילדים", type:"number", mirror:"childrenCount" },
        ]
      });

      this.renderExtrasForStep(2, this.els.extra2, {
        fields: [
          { name:"phone", label:"טלפון", type:"text", required:true },
          { name:"email", label:"מייל", type:"email" },
          { name:"address", label:"כתובת", type:"text", mirror:"address" },
          { name:"zipCode", label:"מיקוד", type:"text" },
        ]
      });

      this.renderExtrasForStep(3, this.els.extra3, {
        fields: [
          { name:"smoker", label:"עישון", type:"select", options:["","כן","לא"] },
          { name:"occupation", label:"עיסוק", type:"text" },
          { name:"heightCm", label:"גובה (ס״מ)", type:"number" },
          { name:"weightKg", label:"משקל (ק״ג)", type:"number" },
          { name:"hmo", label:"קופת חולים", type:"text" },
          { name:"supplemental", label:"שב״ן", type:"text" },
        ]
      });

      this.applyMirrorsToSpouse();
    },

    renderExtrasForStep(step, host, schema) {
      if(!host) return;
      host.innerHTML = "";
      const extras = Flow.insureds.filter(x => x.id !== "primary");
      if(!extras.length) return;

      extras.forEach(ins => {
        const card = document.createElement("div");
        card.className = "lcInsuredCard";
        card.setAttribute("data-insured-id", ins.id);
        card.setAttribute("data-insured-kind", ins.kind);

        card.innerHTML = ''
          + '<div class="lcInsuredCard__head">'
          +   '<div>'
          +     '<div class="lcInsuredCard__title">'+ this.escape(ins.label) +'</div>'
          +     '<div class="lcInsuredCard__sub">שלב '+ step +'</div>'
          +   '</div>'
          +   '<button class="btn btn--danger lcInsuredRemoveBtn" type="button" data-remove-insured="'+ ins.id +'">הסר</button>'
          + '</div>'
          + '<div class="lcInsuredCard__body"><div class="formGrid"></div></div>';

        const grid = $(".formGrid", card);
        schema.fields.forEach(f => {
          const field = document.createElement("div");
          field.className = "field";
          const req = f.required ? "required" : "";
          let inputHtml = "";

          if(f.type === "select") {
            const opts = (f.options || []).map(v => '<option value="'+this.escape(v)+'">'+ (v ? this.escape(v) : "—") +'</option>').join("");
            inputHtml = '<select class="input" name="insured_'+ins.id+'__'+f.name+'">'+opts+'</select>';
          } else {
            const t = f.type || "text";
            const mirrorAttr = f.mirror ? ' data-mirror="'+f.mirror+'"' : "";
            inputHtml = '<input class="input" name="insured_'+ins.id+'__'+f.name+'" type="'+t+'" '+req+mirrorAttr+' />';
          }

          field.innerHTML = '<label class="label">'+this.escape(f.label)+'</label>' + inputHtml;
          grid.appendChild(field);
        });

        host.appendChild(card);
      });

      on(host, "click", (e) => {
        const b = e.target?.closest?.("[data-remove-insured]");
        if(!b) return;
        const id = safeTrim(b.getAttribute("data-remove-insured"));
        this.removeInsured(id);
      });
    },

    // ---- policies per insured ----
    renderPolicies() {
      const host = this.els.policiesByInsured;
      if(!host) return;
      host.innerHTML = "";

      Flow.insureds.forEach(ins => {
        const block = document.createElement("div");
        block.className = "lcPoliciesBlock";
        block.setAttribute("data-insured-id", ins.id);

        const title = ins.id === "primary" ? "מבוטח ראשי" : ins.label;

        block.innerHTML = ''
          + '<div class="lcPoliciesBlock__head">'
          +   '<div class="lcPoliciesBlock__title">'+ this.escape(title) +'</div>'
          +   '<div class="row" style="gap:8px">'
          +     (ins.id !== "primary" ? '<button class="btn btn--danger" type="button" data-remove-insured="'+ins.id+'">הסר מבוטח</button>' : '')
          +   '</div>'
          + '</div>'
          + '<div class="lcPoliciesBlock__body">'
          +   '<div class="lcPoliciesForm">'
          +     '<div class="field"><label class="label">חברה</label><input class="input" data-pol="company" type="text" placeholder="לדוגמה: הראל" /></div>'
          +     '<div class="field"><label class="label">סוג ביטוח</label><input class="input" data-pol="product" type="text" placeholder="לדוגמה: בריאות" /></div>'
          +     '<div class="field"><label class="label">מספר פוליסה</label><input class="input" data-pol="number" type="text" /></div>'
          +     '<div class="field"><label class="label">פרמיה חודשית</label><input class="input" data-pol="premium" type="number" min="0" step="1" placeholder="0" /></div>'
          +     '<div class="field"><label class="label">סטטוס</label>'
          +       '<select class="input" data-pol="status">'
          +         '<option value="פעיל">פעיל</option>'
          +         '<option value="ממתין לביטול">ממתין לביטול</option>'
          +         '<option value="בוטל">בוטל</option>'
          +         '<option value="שוחלף">שוחלף</option>'
          +       '</select>'
          +     '</div>'
          +     '<div class="field" style="display:flex; align-items:flex-end"><button class="btn btn--primary" type="button" data-add-policy="1">הוסף פוליסה</button></div>'
          +   '</div>'
          +   '<div class="tableWrap" style="padding:0">'
          +     '<table class="table">'
          +       '<thead><tr><th>חברה</th><th>סוג</th><th>מס׳ פוליסה</th><th>פרמיה</th><th>סטטוס</th><th></th></tr></thead>'
          +       '<tbody data-pol-tbody="1"></tbody>'
          +     '</table>'
          +   '</div>'
          + '</div>';

        host.appendChild(block);
        this.renderPoliciesTableForInsured(ins.id);
      });

      on(host, "click", (e) => {
        const block = e.target?.closest?.(".lcPoliciesBlock");
        if(!block) return;
        const insuredId = safeTrim(block.getAttribute("data-insured-id"));

        const addBtn = e.target?.closest?.("[data-add-policy]");
        if(addBtn) {
          const getVal = (k) => safeTrim(block.querySelector('[data-pol="'+k+'"]')?.value);
          const pol = {
            company: getVal("company"),
            product: getVal("product"),
            number: getVal("number"),
            premium: Number(getVal("premium") || 0),
            status: getVal("status") || "פעיל",
            _id: uid()
          };
          if(!pol.company && !pol.product && !pol.number) return;

          if(!Flow.policies[insuredId]) Flow.policies[insuredId] = [];
          Flow.policies[insuredId].push(pol);

          ["company","product","number","premium"].forEach(k => {
            const el = block.querySelector('[data-pol="'+k+'"]');
            if(el) el.value = "";
          });

          this.renderPoliciesTableForInsured(insuredId);
          this.renderCancelSummary();
          return;
        }

        const delBtn = e.target?.closest?.("[data-del-pol]");
        if(delBtn) {
          const pid = safeTrim(delBtn.getAttribute("data-del-pol"));
          Flow.policies[insuredId] = (Flow.policies[insuredId] || []).filter(p => p._id !== pid);
          this.renderPoliciesTableForInsured(insuredId);
          this.renderCancelSummary();
          return;
        }

        const remIns = e.target?.closest?.("[data-remove-insured]");
        if(remIns) {
          const id = safeTrim(remIns.getAttribute("data-remove-insured"));
          this.removeInsured(id);
          return;
        }
      });
    },

    renderPoliciesTableForInsured(insuredId) {
      const host = this.els.policiesByInsured?.querySelector?.('.lcPoliciesBlock[data-insured-id="'+insuredId+'"] [data-pol-tbody]');
      if(!host) return;
      const list = Flow.policies[insuredId] || [];
      host.innerHTML = list.map(p => ''
        + '<tr>'
        +   '<td>'+this.escape(p.company)+'</td>'
        +   '<td>'+this.escape(p.product)+'</td>'
        +   '<td>'+this.escape(p.number)+'</td>'
        +   '<td>₪'+Number(p.premium||0).toLocaleString("he-IL")+'</td>'
        +   '<td>'+this.escape(p.status)+'</td>'
        +   '<td><button class="btn btn--danger" type="button" data-del-pol="'+p._id+'">הסר</button></td>'
        + '</tr>'
      ).join("");
    },

    renderCancelSummary() {
      const host = this.els.cancelByInsured;
      if(!host) return;

      const blocks = Flow.insureds.map(ins => {
        const title = ins.id === "primary" ? "מבוטח ראשי" : ins.label;
        const list = Flow.policies[ins.id] || [];
        if(!list.length) {
          return ''
            + '<div class="lcPoliciesBlock">'
            +   '<div class="lcPoliciesBlock__head"><div class="lcPoliciesBlock__title">'+this.escape(title)+'</div></div>'
            +   '<div class="lcPoliciesBlock__body"><div class="muted">לא נוספו פוליסות למבוטח זה.</div></div>'
            + '</div>';
        }
        const rows = list.map(p => ''
          + '<tr>'
          +   '<td>'+this.escape(p.company)+'</td>'
          +   '<td>'+this.escape(p.product)+'</td>'
          +   '<td>'+this.escape(p.number)+'</td>'
          +   '<td>'+this.escape(p.status)+'</td>'
          + '</tr>'
        ).join("");
        return ''
          + '<div class="lcPoliciesBlock">'
          +   '<div class="lcPoliciesBlock__head"><div class="lcPoliciesBlock__title">'+this.escape(title)+'</div></div>'
          +   '<div class="tableWrap" style="padding:0">'
          +     '<table class="table">'
          +       '<thead><tr><th>חברה</th><th>סוג</th><th>מס׳ פוליסה</th><th>סטטוס</th></tr></thead>'
          +       '<tbody>'+rows+'</tbody>'
          +     '</table>'
          +   '</div>'
          + '</div>';
      }).join("");

      host.innerHTML = blocks;
    },

    escape(s) {
      return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }
  };

  // ---------------------------
  // Boot
  // ---------------------------
  document.addEventListener("DOMContentLoaded", () => {
    try { Auth.init(); } catch(_){}
    try { UI.init(); } catch(_){}
  });
})();
