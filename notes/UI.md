# Notes: UI (font, phone layout, toast)

## Font: Patrick Hand

The whole app (including the login page) uses **Patrick Hand**, a handwritten pen-style font from Google Fonts.

```css
/* variables.css */
@import url('https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap');
--font: "Patrick Hand", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;

/* base.css */
body { font-family: var(--font); font-synthesis: none; }
```

- The system fonts after it are only used while it loads, or for characters Patrick Hand doesn't have (emoji).
- It has Vietnamese characters (Google Fonts serves a `vietnamese` subset for it).

### No bold

Patrick Hand only comes in **one weight** (Regular). When something asks for `font-weight: bold` (the default for `h1`, `h2`, `h3`), the browser fakes it by smearing the regular letters, and it looks blurry.

- `font-synthesis: none` → no fake bold.
- Headings stand out by **size** instead of weight: list title 44px, "My Lists" on phones 30px, account panel section titles 18px, all with `font-weight: normal`.

### Read the license before using a font

The first pick was **Notepen** (FontSpace). Its free license says: *"Paid Ads, Webfont & team use not included"*.

- **Webfont** = loading a font into a web page with `@import` / `@font-face`. Putting the app on Render counts as webfont use, so Notepen can't be used without buying a license.
- Fonts on **Google Fonts** are OFL licensed: free to use on the web.
- **SF Pro** (Apple's font) can't be put on a website either, Apple only allows it in Apple's own products. To look like Apple, use `-apple-system` (iPhones/Macs show SF Pro, other devices show their system font).

---

## Phones

### How it works

- On a phone (screen ≤ 700px wide), the first screen is the full-screen **sidebar**: "My Lists", the lists, name + ⓘ + Log out at the bottom.
- Tap a list → it opens full screen, with **‹ Lists** at the top.
- **‹ Lists** or the phone's Back gesture → back to the lists.
- Creating a new list → opens it straight away.
- On a computer: same layout as before, sidebar on the left.

### Two new files

| File | What it does |
|---|---|
| `styles/mobile.css` | All the phone CSS, inside `@media (max-width: 700px)`. Loaded **last** in `index.html` so it wins over the other files |
| `scripts/mobile.js` | Switches between the 2 screens with a `listOpen` class on `<body>` |

```text
body               -> the lists screen (sidebar)
body.listOpen      -> one list's screen
```

### The phone's Back button

Without anything special, the Back gesture **leaves the app** (goes to the previous site). The fix in `mobile.js`:

```js
// opening a list: add a step to the browser history
history.pushState({ listOpen: true }, "");

// Back pressed / swiped: the browser drops that step and fires "popstate"
window.addEventListener("popstate", () => { ... remove the listOpen class ... });
```

- The **‹ Lists** button also calls `history.back()`, so the history step gets used up instead of left over.
- `history.state` survives a reload, so on page load `history.replaceState(null, "")` makes sure it always starts on the lists screen.
- `window.matchMedia("(max-width: 700px)")`: the JS checks if it's a phone, using the same number as the `@media` in the CSS.

### CSS details

| Detail | Why |
|---|---|
| `.main { display: none !important; }` | `updateMainVisibility()` in `sidebar.js` sets `display` on `.main` **inline**, and normal CSS can't beat an inline style |
| `min-height: 100dvh` | `dvh` = the height you can actually see, not counting the phone browser's address bar |
| `env(safe-area-inset-bottom)` | Leaves room for the iPhone home bar. Needs `viewport-fit=cover` in the `<meta name="viewport">` tag |
| Task input `font-size: 16px` | Under 16px, iPhones zoom the page in when you tap the input |
| `overflow-wrap: anywhere` | Long text with no spaces still wraps instead of overflowing |
| Task buttons on their own row (`flex-basis: 100%`) | Narrow screen, gives the task text enough room |

### Small bug fixed along the way

Clicking inside the **rename list box** counted as clicking the list (the click bubbles up to the `<li>`). On a phone that would open the list while you're renaming it. Fixed in `sidebar.js`:

```js
if (e.target.closest("input")) return;
```

### Not done yet

Drag and drop to reorder tasks **doesn't work on phones**. HTML5 drag and drop (`draggable`, `dragstart`, `dragover`) only works with a mouse. It would need touch events (`touchstart`, `touchmove`), or up/down buttons.

---

## The toast box

### Never taller than the screen

The account panel is about 620px tall. The toast is always centered (`top: 50%` + `translate(-50%, -50%)`), so on a short window **its top got pushed off the screen** and you couldn't scroll up to it. Fixed in `.toast`:

```css
/* never taller than the screen */
max-height: calc(100dvh - 32px);
/* too long -> scroll inside it */
overflow-y: auto;
box-sizing: border-box;
```

### Lines between the account panel sections

```css
.accountSection + .accountSection {
    border-top: 2px solid var(--border);
    padding-top: 16px;
}
```

`A + B` = a B that comes **right after** an A. So every section gets a line on top **except the first one**. It uses `var(--border)`, so dark mode changes the color automatically.

### Where the CSS is

| Part | Where |
|---|---|
| The toast box (`.toast`, `#toastMessage`, `.toastButtons`, `.toastInput`) | `styles/toast.css` |
| The account panel (`.accountPanel` and everything in it) | `styles/toast.css`, the `/* ACCOUNT PANEL */` section |
| The dark background behind it (`.overlay`) | `styles/base.css` |
| The ⓘ button (`.accountInfoButton`) | `styles/sidebar.css` |

---

## Comment style

Comments always go on their own line **above** the code, never at the end of the line:

```css
/* pushes it to the bottom */
margin-top: auto;
```

not `margin-top: auto; /* pushes it to the bottom */`. Same for `#` in Python and `//` in JS.

---

## Checking the UI with screenshots

The phone layout was checked with automatic screenshots using **Playwright** (controls the Edge browser from code), at iPhone size 390×844 and desktop 1280×800. The app ran on a throwaway database, so the real `todo.db` wasn't touched. This checks both the look and the behavior (Back gesture, ‹ Lists button) without a real phone. It's still worth trying on a real phone after deploying.
