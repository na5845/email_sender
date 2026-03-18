from flask import Flask, request, render_template_string, jsonify, Response
import os, threading, smtplib, time, openpyxl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.header import Header
from email import encoders
import config

app = Flask(__name__)
BASE = os.path.dirname(os.path.abspath(__file__))
ATTACHMENTS_FOLDER = os.path.join(BASE, "attachments")
os.makedirs(ATTACHMENTS_FOLDER, exist_ok=True)

state = {
    "excel_loaded": "", "pdf_loaded": "", "subject": "", "body": "",
    "is_html": False, "log": "", "done": False, "sending": False,
    "total": 0, "current": 0, "success": 0, "failed_count": 0
}

HTML = """<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>שליחת אימיילים</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 30px; }
    .card { background: white; border-radius: 12px; padding: 30px; max-width: 660px; margin: 0 auto; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; margin-top: 0; font-size: 22px; border-bottom: 2px solid #3498db; padding-bottom: 12px; }
    .section-title { color: #7f8c8d; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: bold; }
    input[type=text], textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; margin-bottom: 18px; font-family: Arial; }
    textarea { height: 160px; resize: vertical; }
    .upload-box { border: 2px dashed #3498db; border-radius: 8px; padding: 18px; text-align: center; color: #3498db; cursor: pointer; margin-bottom: 18px; background: #f8fbff; transition: background 0.2s; }
    .upload-box:hover { background: #eaf3fc; }
    .upload-box.done { border-color: #27ae60; color: #27ae60; background: #eafaf1; }
    .row { display: flex; gap: 10px; margin-bottom: 4px; }
    .btn { padding: 13px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold; color: white; }
    .btn-send  { flex: 3; background: #3498db; }
    .btn-reset { flex: 1; background: #e74c3c; }
    .btn-preview { background: #8e44ad; padding: 7px 14px; font-size: 13px; border: none; border-radius: 6px; color: white; cursor: pointer; }
    .btn:hover { opacity: 0.88; }
    .progress-wrap { margin-top: 24px; }
    .banner { border-radius: 8px; padding: 14px; font-size: 16px; font-weight: bold; margin-bottom: 10px; }
    .banner-sending { background: #eaf4fb; border: 1px solid #3498db; color: #2471a3; }
    .banner-done    { background: #eafaf1; border: 1px solid #27ae60; color: #1e8449; }
    .bar-track { background: #eee; border-radius: 8px; height: 18px; overflow: hidden; margin-bottom: 8px; }
    .bar-fill  { height: 100%; width: 0%; background: #3498db; border-radius: 8px; transition: width 0.4s; }
    .bar-fill.done { background: #27ae60; }
    .progress-txt { text-align: center; color: #666; font-size: 13px; margin-bottom: 10px; }
    .log-box { background: #1e2a38; border-radius: 8px; padding: 16px; color: #a8d8a8; font-family: monospace; font-size: 13px; max-height: 280px; overflow-y: auto; white-space: pre-wrap; }
    .hint { font-size: 12px; color: #999; margin-top: -14px; margin-bottom: 14px; }
    .label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  </style>
</head>
<body>
<div class="card">
  <h1>📧 שליחת אימיילים לקהילה</h1>

  <div id="msg-box" style="display:none;border-radius:8px;padding:12px;margin-bottom:16px;font-weight:bold;"></div>

  <!-- נושא -->
  <div class="section-title">נושא האימייל</div>
  <input type="text" id="subject" placeholder="לדוגמה: עדכון לחברי הקהילה">

  <!-- גוף -->
  <div class="label-row">
    <div class="section-title" style="margin-bottom:0">תוכן ההודעה</div>
    <div style="display:flex;align-items:center;gap:12px;">
      <label style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:5px;">
        <input type="checkbox" id="is_html" onchange="toggleHtml(this)"> מצב HTML
      </label>
      <button class="btn-preview" onclick="openPreview()">👁 תצוגה מקדימה</button>
    </div>
  </div>
  <textarea id="body" placeholder="כתוב כאן את תוכן האימייל..."></textarea>
  <div id="html-hint" class="hint" style="display:none;">💡 כתוב HTML מלא — יישלח כמו שהוא</div>

  <!-- Excel -->
  <div class="section-title">קובץ אנשי קשר (Excel)</div>
  <div class="upload-box" id="excel-box" onclick="document.getElementById('excel-input').click()">
    <input type="file" id="excel-input" accept=".xlsx,.xls" style="display:none" onchange="uploadFile(this,'excel')">
    <div id="excel-label">📊 לחץ להעלאת קובץ Excel</div>
  </div>

  <!-- PDF -->
  <div class="section-title">קובץ PDF מצורף</div>
  <div class="upload-box" id="pdf-box" onclick="document.getElementById('pdf-input').click()">
    <input type="file" id="pdf-input" accept=".pdf" style="display:none" onchange="uploadFile(this,'pdf')">
    <div id="pdf-label">📄 לחץ להעלאת PDF</div>
  </div>

  <!-- כפתורים -->
  <div class="row">
    <button class="btn btn-send"  onclick="sendEmails()">🚀 שלח לכולם</button>
    <button class="btn btn-reset" onclick="resetAll()">🔄 איפוס</button>
  </div>

  <!-- התקדמות -->
  <div id="progress-wrap" class="progress-wrap" style="display:none;">
    <div id="banner" class="banner banner-sending">⏳ שולח...</div>
    <div class="bar-track"><div id="bar" class="bar-fill"></div></div>
    <div id="progress-txt" class="progress-txt"></div>
    <div class="section-title">יומן שליחה</div>
    <div id="log-box" class="log-box"></div>
  </div>
</div>

<script>
// --- העלאת קבצים ---
function uploadFile(input, type) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  var fd = new FormData();
  fd.append("file", file);
  fd.append("type", type);

  showMsg("מעלה קובץ...", "#eaf4fb", "#2471a3");

  fetch("/upload", { method: "POST", body: fd })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        var box = document.getElementById(type + "-box");
        var lbl = document.getElementById(type + "-label");
        box.classList.add("done");
        lbl.textContent = "✅ " + data.message;
        showMsg(data.message, "#eafaf1", "#1e8449");
      } else {
        showMsg("❌ " + data.error, "#fdecea", "#c0392b");
      }
    })
    .catch(e => showMsg("❌ שגיאה בהעלאה: " + e, "#fdecea", "#c0392b"));
}

// --- שליחה ---
function sendEmails() {
  var subject = document.getElementById("subject").value.trim();
  var body    = document.getElementById("body").value.trim();
  var isHtml  = document.getElementById("is_html").checked;

  if (!subject || !body) { showMsg("❌ מלא נושא ותוכן הודעה", "#fdecea", "#c0392b"); return; }

  fetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, body, is_html: isHtml })
  })
  .then(r => r.json())
  .then(data => {
    if (data.ok) {
      document.getElementById("progress-wrap").style.display = "block";
      pollStatus();
    } else {
      showMsg("❌ " + data.error, "#fdecea", "#c0392b");
    }
  });
}

// --- סטטוס ---
function pollStatus() {
  fetch("/status").then(r => r.json()).then(data => {
    document.getElementById("progress-wrap").style.display = "block";
    if (data.total > 0) {
      var pct = Math.round(data.current / data.total * 100);
      document.getElementById("bar").style.width = pct + "%";
      document.getElementById("progress-txt").textContent =
        data.current + " מתוך " + data.total + "  |  ✅ " + data.success + "  ❌ " + data.failed_count;
    }
    var log = document.getElementById("log-box");
    log.textContent = data.log;
    log.scrollTop = log.scrollHeight;

    var banner = document.getElementById("banner");
    if (data.done) {
      banner.className = "banner banner-done";
      banner.textContent = "✅ הסתיים! נשלח: " + data.success + " | נכשל: " + data.failed_count;
      document.getElementById("bar").classList.add("done");
    } else {
      setTimeout(pollStatus, 2000);
    }
  });
}

// --- תצוגה מקדימה ---
function openPreview() {
  var body   = document.getElementById("body").value;
  var isHtml = document.getElementById("is_html").checked;
  var html   = isHtml ? body :
    '<html><head><meta charset="UTF-8"></head><body dir="rtl" style="font-family:Arial;font-size:16px;color:#333;line-height:1.8;padding:30px;">' +
    body.replace(/\\n/g, "<br>") + "</body></html>";

  fetch("/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html })
  }).then(() => window.open("/preview-view", "_blank"));
}

// --- איפוס ---
function resetAll() {
  fetch("/reset", { method: "POST" }).then(() => location.reload());
}

// --- עזרים ---
function toggleHtml(cb) {
  document.getElementById("html-hint").style.display = cb.checked ? "block" : "none";
}

function showMsg(text, bg, color) {
  var el = document.getElementById("msg-box");
  el.textContent = text;
  el.style.background = bg;
  el.style.color = color;
  el.style.border = "1px solid " + color;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 4000);
}

// בדוק סטטוס בטעינה (אם שליחה פעילה)
pollStatus();
</script>
</body>
</html>"""

