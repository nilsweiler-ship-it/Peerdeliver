# Shlep — Illustration Prompt Pack

*One consistent hand-drawn style across every image. Each prompt = STYLE BLOCK + scene. Generate at the highest resolution available (≥1500 px wide). If your generator supports a reference image, attach the doorstep-handoff illustration to every generation — it locks the style better than words.*

---

## The style block (paste at the start of every prompt)

> Hand-drawn European picture-book illustration in the style of Franco-Belgian ligne claire comics, fine confident ink outlines, muted flat colors with subtle watercolor texture, warm cream paper tones (#F3EFE6), deep forest green (#14532D) and warm amber (#E0A32E) accents, charcoal-brown line work (#17160F), soft golden afternoon light, cozy Swiss old-town setting, gentle and human, no photorealism —

## Negative prompt (append where supported)

> no 3D render, no plastic CGI look, no photorealism, no airbrush gradients, no neon colors, no text, no watermark, no logos, no extra fingers, no distorted hands

---

## Priority 1 — the four website slots

**1. Hero — the handoff** *(done — your doorstep lamp scene. Landscape 3:2)*
Keep as reference image for all others.

**2. Sender panel — no-packaging USP** *(landscape 3:2)*
> [STYLE BLOCK] a woman in her thirties carefully wrapping a flat-screen TV in a soft moss-green wool blanket on a wooden kitchen table in a bright Swiss apartment, no cardboard box anywhere, a small phone beside her showing a simple route line, houseplant on the windowsill, calm concentration, morning light

**3. Driver panel — earn on trips you already make** *(landscape 3:2)*
> [STYLE BLOCK] a friendly commuter in a navy jacket placing a blanket-wrapped parcel onto the back seat of a small red car parked on a cobblestone street, cream buildings with dark-green shutters behind, an amber autumn tree, church clock tower in the distance, everyday calm, nothing hurried

**4. Founder avatar — trust quote** *(square 1:1, works small at 96 px)*
> [STYLE BLOCK] warm portrait of a small founding team of two or three people standing close together smiling, shoulders up, plain warm cream background, simple and honest, subtle forest-green clothing accents

---

## Priority 2 — the workflow (How-it-works triptych, square 1:1 each)

**5. Step 1 — Aufgeben (post it)**
> [STYLE BLOCK] close view over the shoulder of a person at a kitchen table photographing a wrapped parcel with their phone, the phone screen showing a simple form with a route line from A to B, coffee cup nearby, effortless mood, "under a minute" energy

**6. Step 2 — Zuordnen (match)**
> [STYLE BLOCK] a commuter leaning against their parked car at a Swiss train station forecourt checking their phone, the screen showing a matching route with a small amber dot and green destination ring, other travellers softly blurred in the background, sense of a route already planned

**7. Step 3 — Liefern (code handoff)**
> [STYLE BLOCK] two hands from different people meeting over a wrapped parcel at a doorstep, one person's phone showing six large friendly digits, warm eye contact between an older recipient and a young driver, dark-green door frame, the moment of trust

---

## Priority 3 — value-prop extras (deck, social, app store)

**8. CO₂ — the trip already exists** *(wide 16:9)*
> [STYLE BLOCK] a single small car driving along a curving Swiss country road between green hills with a dashed amber route line trailing behind it, a lone parcel on its back seat visible through the window, meanwhile a white delivery van stays parked at a depot in the far background, morning mist, hopeful tone

**9. Insured & careful — protected hand to hand** *(square 1:1)*
> [STYLE BLOCK] a blanket-wrapped parcel buckled into a car's passenger seat with the seatbelt across it like a small passenger, driver's hand patting it gently, humorous but tender, warm interior light

**10. Rated neighbours — not an anonymous fleet** *(landscape 3:2)*
> [STYLE BLOCK] two neighbours chatting warmly over a low garden fence in a Swiss village lane, one holding a wrapped parcel, a bicycle leaning against the fence, small five-petal flowers echoing a star-rating motif along the fence line, community feeling

**11. Almost anything, cheap — the forgotten charger** *(square 1:1)*
> [STYLE BLOCK] a student at a train station handing a phone charger cable with a small tag to a smiling commuter about to board a regional train, minimal and funny, the smallest delivery in the world

---

## Practical notes

- **Consistency:** reuse the reference image + style block every time; keep character descriptions loose (age + one clothing anchor) so faces don't fight the style.
- **Sizes:** generate large, we crop. Hero displays ~5:4, panels ~3:2, steps square. Nothing needs text baked in — the site sets all type.
- **Delivery:** drop finished images into `Peerdeliver/website/assets/` (any filenames) and tell Claude which is which — colors get harmonized to the palette and converted to webp automatically.
- **What replaces what:** 2 replaces the current sender *photo*, 3 replaces the drawn placeholder in the "Ich fahre" tab, 4 replaces the logo avatar in the trust quote. 5–7 could later replace the icon step-cards; 8–11 are for the investor deck and social.
