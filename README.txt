Stage Deck Calculator — Auto Build addon
Repository: https://github.com/RustinPlays/Stage-Deck-Calculator

1. Upload auto-build.js into the ROOT of your existing repository (beside index.html and app.js).
2. Open the EXISTING index.html file on GitHub and insert the following line immediately AFTER <script src="app.js"></script> near the end:

<script src="auto-build.js"></script>

3. Save/commit the updated index.html and perform a hard refresh (Ctrl+Shift+R).

No other original files need replacing. Existing manual stage editor, export, calculations, etc. remain the same.

IMPORTANT: Auto Build asks before replacing the existing layout. It supports AV 1200×1800 and 1200×2400 and Euro 1000×2000 and 500×2000 deck configurations, with rotation. It targets the smallest feasible full rectangular layout that is AT LEAST as wide and deep as requested. If exact is impossible, it uses the nearest available larger size. It then minimises the number of decks as a tiebreaker.

Limitation: This version builds from contiguous horizontal strips, rather than trying every possible interlocking patchwork. It can therefore miss an exact layout that a more advanced packing algorithm could discover. It does not enforce available-stock limits.