preview_html_store = {"html": ""}


def load_emails(filepath):
    wb = openpyxl.load_workbook(filepath)
    ws = wb.active
    headers = [str(c.value).strip().lower() if c.value else "" for c in ws[1]]
    col = headers.index("email") if "email" in headers else 0
    return [str(r[col]).strip() for r in ws.iter_rows(min_row=2, values_only=True)
            if r[col] and "@" in str(r[col])]


def send_thread(emails, subject, body, pdf_path, is_html):
    global state
    state.update({"log": "", "done": False, "sending": True,
                  "total": len(emails), "current": 0, "success": 0, "failed_count": 0})

    html_body = body if is_html else (
        f'<html><head><meta charset="UTF-8"></head>'
        f'<body dir="rtl" style="font-family:Arial;font-size:16px;color:#333;line-height:1.8;padding:20px;">'
        f'{body.replace(chr(10), "<br>")}</body></html>'
    )

    try:
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465, local_hostname="localhost")
        server.login(config.SENDER_EMAIL, config.SENDER_PASSWORD)
    except Exception as e:
        state["log"] = f"שגיאת התחברות: {e}"
        state.update({"done": True, "sending": False})
        return

    for i, email in enumerate(emails, 1):
        state["current"] = i
        try:
            msg = MIMEMultipart("mixed")
            msg["From"] = config.SENDER_EMAIL
            msg["To"] = email
            msg["Subject"] = Header(subject, "utf-8")
            msg.attach(MIMEText(html_body, "html", "utf-8"))
            if pdf_path and os.path.exists(pdf_path):
                with open(pdf_path, "rb") as f:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(f.read())
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", "attachment",
                                filename=("utf-8", "", os.path.basename(pdf_path)))
                msg.attach(part)
            server.sendmail(config.SENDER_EMAIL, email, msg.as_string())
            state["success"] += 1
            state["log"] += f"✅ {email}\n"
        except Exception as e:
            state["failed_count"] += 1
            state["log"] += f"❌ {email} — {e}\n"
        time.sleep(config.DELAY_BETWEEN_EMAILS)

    server.quit()
    state.update({"done": True, "sending": False})


