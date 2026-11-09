# Interview prep: ToDoList

How to use this file:

1. **Say the answers out loud, in English.** Reading them isn't enough. Record yourself once and listen back.
2. **Don't memorize word for word.** Know the 2–3 key points of each answer and say them your own way.
3. **Close this file and explain each part of the code from memory.** If you can't explain a file without looking, open it and walk through it again. Interviewers always ask a follow-up, and that's where memorized answers fall apart.
4. Keep answers short: **20–40 seconds**, then stop. If they want more, they'll ask.

---

## 1. The pitch

### 30 seconds

> "It's a full-stack to-do list app. I started with a plain JavaScript version that saved everything in localStorage, then rebuilt the backend in Flask with a REST API and a SQL database, so it works across devices. It has user accounts with hashed passwords, CSRF protection and rate limiting, and an email reminder feature: users verify their email, and a daily GitHub Actions job emails them about tasks due tomorrow, in their own timezone. It also has a separate phone layout."

### 2 minutes (when they say "tell me about a project")

1. **What it is:** a to-do app with multiple lists, colors, due dates, filters, sorting and drag and drop.
2. **How it started:** vanilla HTML/CSS/JS, data in localStorage. Problem: data stuck on one browser.
3. **What I built:** a Flask backend.
   - **REST API** with one request per change (not "save the whole list"), so two devices don't overwrite each other.
   - **SQLAlchemy models + migrations** (SQLite now, PostgreSQL for deploy).
   - **Accounts:** Flask-Login, hashed passwords, every query scoped to the logged-in user.
   - **Security:** CSRF tokens, `SameSite`/`HttpOnly`/`Secure` cookies, rate limiting on login and password change, secrets in environment variables.
4. **The interesting feature:** email reminders. Signed verification links that expire in 24 hours, a daily job triggered by GitHub Actions, timezone-aware "tomorrow", and a `reminded_for` column so nobody gets the same reminder twice.
5. **What I learned / what's next:** writing pytest tests, deploying to Render + Neon, and things like password reset.

---

## 2. Architecture

```text
Browser (HTML/CSS/JS)
   │  fetch + X-CSRFToken header, session cookie
   ▼
Flask app (create_app)
   ├── pages.py     → index.html (login required)
   ├── auth.py      → /login, /register, /logout, /verify-email/<token>
   ├── api.py       → /api/lists, /api/tasks, /api/account (JSON)
   └── reminders.py → /internal/send-reminders (secret token)
   │
   ▼
SQLAlchemy → SQLite (local) / PostgreSQL (deployed)

GitHub Actions (daily) ──POST──► /internal/send-reminders ──► Brevo ──► email
```

### What happens when I click "Add"

Know this one cold, it's the most common project question.

