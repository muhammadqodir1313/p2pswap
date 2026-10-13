# PeerSwap end-to-end test

`full_flow.py` drives a real browser through the whole demo journey:
sign up -> add skills -> see a match -> request swap -> accept -> complete
(+10 PeerCoin) -> submit a star rating.

Run against the running dev server:

```bash
npm run test:e2e          # or: python3 e2e/full_flow.py
BASE_URL=http://localhost:3000 python3 e2e/full_flow.py
```

Requires Python with Playwright installed (`pip install playwright && playwright install chromium`).
Each run creates a fresh `e2e+<timestamp>@peerswap.demo` account.