@app.route("/")
def index():
    return render_template_string(HTML)


@app.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("file")
    ftype = request.form.get("type")
    if not file or not file.filename:
        return jsonify({"ok": False, "error": "לא נבחר קובץ"})
    if ftype == "excel":
        path = os.path.join(BASE, "contacts.xlsx")
        file.save(path)
        emails = load_emails(path)
        state["excel_loaded"] = file.filename
        return jsonify({"ok": True, "message": f"{file.filename} — {len(emails)} כתובות"})
    elif ftype == "pdf":
        path = os.path.join(ATTACHMENTS_FOLDER, file.filename)
        file.save(path)
        config.ATTACHMENTS = [path]
        state["pdf_loaded"] = file.filename
        return jsonify({"ok": True, "message": f"{file.filename}"})
    return jsonify({"ok": False, "error": "סוג לא מוכר"})


@app.route("/send", methods=["POST"])
def send():
    if state["sending"]:
        return jsonify({"ok": False, "error": "שליחה כבר פעילה"})
    data = request.get_json()
    excel_path = os.path.join(BASE, "contacts.xlsx")
    if not os.path.exists(excel_path):
        return jsonify({"ok": False, "error": "חסר קובץ Excel — העלה קודם"})
    emails = load_emails(excel_path)
    pdf_path = config.ATTACHMENTS[0] if config.ATTACHMENTS else None
    t = threading.Thread(target=send_thread,
                         args=(emails, data["subject"], data["body"], pdf_path, data.get("is_html", False)))
    t.daemon = True
    t.start()
    return jsonify({"ok": True})


@app.route("/status")
def status():
    return jsonify(state)


@app.route("/preview", methods=["POST"])
def preview_store():
    preview_html_store["html"] = request.get_json().get("html", "")
    return jsonify({"ok": True})


@app.route("/preview-view")
def preview_view():
    return Response(preview_html_store["html"], mimetype="text/html")


@app.route("/reset", methods=["POST"])
def reset():
    state.update({"excel_loaded": "", "pdf_loaded": "", "log": "", "done": False,
                  "sending": False, "total": 0, "current": 0, "success": 0, "failed_count": 0})
    config.ATTACHMENTS = []
    excel_path = os.path.join(BASE, "contacts.xlsx")
    if os.path.exists(excel_path):
        os.remove(excel_path)
    return jsonify({"ok": True})


if __name__ == "__main__":
    import webbrowser
    print("פותח ממשק בדפדפן...")
    threading.Timer(1, lambda: webbrowser.open("http://localhost:5000")).start()
    app.run(debug=False, port=5000)
