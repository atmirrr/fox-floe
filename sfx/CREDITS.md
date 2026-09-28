# Sound credits

All recorded sounds are CC0 (public domain) from OpenGameArt.org, converted to mono 16-bit WAV:

- row1/row2/row3, splash_mid, splash_big, splash_crash, bubble, waterloop:
  "40 CC0 water / splash / slime SFX" by rubberduck
  https://opengameart.org/content/40-cc0-water-splash-slime-sfx
- whoosh1, whoosh2: "Swishes Sound Pack" (Summoning Wars project)
  https://opengameart.org/content/swishes-sound-pack
- crunch: "75 CC0 breaking / falling / hit sfx" by rubberduck
  https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx
- plop, boing: "100 CC0 SFX" by rubberduck
  https://opengameart.org/content/100-cc0-sfx

The penguin "wek wek" chirp, the background wind, the low body of an oar stroke and the brown-noise
wash under a sustained pull are synthesized in src/audio.js. The boost and the pull are built from
these same recordings: the stroke is a pitched-down row sound, the big splash and a slice of the
river loop swept through a rising filter; the pull runs the river loop faster through a moving
band-pass, swelling with each stroke.
