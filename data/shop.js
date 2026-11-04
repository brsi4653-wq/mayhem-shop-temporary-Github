/*
  MAYHEM SHOP DATA
  ================
  This is the only file you need to edit to change the shop.
  See README.md for step by step instructions.

  Rules:
  - Anything you don't know yet, set to null. The site will show "TBA"
    or a disabled button instead of breaking.
  - All dates and times are Halifax time. Write them like "2026-12-01 18:00".
  - Prices are numbers in Canadian dollars, no $ sign. Example: price: 80
  - Text goes in "double quotes". Every line inside a { } block ends with a comma.
*/

window.MAYHEM = {

  /* ------------------------------------------------------------------
     CONTACT
     The email and phone are split into pieces on purpose, so basic
     scraper bots can't read them straight out of this file.
     ------------------------------------------------------------------ */
  contact: {
    name: "Simon Brookes",
    emailUser: "simon_j_brookes",
    emailDomain: "icloud.com",
    phone: ["902", "899", "9245"],

    // Your address. Nova Scotia's internet sales rules require it.
    // To keep it as hidden as the law allows, the site:
    //  - shows it ONLY on the policy page (linked from every buy button),
    //    not in the footer of every page,
    //  - builds it with JavaScript from these pieces, so basic bots
    //    don't read it out of the page,
    //  - tells search engines not to list the policy page.
    // It still sits in this file, and the GitHub repo is public.
    // Nothing shows until every piece is filled in.
    address: {
      number: "4",
      street: "Aster Place",
      town: "Truro",
      province: "NS",
      postal: "B2N 5X1"
    }
  },

  /* ------------------------------------------------------------------
     SOCIALS
     Shown in the footer of every page. Remove a line to hide it.
     ------------------------------------------------------------------ */
  socials: [
    { name: "Instagram", handle: "getmayhemtoday", url: "https://www.instagram.com/getmayhemtoday/" },
    { name: "X", handle: "@GetMayhemToday", url: "https://x.com/GetMayhemToday" },
    { name: "YouTube", handle: "@GetMayhemToday", url: "https://www.youtube.com/@GetMayhemToday" }
  ],

  /* ------------------------------------------------------------------
     SHIPPING
     Charged once per order. Every order is one item.
     In Stripe, on each Payment Link:
       - shipping is a required LINE ITEM (not a Stripe shipping option),
       - the inspection is an OPTIONAL item ("+ Add recommended products")
         that the customer adds at checkout.
     The names here should match the names in Stripe.
     ------------------------------------------------------------------ */
  shipping: {
    name: "Canada Post Shipping (Checkpoint Skipped)",
    price: 35,
    inspectionName: "Checkpoint Inspection",
    inspectionPrice: 5
  },

  /* ------------------------------------------------------------------
     PAYMENT METHODS
     What Stripe checkout accepts. Shown by the buy box and in the footer.
     Keep this matching what's turned on in Stripe.
     ------------------------------------------------------------------ */
  paymentMethods: ["Card", "Apple Pay", "Klarna", "Link"],

  /* ------------------------------------------------------------------
     TAX
     Nova Scotia's rules say the itemized price before purchase must
     include any taxes. Once you know how tax works for you, write one
     short line here and it shows under every price.
     Example: "No sales tax charged."  Leave null to show nothing.
     ------------------------------------------------------------------ */
  taxNote: null,

  /* ------------------------------------------------------------------
     QUOTATIONS (Mayhem's name for a drop)
     id: short code used by products below. No spaces.
     opens / closes: Halifax time. null = not set yet.
     delivery: the delivery line shown in the pink bar at the bottom of
       every page, next to every buy button, and on the policy page.
       Change shipsBy and arriveBy to update the dates. {shipsBy} and
       {arriveBy} in the text get replaced with them.
     The countdown on the site is display only. It does NOT turn off
     Stripe. Deactivate your Payment Links in Stripe yourself at close.
     ------------------------------------------------------------------ */
  currentQuotation: "quotation-001",

  // true = show the countdown on the home page (it needs opens/closes set).
  showCountdown: false,

  quotations: [
    {
      id: "quotation-001",
      name: "Quotation 001",
      opens: null,     // e.g. "2026-12-01 18:00"
      closes: null,    // e.g. "2026-12-15 23:59"
      delivery: {
        shipsBy: "January 31",
        arriveBy: "February 28",
        text: "Ships by {shipsBy}. Should arrive by {arriveBy}, probably sooner. Delivery is up to Canada Post, so delays outside our control can happen."
      }
    }
  ],

  /* ------------------------------------------------------------------
     PRODUCT TYPE PRESETS
     Shared details for each kind of product. A product picks one with
     `type:` and gets all of this automatically. Anything a product sets
     itself wins over the preset. Add new presets the same way.
     Size charts are in inches with cm from the size guide cards.
     ------------------------------------------------------------------ */
  presets: {

    tee: {
      label: "Tee",
      details: [
        ["Fabric", "100% cotton, 275 gsm (8.1 oz)"],
        ["Thickness", "Moderate"],
        ["Finish", "Mineral wash, snow wash effect"],
        ["Fit", "Oversized, drop shoulder"],
        ["Neck and sleeve", "Round neck, short sleeve"],
        ["Print", "DTG, front only"],
        ["Model fit", "6'1\", 154 lbs wears L. 5'8\", 121 lbs wears S."]
      ],
      care: "Machine wash at 30°C on gentle. Do not bleach. Tumble dry low. Iron low and avoid the print. Do not dry clean.",
      sizeGuideImage: "assets/products/tee-size-guide.jpg",
      sizeChart: {
        // size: [length in, length cm, shoulder in, cm, chest in, cm, sleeve in, cm]
        "S":   [24.41, 62, 22.44, 57, 24.02, 61,  9.84, 25],
        "M":   [25.20, 64, 23.23, 59, 24.80, 63, 10.24, 26],
        "L":   [25.98, 66, 24.02, 61, 25.59, 65, 10.63, 27],
        "XL":  [26.77, 68, 24.80, 63, 26.38, 67, 11.02, 28],
        "2XL": [27.56, 70, 25.59, 65, 27.17, 69, 11.42, 29]
      }
    },

    buttonup: {
      label: "Button-up",
      details: [
        ["Style", "Short sleeve button-up with collar, button front and chest pocket"],
        ["Print", "DTF, five print areas across front and back"],
        ["Fabric", null],   // TODO: add once confirmed
        ["Fit", null]       // TODO: add once confirmed
      ],
      care: null,           // TODO: add once confirmed
      sizeGuideImage: "assets/products/buttonup-size-guide.jpg",
      sizeChart: {
        "S":   [25.20, 64, 19.68, 50, 22.44, 57, 10.04, 26],
        "M":   [25.98, 66, 20.47, 52, 23.23, 59, 10.43, 26],
        "L":   [26.77, 68, 21.26, 54, 24.02, 61, 10.83, 28],
        "XL":  [27.56, 70, 22.05, 56, 24.80, 63, 11.22, 28],
        "2XL": [28.35, 72, 22.83, 58, 25.59, 65, 11.61, 29]
      }
    },

    hoodie: {
      label: "Hoodie",
      details: [
        ["Style", "Heavyweight oversized sunfade hoodie"],  // TODO: check wording against the Tapstitch listing
        ["Print", "Front, back and both sleeves"],
        ["Fabric", null],   // TODO: add once confirmed
        ["Fit", null]       // TODO: add once confirmed
      ],
      care: null,           // TODO: add once confirmed
      sizeGuideImage: "assets/products/hoodie-size-guide.jpg",
      sizeChart: {
        "S":   [27.56, 70, 22.44, 57, 26.38, 67, 24.02, 61],
        "M":   [28.35, 72, 23.03, 58, 27.17, 69, 24.41, 62],
        "L":   [29.13, 74, 23.62, 60, 27.95, 71, 24.80, 63],
        "XL":  [29.92, 76, 24.21, 61, 28.74, 73, 25.20, 64],
        "2XL": [30.71, 78, 24.80, 63, 29.53, 75, 25.59, 65]
      }
    }
  },

  /* ------------------------------------------------------------------
     PRODUCTS
     id: short code for the product page link (product.html?p=id). No spaces.
     type: one of the presets above.
     status: "upcoming", "open", "soldout", "closed" or "hidden".
       hidden = not shown anywhere on the site.
     price: number in CAD, or null for "Price TBA".
     available: number, or null to show nothing.
     stripeLink: the Stripe Payment Link URL, or null.
     The buy button works as soon as status is "open" AND stripeLink is a
     full https:// link. Until then it shows a disabled "Link coming soon".
     colours: name, product number, band colour, front image, back image.
       back is optional. Leave it out and the flip arrow is hidden.
     ------------------------------------------------------------------ */
  products: [
    {
      id: "quotation-mayhem-tee",
      name: "Quotation Mayhem",
      type: "tee",
      quotation: "quotation-001",
      status: "open",
      price: 70,
      available: null,
      stripeLink: null,
      colours: [
        { name: "Ultra Washed Black", number: "QMUWB", band: "#1b1b1b", image: "assets/products/QMUWB.jpg", back: "assets/products/QMUWB-back.jpg" },
        { name: "Legally Distinct White-Ish Colour", number: "QMLDWC", band: "#e7dac6", image: "assets/products/QMLDWC.jpg", back: "assets/products/QMLDWC-back.jpg" },
        { name: "What The Tree Trunk Green", number: "QMWTTTG", band: "#23483e", image: "assets/products/QMWTTTG.jpg", back: "assets/products/QMWTTTG-back.jpg" },
        { name: "Ultra Specific Blue", number: "QMUSB", band: "#222c49", image: "assets/products/QMUSB.jpg", back: "assets/products/QMUSB-back.jpg" }
      ]
    },
    {
      id: "quotation-mayhem-button-up",
      name: "Quotation Mayhem Button-up",
      type: "buttonup",
      quotation: "quotation-001",
      status: "open",
      price: null,
      available: null,
      stripeLink: null,
      colours: [
        { name: "Ultra Black", number: "QMBUUB", band: "#1b1b1b", image: "assets/products/QMBUUB.jpg", back: "assets/products/QMBUUB-back.jpg" },
        { name: "Ultra White", number: "QMBUUW", band: "#ecebe7", image: "assets/products/QMBUUW.jpg", back: "assets/products/QMBUUW-back.jpg" }
      ]
    },
    {
      id: "quotation-mayhem-hoodie",
      name: "Quotation Mayhem Hoodie",
      type: "hoodie",
      quotation: "quotation-001",
      status: "open",
      price: null,
      available: null,
      stripeLink: null,
      colours: [
        { name: "Now With No Pink Tax Pink", number: "QMHNWNPTP", band: "#b80d5e", image: "assets/products/QMHNWNPTP.jpg", back: "assets/products/QMHNWNPTP-back.jpg" }
      ]
    }
  ]
};
