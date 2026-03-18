# מדריך שימוש מהיר

## הכנה חד-פעמית - Gmail App Password

1. היכנס ל: https://myaccount.google.com/security
2. ודא שـ **2-Step Verification** מופעל
3. חפש **"App passwords"** → צור סיסמה חדשה
4. העתק את 16 התווים שקיבלת → הדבק ב-`config.py` תחת `SENDER_PASSWORD`

## מבנה הקבצים

```
email_sender/
├── send_emails.py     ← הסקריפט הראשי
├── config.py          ← שנה כאן לפני כל שליחה
├── template.html      ← עצב כאן את האימייל
├── contacts.xlsx      ← שים כאן את קובץ האקסל
└── attachments/
    └── prospectus.pdf ← שים כאן את הקבצים המצורפים
```

## שלבים לפני שליחה

1. **config.py** — עדכן אימייל, סיסמה, נושא
2. **template.html** — כתוב את תוכן האימייל
3. **contacts.xlsx** — ודא שיש עמודה בשם `email`
4. **attachments/** — שים את ה-PDF

## הרצה

```bash
cd C:\Users\User\email_sender
python send_emails.py
```

## שדרוג עתידי - פרסונליזציה

כדי להוסיף שם אישי:
1. הוסף עמודת `name` לקובץ האקסל
2. הוסף `{{name}}` בתבנית ה-HTML
3. בטל הערת השורה `# בעתיד:` ב-`send_emails.py`
