(function () {
  "use strict";

  var URL = "https://vhvlkerectggovfihjgm.supabase.co";
  var KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";

  function $(id) { return document.getElementById(id); }
  function trim(value) { return String(value == null ? "" : value).trim(); }

  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      (regs || []).forEach(function (reg) { try { reg.unregister(); } catch (_e) {} });
    }).catch(function () {});
  }

  var params = new URLSearchParams(location.search);
  var token = trim(params.get("t"));
  var stream = null;
  var photo = "";

  function say(message) {
    $("err").textContent = message || "";
  }

  function stopCamera() {
    if (!stream) return;
    stream.getTracks().forEach(function (track) { try { track.stop(); } catch (_e) {} });
    stream = null;
  }

  function buttons(html) {
    $("actions").innerHTML = html;
  }

  function bind(id, fn) {
    var node = $(id);
    if (node) node.addEventListener("click", fn);
  }

  function showCamera() {
    $("video").hidden = false;
    $("shot").style.display = "none";
    $("composer").hidden = true;
    $("done").style.display = "none";
    buttons('<button class="go" id="snap" type="button">צילום</button>');
    bind("snap", takePhoto);
  }

  function openCamera() {
    say("");
    if (!token || token.length < 16) {
      say("סרקו שוב את הקוד שעל המסך.");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      say("המצלמה לא זמינה בדפדפן הזה.");
      return;
    }
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } }
    }).then(function (media) {
      stream = media;
      var video = $("video");
      video.srcObject = media;
      return video.play();
    }).then(showCamera).catch(function () {
      say("לא נפתחה המצלמה. אשרו גישה למצלמה ונסו שוב.");
    });
  }

  function frame() {
    var video = $("video");
    var width = video.videoWidth || 720;
    var height = video.videoHeight || 960;
    var maxW = 720;
    var scale = Math.min(1, maxW / width);
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    var ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    var quality = 0.72;
    var data = canvas.toDataURL("image/jpeg", quality);
    while (data.length > 850000 && quality > 0.42) {
      quality -= 0.08;
      data = canvas.toDataURL("image/jpeg", quality);
    }
    return data;
  }

  function takePhoto() {
    say("");
    try { photo = frame(); }
    catch (_e) {
      say("לא נשמרה תמונה. נסו לצלם שוב.");
      return;
    }
    if (!photo || photo.indexOf("data:image/jpeg;base64,") !== 0) {
      say("לא נשמרה תמונה. נסו לצלם שוב.");
      return;
    }
    stopCamera();
    $("video").hidden = true;
    var shot = $("shot");
    shot.src = photo;
    shot.style.display = "block";
    $("composer").hidden = false;
    buttons('<button class="back" id="again" type="button">צילום מחדש</button><button class="go" id="send" type="button">אישור</button>');
    bind("again", function () { photo = ""; openCamera(); });
    bind("send", sendPhoto);
  }

  function fail(code) {
    if (code === "BAD_TOKEN") return "הקוד כבר לא בתוקף. סרקו שוב מהמסך.";
    if (code === "BUSY") return "יש כבר תמונה על המסך. נסו אחרי שתסתיים.";
    if (code === "TOO_BIG") return "התמונה גדולה מדי. צלמו שוב.";
    return "התמונה לא עלתה. נסו שוב.";
  }

  function sendPhoto() {
    say("");
    if (!photo) {
      say("קודם מצלמים.");
      return;
    }
    var send = $("send");
    if (send) send.disabled = true;
    fetch(URL + "/rest/v1/rpc/gi_publish_plasma_model", {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: "Bearer " + KEY,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_token: token,
        p_image: photo,
        p_caption: trim($("line").value).slice(0, 80)
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, data: data };
      });
    }).then(function (result) {
      var data = result.data || {};
      if (!result.ok || data.ok !== true) {
        if (send) send.disabled = false;
        say(fail(data.error || data.message || ""));
        return;
      }
      $("lead").hidden = true;
      $("shot").style.display = "none";
      $("composer").hidden = true;
      $("actions").hidden = true;
      $("done").style.display = "block";
    }).catch(function () {
      if (send) send.disabled = false;
      say("אין חיבור. נסו שוב.");
    });
  }

  $("open").addEventListener("click", openCamera);
})();
