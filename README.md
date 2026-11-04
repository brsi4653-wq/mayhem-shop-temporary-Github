# Mayhem shop

The Mayhem "Loves You" pre-order site. It's plain HTML, CSS and JavaScript on GitHub Pages. There's no build step, no cart and no backend. Checkout happens on Stripe Payment Links.

**Almost everything you'll change lives in one file: `data/shop.js`.** Open it in any text editor (Notepad works), change it, save it, upload it to GitHub. Done.

## The golden rules for editing `data/shop.js`

- Text goes in "double quotes". Numbers don't.
- Every line inside `{ }` ends with a comma, except it's fine if the last one does too.
- Anything you don't know yet: write `null`. The site shows "TBA" or a greyed out button instead of breaking.
- All dates and times are Halifax time, written like `"2026-12-01 18:00"`. Ships-by dates are just `"2027-01-20"`.
- If the site suddenly shows "Loading" forever after an edit, you probably deleted a comma or a quote mark. Undo and try again.

## Set a price, a cap or a Stripe link

Find the product in the `products` list and change:

```js
price: 80,                                  // CAD, no $ sign
available: 25,                              // shows "25 available"
stripeLink: "https://buy.stripe.com/xxxx",  // your Payment Link
status: "open",
```

The buy button only works when **all three** are true: status is `"open"`, there's a price, and there's a Stripe link.

## Statuses

| status | what the site shows |
|---|---|
| `"upcoming"` | Tile shows, button says "Coming soon" or "Opens Dec 1" |
| `"open"` | Button links to Stripe |
| `"soldout"` | Button says "Sold out" |
| `"closed"` | Button says "Pre-orders closed" |
| `"hidden"` | Not shown anywhere |

When a Stripe link hits its cap, Stripe stops taking payments by itself, but the site doesn't know. Change the status to `"soldout"` and update `available` by hand.

## Add a new product

Copy an existing product block in `products`, paste it below, and change the fields. You only need the product's own details. Fabric, fit, print, care and size chart come from its preset (`type`).

```js
{
  id: "crash-tee",                 // used in the link: product.html?p=crash-tee
  name: "Crash",
  type: "tee",                     // tee, buttonup or hoodie
  drop: "drop-002",
  status: "upcoming",
  price: null,
  available: null,
  stripeLink: null,
  colours: [
    { name: "Ultra Washed Black", number: "CUWB", band: "#1b1b1b", image: "assets/products/CUWB.jpg" }
  ]
},
```

Put the image in `assets/products/`. Use just the garment, not the whole release card: a square JPG about 1000 x 1000 on a white background, with no logo, colour band or back thumbnail. Small files load fast on phones.

If a product needs a detail that's different from its preset, add it to the product and it wins. For example `care: "Hand wash only."`.

## Add a new drop

Add a block to `drops`, then point `currentDrop` at it. The home page shows whatever `currentDrop` is.

```js
currentDrop: "drop-002",

drops: [
  { id: "drop-001", name: "Drop 001", opens: "2026-12-01 18:00", closes: "2026-12-15 23:59", shipsBy: "2027-01-20" },
  { id: "drop-002", name: "Drop 002", opens: null, closes: null, shipsBy: null }
],
```

The countdown counts to `opens`, then to `closes`. **It's display only.** It doesn't turn anything off. At close, deactivate your Payment Links in Stripe yourself, then set each product's status to `"closed"`.

## Add a new product type (preset)

Copy one of the blocks inside `presets`, give it a new name (for example `crewneck`), and fill in its details and size chart. Then any product can use `type: "crewneck"`.

Size chart rows are `[length in, length cm, shoulder in, cm, chest in, cm, sleeve in, cm]`.

## Setting up each Stripe Payment Link

For every product:

1. **Quantity:** locked to 1.
2. **Custom fields:** a dropdown for Size (S, M, L, XL, 2XL) and a dropdown for Colour (the colour names). You get up to 3 custom fields.
3. **Shipping:** add two **line items**, "To the Checkpoint" C$15 and "From the Checkpoint" C$25. Don't use Stripe's shipping options. Those can't be edited on a live link, and a new link resets the cap count. Line items can be edited on a live link.
4. **Addresses:** collect shipping address, Canada only.
5. **Limit the number of payments:** this is the cap. It's per link, so per product, not per size or colour.
6. **Terms:** turn on the "agree to terms" checkbox and point it at your policy page (`https://<your site>/policy.html`).
7. Copy the link into `stripeLink` in `data/shop.js`.

## Before launch

- [x] Address is filled in. Nova Scotia's internet sales rules require it. It only shows on the policy page, and until every piece is filled in the policy page shows a yellow "coming soon" box.
- [ ] Decide how tax works for you and write it in `taxNote`.
- [ ] Prices, caps, drop dates and Stripe links.
- [ ] Fabric and care for the button-up and hoodie (in their presets).
- [ ] Check the hoodie's style wording against the Tapstitch listing.
- [ ] Get the policy page and the quote mark question checked by a lawyer.

## Wording rules

- Say "available", like "10 available". Never "only 10 exist" or "1 of 10". Friends and family units sit outside the cap.
- "Canadian brand", "Canadian owned" and "Canadian exclusive" are fine. Never "Made in Canada" or "Product of Canada".

## Turning on GitHub Pages

In the repo on GitHub: **Settings, Pages**, set Source to "Deploy from a branch", branch `main`, folder `/ (root)`, and save. The site shows up at `https://brsi4653-wq.github.io/mayhem-shop-temporary-Github/` after a minute or two. The repo has to be public on a free account, so nothing secret goes in here.

## What's where

| file | what it is |
|---|---|
| `data/shop.js` | **All the shop content.** The file you edit. |
| `index.html` | Home: current drop, countdown, products, The Checkpoint |
| `product.html` | One product page (picks the product from `?p=`) |
| `size-guide.html` | All the size charts |
| `policy.html` | Policy and contact |
| `css/style.css` | The look |
| `js/site.js` | Builds the pages from the data file. You shouldn't need to touch it. |
| `assets/quotes/` | The big quote marks, cut from the Quoted print |
| `assets/logos/` | Your logo files, unchanged |
| `assets/products/` | Product images |
