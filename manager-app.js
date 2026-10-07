(function () {
  const CREDS = { user: "manager", pass: "demo1234", code: "482913" };
  const SESSION = "onyx-manager-session";

  const leads = [
    ["י", "יוסי אברהם", "מור לוי", "בריאות", "₪1,240"],
    ["ר", "רינת דהן", "דנה כהן", "פרט", "₪860"],
    ["א", "אבי חדד", "אורי ביטון", "משכנתא", "₪2,150"],
    ["מ", "מיכל ברק", "נועה פרץ", "בריאות", "₪1,480"],
    ["ע", "עומר שמש", "מור לוי", "פרט", "₪640"],
    ["ה", "הילה נחום", "דנה כהן", "פנסיה", "₪1,920"]
  ];
  const agents = [
    ["מור לוי", "₪14,200", ["בריאות 6,400", "פרט 3,200", "אלמנטרי 1,800", "פנסיה 2,800"]],
    ["דנה כהן", "₪12,450", ["בריאות 4,100", "פרט 5,200", "אלמנטרי 1,150", "פנסיה 2,000"]],
    ["אורי ביטון", "₪11,080", ["בריאות 3,800", "פרט 2,400", "אלמנטרי 3,200", "פנסיה 1,680"]],
    ["נועה פרץ", "₪11,020", ["בריאות 4,600", "פרט 2,900", "אלמנטרי 1,400", "פנסיה 2,120"]]
  ];
  const companies = [
    ["הראל", "100%", "₪14,200"],
    ["מגדל", "81%", "₪11,450"],
    ["כלל", "68%", "₪9,600"],
    ["הפניקס", "55%", "₪7,800"],
    ["מנורה", "40%", "₪5,700"]
  ];

  const $ = (sel) => document.querySelector(sel);
  const userEl = $("#user");
  const passEl = $("#pass");
  const loginErr = $("#login-err");
  const mfaErr = $("#mfa-err");
  const otp = Array.from(document.querySelectorAll(".otp input"));

  function show(name) {
    document.querySelectorAll("[data-view]").forEach((view) => {
      view.hidden = view.getAttribute("data-view") !== name;
    });
  }

  function tab(name) {
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-panel") !== name;
    });
    document.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.classList.toggle("on", btn.getAttribute("data-tab") === name);
    });
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "בוקר טוב";
    if (hour < 17) return "צהריים טובים";
    if (hour < 21) return "ערב טוב";
    return "לילה טוב";
  }

  function todayLabel() {
    return new Intl.DateTimeFormat("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(new Date());
  }

  function clock() {
    return new Intl.DateTimeFormat("he-IL", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());
  }

  function render() {
    $("#panel-home").innerHTML = `
      <div class="hello">
        <div><b>${greeting()}, דנה</b><span>${todayLabel()}</span></div>
        <em>עודכן ${clock()}</em>
      </div>
      <article class="hero">
        <div class="hero__k">נמכר היום</div>
        <div class="hero__v" dir="ltr">₪48,750</div>
        <div class="hero__s">14 פוליסות · 9 לקוחות · כל הסוכנות</div>
      </article>
      <article class="card leads">
        <div class="leads__top">
          <div><span class="k">לידים שנסגרו היום</span><strong dir="ltr">6</strong></div>
          <button class="linkish" type="button" data-open="leads">הצג הכל</button>
        </div>
        <div class="mini"><div><b>יוסי אברהם</b><span>מור לוי · בריאות</span></div><span class="amt" dir="ltr">₪1,240</span></div>
        <div class="mini"><div><b>רינת דהן</b><span>דנה כהן · ביטוח פרט</span></div><span class="amt" dir="ltr">₪860</span></div>
      </article>
      <div class="metrics">
        <article class="card metric"><span>פרמיה חודשית נטו</span><b dir="ltr">₪612,400</b><small class="up" dir="ltr">▲ 8.4%</small></article>
        <article class="card metric"><span>פרמיה מהפקה</span><b dir="ltr">₪186,200</b><small class="mute">42 פוליסות</small></article>
        <article class="card metric"><span>פרמיה בביטול</span><b dir="ltr">₪24,800</b><small class="down">6 פוליסות</small></article>
        <article class="card metric"><span>עמידה ביעד</span><b dir="ltr">73%</b><small class="mute" dir="ltr">יעד ₪840,000</small></article>
        <article class="card metric"><span>ממוצע ללקוח</span><b dir="ltr">₪1,084</b><small class="mute">החודש</small></article>
        <article class="card metric"><span>לידים שנסגרו</span><b dir="ltr">6</b><small class="mute">היום</small></article>
      </div>
      <article class="card split">
        <div><span>מכירות מודיעין</span><b dir="ltr">₪312,600</b></div>
        <div><span>מכירות חיפה</span><b dir="ltr">₪299,800</b></div>
      </article>`;

    $("#panel-leads").innerHTML = `
      <div class="sheet-head"><h2>לידים שנסגרו</h2><span>היום</span></div>
      <article class="card sumline"><span>6 לידים · 4 נציגים</span><b dir="ltr">₪8,290</b></article>
      ${leads.map((row) => `
        <article class="card lead">
          <div class="avatar">${row[0]}</div>
          <div class="lead__mid"><b>${row[1]}</b><span>${row[2]} <i class="tag">${row[3]}</i></span></div>
          <div class="lead__amt" dir="ltr">${row[4]}</div>
        </article>`).join("")}`;

    $("#panel-sales").innerHTML = `
      <div class="sheet-head"><h2>פירוט מכירות</h2><span dir="ltr">היום · ₪48,750</span></div>
      ${agents.map((row) => `
        <article class="card agent">
          <div class="agent__top"><b>${row[0]}</b><span dir="ltr">${row[1]}</span></div>
          <div class="chips">${row[2].map((chip) => `<i>${chip}</i>`).join("")}</div>
        </article>`).join("")}
      <article class="card co">
        ${companies.map((row) => `
          <div class="co__row"><span>${row[0]}</span><div class="bar"><i style="width:${row[1]}"></i></div><b dir="ltr">${row[2]}</b></div>`).join("")}
      </article>`;

    document.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => tab(btn.getAttribute("data-open")));
    });
  }

  function enterApp() {
    sessionStorage.setItem(SESSION, "1");
    render();
    tab("home");
    show("app");
  }

  function clearOtp() {
    otp.forEach((box) => {
      box.value = "";
      box.classList.remove("is-error");
    });
  }

  $("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const ok = userEl.value.trim() === CREDS.user && passEl.value === CREDS.pass;
    userEl.classList.toggle("is-error", !ok);
    passEl.classList.toggle("is-error", !ok);
    if (!ok) {
      loginErr.textContent = "שם משתמש או סיסמה שגויים";
      return;
    }
    loginErr.textContent = "";
    clearOtp();
    mfaErr.textContent = "";
    show("mfa");
    otp[0].focus();
  });

  userEl.addEventListener("input", () => {
    userEl.classList.remove("is-error");
    loginErr.textContent = "";
  });
  passEl.addEventListener("input", () => {
    passEl.classList.remove("is-error");
    loginErr.textContent = "";
  });

  otp.forEach((box, index) => {
    box.addEventListener("input", () => {
      box.value = box.value.replace(/\D/g, "").slice(-1);
      box.classList.remove("is-error");
      mfaErr.textContent = "";
      if (box.value && otp[index + 1]) otp[index + 1].focus();
    });
    box.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !box.value && otp[index - 1]) otp[index - 1].focus();
    });
    box.addEventListener("paste", (event) => {
      const text = (event.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      if (!text) return;
      event.preventDefault();
      text.split("").forEach((ch, i) => {
        if (otp[i]) otp[i].value = ch;
      });
      otp[Math.min(text.length, 5)].focus();
    });
  });

  $("#mfa-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = otp.map((box) => box.value).join("");
    if (code !== CREDS.code) {
      otp.forEach((box) => box.classList.add("is-error"));
      mfaErr.textContent = "הקוד שגוי";
      return;
    }
    enterApp();
  });

  $("#back-login").addEventListener("click", () => {
    clearOtp();
    mfaErr.textContent = "";
    show("login");
  });

  $("#logout").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION);
    passEl.value = "";
    show("login");
  });

  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => tab(btn.getAttribute("data-tab")));
  });

  if (sessionStorage.getItem(SESSION) === "1") enterApp();
})();
