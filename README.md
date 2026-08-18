# Focus Plan

A simple, kid-friendly daily checklist app. Categories (Morning Routine, Chores, Soccer Prep, or any you add) contain items; each item can be expanded to show sub-steps and tips so he can double-check he really finished it, not just rushed past it. Checkmarks reset automatically every day. All data is saved locally in the browser (no account, no server).

## Running it

Node.js is already installed on this machine but isn't on the system PATH, so use the included wrapper:

```bash
./dev.bat
```

Or, if `node`/`npm` are on your PATH:

```bash
npm run dev
```

Then open the printed URL (usually http://localhost:5173) in a browser. To use it on his phone or tablet on the same wifi network, run `npm run dev -- --host` and open `http://<your-computer's-local-ip>:5173` from that device.

## Editing the schedule

Tap **⚙️ Edit** in the top right to rename categories/items, add or delete items and sub-steps, add new categories, or set his name. Tap **Done editing** to return to the normal checklist view.

## Notes

- Data is stored in the browser's localStorage, per device/browser — it won't sync between devices.
- Checkmarks (items and sub-steps) reset automatically the first time the app is opened on a new day.
