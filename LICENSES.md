# Licences and credits

Everything that came from outside the project, with where it came from, who made it and its licence. Add a line here when a file, or code adapted from someone else's, enters the repository.

## Code and techniques

| What | Where it is used | Source | Author | Licence |
|---|---|---|---|---|
| three.js | The engine, bundled into every build | https://github.com/mrdoob/three.js | three.js authors | MIT |
| pixelfx effect designs | The Dragon, Jet and Vortex fire breath styles and the Burst, Bubble, Cracks, Wildfire and Bolts radiation pulse styles in `src/main.js`. These were rebuilt in our own block system from the way these pixelfx effects are put together and timed: fire breath, flamethrower, fire tornado, mana burst, EMP blast, ground slam, fire ring and plasma explosion. No pixelfx file is in the repository and none of its code or images is shipped. | https://github.com/patch-gg/pixelfx | Patch (patch-gg). Several of those effects are themselves adapted from MIT-licensed effects by Hugo Duprez (Sprite Fusion), as pixelfx's NOTICE.md records. | MIT |
| qrcode-generator 1.4.4 | `playtest/vendor/qrcode.js`, draws the join code on the playtest server's page. Not part of the game build. | https://github.com/kazuhikoarase/qrcode-generator | Kazuhiko Arase | MIT |

Credit line if one is wanted on screen: "Some effects are based on pixelfx by Patch (MIT)." MIT asks for the copyright notice to stay with copies of the code. We copied no code, so this entry is a courtesy and a record.

## Fonts

Both are bundled into every build and the lobby page as woff2 files in `src/ui/` (Latin set only). Nothing loads from Google Fonts.

| What | Where it is used | Source | Author | Licence |
|---|---|---|---|---|
| Lilita One (400) | Titles, numbers and buttons: `src/ui/lilita-one-400.woff2` | https://fonts.google.com/specimen/Lilita+One, files from the `@fontsource/lilita-one` package | Juan Montoreano, copyright 2011 | SIL Open Font License 1.1 |
| Fredoka (500, 600, 700) | Small text: `src/ui/fredoka-500.woff2`, `fredoka-600.woff2`, `fredoka-700.woff2` | https://fonts.google.com/specimen/Fredoka, files from the `@fontsource/fredoka` package | The Fredoka Project Authors (Milena Brandao, Hafontia) | SIL Open Font License 1.1 |

The OFL lets the fonts be bundled and sold with a game. It asks that the copyright and licence notice stay with copies of the font files, which this table is, and that the fonts are not sold on their own.

## Art and models

The monster faces, bodies and the loading fight in `src/ui/` are rendered from our own models. The logo is our own (see the launch covers).

See the Credits section of `README.md` for the monster and town. The optional T-rex model is CC0.