1. `submitNewTask()` in `taskRender.js` reads the input, warns about duplicates, clears the input, calls `addTask()`.
2. `addTask()` in `taskActions.js` calls `apiSave("POST", "/api/lists/5/tasks", {text, color, dueDate})`.
3. `apiRequest()` sends `fetch` with JSON and the `X-CSRFToken` header. The browser attaches the session cookie.
4. Flask: CSRFProtect checks the token → `require_login` checks the session → `create_task(list_id=5)`.
5. `get_list_or_404(5)` finds list 5 **only if it belongs to `current_user`**, otherwise 404.
6. Validation: text is a non-empty string ≤ 500, color is `#rrggbb`, date parses. Anything wrong → 400.
7. `position` = current max + 1. `db.session.add()` + `commit()`, the database assigns the `id`.
8. Returns `201` with the task as JSON.
9. The JS pushes the task (with the server's `id`) into the list and calls `renderTask()`.

**Follow-ups:** *Why wait for the server here but not when editing?* → New tasks need the server's id. Edits already have an id, so the UI updates first (optimistic update) and saves after. *What if the save fails?* → `apiSave` catches it and shows a toast offering a reload.

---

## 3. Questions and answers

### Design

**Why one request per change instead of saving the whole list?**
> If the app sent the whole array, an out-of-date tab on my laptop could overwrite changes I just made on my phone. Sending one change at a time, like "PATCH task 12, completed = true", means changes from different devices don't erase each other.

**Why does the database create the ids?**
> The old JS used `Date.now()`, which is a 13-digit number. That's bigger than a PostgreSQL integer, about 2.1 billion. SQLite doesn't complain, so the bug would only show up after deploying. Letting the database assign ids also guarantees they're unique.

**Why is there no `user_id` on tasks?**
> A task belongs to a list and a list belongs to a user, so ownership is already known through the list. Storing it twice could get out of sync. The trade-off is that looking up a task needs a join through the list.

**How does drag and drop work with a filter on?**
> If you filter to "Active" and drag, only the visible tasks should move. I take the positions the visible tasks currently occupy, and reorder them only within those slots, so hidden tasks stay where they are. Then I send the full order of every task id to `PUT /api/lists/<id>/order`.

**Why `PUT` for reordering but `PATCH` for editing?**
> `PATCH` changes part of a resource, only the fields sent. Reordering sends the complete new order and replaces the old one, so `PUT` fits better.

### Database

**What's a migration and why use them?**
> Changing `models.py` doesn't change the real database. A migration is a versioned script that applies the change while keeping the data, like Git commits for the schema. I generate them with `flask db migrate` and always read the file before `upgrade`, because autogenerate can guess wrong, for example turning a rename into drop + add.

**How do you add a required column to a table that already has data?**
> It fails, because the existing rows have no value. Options: add it as nullable, fill in the old rows, then make it required in a second migration. Or give it a server default. In this project my later columns were all optional on purpose, so they were safe to add.

**What's the N+1 problem and did you hit it?**
> Loading 100 lists and then each list's tasks one by one is 1 + 100 queries. In `GET /api/lists` I use `selectinload(TodoList.tasks)`, which loads all the tasks in one extra query using `WHERE list_id IN (...)`. So it's 2 queries no matter how many lists.

**Why indexes on `lists.user_id` and `tasks.list_id`?**
> The app looks things up by those columns on every request, and PostgreSQL doesn't index foreign keys automatically.

**Why is `reminded_for` a date and not a boolean?**
> If a reminder was sent and then the user moves the due date, a boolean would still say "already reminded". Storing the date it was sent for means it no longer matches the new due date, so the new date gets its own reminder without any extra reset code. It also means running the job twice in a day doesn't send duplicates.

### Authentication and security

**How are passwords stored?**
> Never in plain text. I store a salted hash from Werkzeug's `generate_password_hash`, and check logins with `check_password_hash`. Hashing is one-way, so even with the database nobody can read the passwords. Encryption would be reversible, which is worse.

**How do sessions work?**
> HTTP has no memory, so after login Flask-Login puts the user id in Flask's session cookie. The cookie is **signed** with `SECRET_KEY`, not encrypted: anyone can read it, but changing it breaks the signature. On each request Flask checks the signature and loads the user from the database.

**What happens if `SECRET_KEY` leaks?**
> Someone could sign their own cookie saying they're user 1 and log in as anyone. The fix is rotating the key, which logs everyone out. That's why it's in an environment variable, never in the code, and the app refuses to start without it.

**How do you stop a user from accessing someone else's data?**
> Every lookup goes through `get_list_or_404` / `get_task_or_404`, which filter by `current_user.id`. Tasks don't have a user id, so I join through the list. Putting it in shared helpers means no route can forget it. This bug class is called IDOR.

**Why 404 and not 403 for someone else's list?**
> 403 would confirm the list exists. 404 doesn't reveal anything about other users' data.

**What's CSRF and how do you prevent it?**
> A malicious site makes your browser send a request to my app, and the browser attaches your cookie automatically. Two defenses: `SameSite=Lax` cookies, which aren't sent on cross-site POSTs, and CSRF tokens from Flask-WTF. Forms have a hidden token, and the JS sends it in an `X-CSRFToken` header. Another site can't read my pages, so it can't get the token. That's also why logout is POST only.

**What do `HttpOnly` and `Secure` do?**
> `HttpOnly`: JavaScript can't read the cookie, so an XSS script can't steal the session. `Secure`: only sent over HTTPS. I turn `Secure` off locally with an environment variable, because the dev server is plain HTTP.

**How does rate limiting work?**
> Flask-Limiter. Login is limited per username (10 a minute), so one account can't be brute forced from many IPs, and per IP (30 a minute), so one machine can't try many accounts. Password change is 10 an hour per user. The two email routes share one limit of 5 an hour, so the app can't be used to spam. Counts are in memory, which is why it runs with one worker. With more workers I'd move them to Redis.

**How do you prevent XSS?**
> Jinja escapes everything by default, and in JS I set text with `textContent`, never `innerHTML` with user data. I tested a display name with `<b>` tags and it shows as text.

### Email reminders

**Walk me through the reminder feature.**
> A user adds an email in the account panel. The app sends a verification link with a signed token, using itsdangerous with `SECRET_KEY` and a 24-hour expiry. The token contains the user id and the email, so changing your email kills old links. Once a day, a GitHub Actions workflow POSTs to a secret endpoint. For each verified user, the app works out "tomorrow" in their timezone, finds unfinished tasks due then that haven't been reminded, sends one email listing them through Brevo, and sets `reminded_for`.

**Why GitHub Actions instead of a scheduler in the app?**
> Render's free plan sleeps when idle, so an in-app scheduler wouldn't run. An external request wakes the app up. Render's cron jobs are paid. The trade-off: GitHub's schedule can be late by some minutes, which is fine for "due tomorrow".

**How is that endpoint protected?**
> It needs a secret token in the `Authorization` header, compared with `hmac.compare_digest` so it can't be guessed character by character from response times. A wrong token returns 404 so the endpoint looks like it doesn't exist. It's exempt from CSRF because it's not called from a browser, the token does that job.

**Why store the timezone as a name?**
> An offset like -5 changes with daylight saving time, a name like `America/Toronto` doesn't. Python's `zoneinfo` works out the right offset for each date. The browser sends it with `Intl.DateTimeFormat().resolvedOptions().timeZone`.

**What if one email fails?**
> It's logged, that user's tasks aren't marked as reminded, and the loop moves on to the next user. The next run tries again.

### Frontend

**How did you structure the JavaScript without a framework?**
> Separate files by job. `storage.js` talks to the API, `taskActions.js` is the only place task data changes, `taskRender.js` only draws and handles clicks, and `sidebar.js`, `pickers.js`, `controls.js` and `toast.js` handle their own UI. Because all data changes went through 4 functions, switching from localStorage to the API only meant changing those 4.

**How does the phone layout work?**
> Under 700px it's one screen at a time: the lists first, tap one to open it. A CSS class on `body` switches screens. I use `history.pushState` when a list opens, so the phone's back gesture goes back to the lists instead of leaving the app.

### Testing (be honest)

**How did you test it?**
> Honest answer, adjust when stage 8 is done: "I tested the API manually with fetch calls in the browser console, and wrote a console script that runs about 20 checks: valid requests, bad input getting 400, ids that don't exist getting 404. I checked by hand that a second account can't see or change the first account's tasks. For the email and reminder logic I used Flask's test client with a fake mailer and a fake 'now' to check edge cases like completed tasks, running twice, and changed due dates. I checked the phone layout with Playwright screenshots. Next step is turning those checks into a pytest suite."

**What would you test first?**
> That user B can't read or change user A's data, because that's the worst bug this app could have. Then: logged out gets 401, CRUD works, and bad input gets 400, not 500.

### Deployment and scaling

**Why not use `flask run` in production?**
> It's a development server: single process, not built for performance or security. In production you use a WSGI server like gunicorn.

**What breaks first with 10,000 users?**
> - **The reminder job:** it loops over every user and sends emails one by one inside a single HTTP request, so it would time out. I'd batch it or move it to a background worker with a queue.
> - **Rate limit counts in memory:** they only work with one worker. I'd move them to Redis so I can run more workers.
> - **`GET /api/lists` returns everything:** fine for one person's lists, but I'd add pagination if lists got huge.
> - **SQLite:** already planned to move to PostgreSQL.

---

## 4. STAR stories (real bugs from this project)

Situation, Task, Action, Result. Keep each to about a minute.

### 1. Nothing could be saved after moving to the API

- **Situation:** after switching the frontend from localStorage to my API, adding tasks did nothing.
- **Task:** find out why every save was failing.
- **Action:** checked the browser console and found `pendingSave is not defined`. A typo in the save counter threw before the `try` block, so every API call failed. I also found URLs written with double quotes instead of backticks, so `${id}` was sent literally and the server returned 404.
- **Result:** fixed both. Lesson: read the console first, and know that template literals only work with backticks.

### 2. The Back button logged into the wrong account

- **Situation:** while testing, I logged in as user 2, pressed Back to the sign up page, made user 3, and ended up still logged in as user 2. User 3 was never created.
- **Task:** figure out why the form was ignored.
- **Action:** the browser showed the old page from its cache without asking the server, and the server saw I was still logged in and redirected. I added `Cache-Control: no-store` to the auth pages, and when a form is submitted while logged in, the app now says who you're logged in as with a log out button, instead of silently ignoring it.
- **Result:** both fixes tested. Lesson: the browser cache is part of the system too, and silent failures are worse than clear errors.

### 3. "no such table: users"

- **Situation:** I added a `User` model and the login page crashed.
- **Action:** the model existed in code but the database was never migrated. I generated the migration, read it before applying it, and noticed that adding a required `user_id` would only work because the table was empty.
- **Result:** now every model change is migrate → read → upgrade. Lesson: the code and the database are two separate things, and migrations are what keep them in sync.

### 4. Choosing a font I wasn't allowed to use

- **Situation:** I wanted a handwritten font from FontSpace.
- **Action:** before adding it I read the license: free use excluded webfonts, and putting it on a website is webfont use. I picked an OFL-licensed Google Font with a similar style that also supports Vietnamese.
- **Result:** no license problem once deployed. Lesson: check licenses for fonts, images and libraries before shipping.

### Good for "tell me about a trade-off"

- Optimistic UI updates (fast, but a failed save needs handling) vs waiting for the server (slower, always correct). I use optimistic updates for edits and wait for the server on create because it needs the id.
- GitHub Actions for scheduling: free and wakes the app, but not exact timing.
- Email as optional: old accounts keep working, but reminders only work for people who opt in.

---

## 5. What I'd improve

- **pytest suite + CI** running on every push.
- **Password reset** through the verified email, built like the verification link.
- **Log out other devices on password change**, by storing a session version in the users table.
- **Undo on failed optimistic updates** instead of just showing an error.
- **Touch drag and drop** on phones (HTML5 drag and drop only works with a mouse).
- **Background job queue** for reminders, **Redis** for rate limits.
- **Own email domain** so reminders don't land in spam.

---

## 6. Questions they'll probably ask about how you built it

**"Did you use AI?"** Be honest. A good answer:
> "Yes, I used an AI coding assistant like a pair programmer, mostly for debugging and some of the newer features. But I reviewed everything, I can explain every part, and I wrote notes on all of it. For example, [pick something and explain it in detail]."

Then **prove it** by explaining any file they pick. That's why step 3 at the top of this file matters most.

**"What was the hardest part?"** Good options: moving from localStorage to the API without breaking drag and drop with filters, or getting "tomorrow" right across timezones.

**"What would you do differently?"** Write tests from the start instead of at stage 8. Plan the email feature's database columns before building the account panel.

---

## 7. Outside the project

The project doesn't cover these, but intern interviews usually do:

- **Data structures and algorithms:** LeetCode Easy and Medium. Arrays, strings, hash maps, two pointers, stacks/queues, trees, BFS/DFS, basic dynamic programming. Many companies have a separate coding round.
- **SQL by hand:** `SELECT`, `WHERE`, `JOIN` (inner vs left), `GROUP BY` + `COUNT`, `ORDER BY`, what an index does.
- **HTTP/REST basics:** methods, status codes, what's stateless, cookies vs tokens.
- **Git:** branch, merge vs rebase, resolving a conflict.
- **Behavioral:** teamwork, a disagreement, a mistake you made, learning something fast. Prepare 1 story for each.

### Questions to ask them at the end

- "What does a typical day look like for an intern on your team?"
- "How do interns get feedback on their code?"
- "What does a successful internship look like after 4 months?"

---

## 8. Terms to say confidently

| Term | One-line meaning |
|---|---|
| REST API | URLs for resources + HTTP methods for actions, JSON in and out |
| ORM | Python classes that map to tables (SQLAlchemy) |
| Migration | Versioned script that changes the schema and keeps the data |
| Foreign key | Column pointing to another table's primary key |
| Cascade delete | Deleting a parent deletes its children |
| N+1 query | 1 query for parents + 1 per parent for children |
| Hashing vs encryption | One-way vs reversible |
| Salt | Random data added before hashing so identical passwords get different hashes |
| Session cookie | Signed cookie holding the user id |
| CSRF | Another site making your browser send requests with your cookie |
| XSS | Injected script running in your page |
| IDOR | Accessing someone else's data by changing an id |
| Rate limiting | Capping requests per key per time window |
| Optimistic update | Update the UI before the server confirms |
| Idempotent | Doing it twice has the same effect as once (GET, PUT, DELETE) |
| Environment variable | Config outside the code, for secrets |
| WSGI | The interface between a Python web app and the web server (gunicorn) |
