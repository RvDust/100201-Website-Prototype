// Initial Mock Data based on 100201 Football Shop (@100201footballshop_)

export const SHOP_INFO = {
  name: "100201 Football Shop",
  handle: "@100201footballshop_",
  instagramUrl: "https://www.instagram.com/100201footballshop_",
  facebookUrl: "https://www.facebook.com/justthriftphl",
  tiktokUrl: "https://www.tiktok.com/@100201footballshop?fbclid=IwcGRvZgVleHRuA2FlbQIxMABicmlkETFkWTIwMFpjNE5Vb1M2U3NVc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHo6P7Sj_Fsqv2edyiNNJOntxYEZC_pZtuXR_xEzjiQzlqyMWQFB3tRhz5Zk4_aem_CoQufJ-BhEU5FGen0fhN0g",
  location: "Pasig City, Philippines",
  tagline: "Your Premier Football Kit Destination & Retro Archive",
  currencySymbol: "₱",
  currencyCode: "PHP"
};

// Initial Sample Products based on 100201 Facebook Album ("ALL KITS")
export const INITIAL_PRODUCTS = [
  {
    id: "fb-kit-barca-2627-home",
    name: "Barcelona '26/'27 Home Kit",
    club: "FC Barcelona",
    league: "La Liga",
    season: "2026/27",
    type: "Home",
    badge: "NEW DROP // PASIG VAULT",
    price: 1100,
    originalPrice: 1300,
    rating: 5.0,
    reviews: 28,
    description: "Authentic Barcelona '26/'27 Home Kit photographed at 100201 Pasig Hub. Features classic Blaugrana vertical stripes, vibrant yellow Spotify sponsor logo, embroidered Barca crest, and Catalan Senyera tab detail on back of neck. All jerseys strictly follow pre-order and payment-first policy (2-3 weeks lead time). Open for Pasig pick-up and nationwide courier.",
    image: "assets/products/barca-2627-home-1.jpg",
    images: [
      "assets/products/barca-2627-home-1.jpg",
      "assets/products/barca-2627-home-2.jpg"
    ],
    stock: { S: 5, M: 8, L: 12, XL: 6, XXL: 3 },
    featured: true,
    isNew: true,
    availability: "Pre-Order (2-3 Weeks)"
  },
  {
    id: "fb-kit-barca-2627-away",
    name: "Barcelona '26/'27 Away Kit",
    club: "FC Barcelona",
    league: "La Liga",
    season: "2026/27",
    type: "Away",
    badge: "NEW DROP // BLACK PURPLE",
    price: 1100,
    originalPrice: 1300,
    rating: 4.9,
    reviews: 21,
    description: "Barcelona '26/'27 Away Kit in sleek deep black and purple twilight tone. Features iridescent golden club crest, Spotify chest logo, Midea sleeve print, and Barca Foundation print on lower reverse. Real wooden hanger photography from 100201 Pasig Hub.",
    image: "assets/products/barca-2627-away-1.jpg",
    images: [
      "assets/products/barca-2627-away-1.jpg",
      "assets/products/barca-2627-away-2.jpg"
    ],
    stock: { S: 4, M: 7, L: 10, XL: 5, XXL: 2 },
    featured: true,
    isNew: true,
    availability: "Pre-Order (2-3 Weeks)"
  },
  {
    id: "fb-kit-barca-aurora-25",
    name: "Barcelona '25 Special Aurora Kit",
    club: "FC Barcelona",
    league: "La Liga",
    season: "2024/25",
    type: "Special",
    badge: "TOTAL 90 // LIPPZY 9",
    price: 1200,
    originalPrice: 1450,
    rating: 5.0,
    reviews: 34,
    description: "Exclusive Barcelona '25 Special Aurora Edition kit in pastel pink and lavender Total 90 geometric styling. Features silver holographic Barca badge, Spotify navy crest, Total 90 bottom hip badge, and bold LIPPZY 9 player print across the reverse. Photographed on authentic 100201 wooden hanger.",
    image: "assets/products/barca-aurora-1.jpg",
    images: [
      "assets/products/barca-aurora-1.jpg",
      "assets/products/barca-aurora-2.jpg"
    ],
    stock: { S: 3, M: 6, L: 9, XL: 4, XXL: 2 },
    featured: true,
    isNew: true,
    availability: "Pre-Order (2-3 Weeks)"
  },
  {
    id: "fb-kit-france-26-wc",
    name: "France '26 WC Home Kit",
    club: "France National Team",
    league: "International",
    season: "2026",
    type: "Home",
    badge: "MBAPPÉ #10 // WC BADGES",
    price: 1200,
    originalPrice: 1400,
    rating: 5.0,
    reviews: 42,
    description: "France National Team '26 World Cup Home Kit featuring vintage cream fold-over collar, iconic golden Gallic rooster 2-star crest, official FIFA World Cup sleeve patches, tricolor sleeve ribbons, and full MBAPPE 10 star nameset on reverse.",
    image: "assets/products/france-26-1.jpg",
    images: [
      "assets/products/france-26-1.jpg",
      "assets/products/france-26-2.jpg"
    ],
    stock: { S: 6, M: 10, L: 14, XL: 8, XXL: 4 },
    featured: true,
    isNew: true,
    availability: "Pre-Order (2-3 Weeks)"
  },
  {
    id: "fb-kit-england-26-home",
    name: "England '26 Home Kit",
    club: "England National Team",
    league: "International",
    season: "2026",
    type: "Home",
    badge: "BELLINGHAM #10 // THREE LIONS",
    price: 1200,
    originalPrice: 1400,
    rating: 4.9,
    reviews: 19,
    description: "England National Team '26 Home kit in crisp white with red/navy side blade panels, embroidered Three Lions star crest, V-neck collar, and BELLINGHAM 10 player nameset. 100201 Pasig Hub archive.",
    image: "assets/products/england-26-1.jpg",
    images: [
      "assets/products/england-26-1.jpg",
      "assets/products/england-26-2.jpg"
    ],
    stock: { S: 5, M: 8, L: 11, XL: 5, XXL: 3 },
    featured: false,
    isNew: true,
    availability: "Pre-Order (2-3 Weeks)"
  },
  {
    id: "fb-kit-rm-9900-retro",
    name: "RETRO Real Madrid '99/'00 Home Kit",
    club: "Real Madrid",
    league: "La Liga",
    season: "1999/00",
    type: "Retro",
    badge: "TEKA SPONSOR // UCL ERA",
    price: 1100,
    originalPrice: 1350,
    rating: 5.0,
    reviews: 39,
    description: "Iconic Retro Real Madrid 1999/2000 Home Kit from the Champions League winning campaign in Paris. Features high-sheen white fabric, navy and yellow ribbed collar, stitched Adidas Trefoil, royal Real Madrid crest, and iconic Teka chest sponsor. Real photos taken on 100201 wooden hanger.",
    image: "assets/products/rm-9900-1.jpg",
    images: [
      "assets/products/rm-9900-1.jpg",
      "assets/products/rm-9900-2.jpg",
      "assets/products/rm-9900-3.jpg",
      "assets/products/rm-9900-4.jpg"
    ],
    stock: { S: 4, M: 9, L: 15, XL: 6, XXL: 2 },
    featured: true,
    isNew: false,
    availability: "Pre-Order (2-3 Weeks)"
  },
  {
    id: "fb-kit-santos-12-retro",
    name: "RETRO Santos FC 2012 Kit",
    club: "Santos FC",
    league: "Brasileirão",
    season: "2012",
    type: "Retro",
    badge: "NEYMAR JR #11 // BANCO BMG",
    price: 1200,
    originalPrice: 1450,
    rating: 5.0,
    reviews: 51,
    description: "Legendary Santos FC 2012 Centenary Third Kit worn during Neymar Jr's iconic Copa Libertadores era. Features all-black tonal body, Banco BMG sponsors, SEARA shoulder graphics, embroidered 1912-2012 Santos crest, 'Menino da Vila Desde 1912' inner collar inscription, and NEYMAR JR 11 print.",
    image: "assets/products/santos-12-1.jpg",
    images: [
      "assets/products/santos-12-1.jpg",
      "assets/products/santos-12-2.jpg",
      "assets/products/santos-12-3.jpg",
      "assets/products/santos-12-4.jpg"
    ],
    stock: { S: 3, M: 7, L: 12, XL: 5, XXL: 2 },
    featured: true,
    isNew: false,
    availability: "Pre-Order (2-3 Weeks)"
  },
  {
    id: "fb-kit-barca-2526-home",
    name: "Barcelona '25/'26 Spotify Home Kit",
    club: "FC Barcelona",
    league: "La Liga",
    season: "2025/26",
    type: "Home",
    badge: "125TH ANNIVERSARY // SPOTIFY",
    price: 1100,
    originalPrice: 1300,
    rating: 5.0,
    reviews: 27,
    description: "FC Barcelona 2025/2026 Home Kit commemorating the club's 125th Anniversary. Half-and-half Blaugrana heritage design with golden central Spotify sponsor and classic rounded collar.",
    image: "assets/products/barca-25-26-1.jpg",
    images: [
      "assets/products/barca-25-26-1.jpg",
      "assets/products/barca-25-26-2.jpg",
      "assets/products/barca-25-26-3.jpg",
      "assets/products/barca-25-26-4.jpg"
    ],
    stock: { S: 6, M: 10, L: 12, XL: 7, XXL: 3 },
    featured: false,
    isNew: true,
    availability: "Pre-Order (2-3 Weeks)"
  },
  {
    id: "fb-kit-psg-1213-retro",
    name: "RETRO PSG '12/'13 Home Kit",
    club: "Paris Saint-Germain",
    league: "Ligue 1",
    season: "2012/13",
    type: "Retro",
    badge: "VINTAGE FLY EMIRATES",
    price: 1100,
    originalPrice: 1350,
    rating: 4.9,
    reviews: 18,
    description: "Retro Paris Saint-Germain 2012/2013 Home Kit from the first Ligue 1 title under Carlo Ancelotti. Deep midnight blue body with central red and white Parisian vertical block stripe and classic Fly Emirates sponsor.",
    image: "assets/products/psg-retro-1.jpg",
    images: [
      "assets/products/psg-retro-1.jpg",
      "assets/products/psg-retro-2.jpg",
      "assets/products/psg-retro-3.jpg",
      "assets/products/psg-retro-4.jpg"
    ],
    stock: { S: 4, M: 8, L: 10, XL: 5, XXL: 2 },
    featured: false,
    isNew: false,
    availability: "Pre-Order (2-3 Weeks)"
  },
  {
    id: "fb-kit-brasil-06-retro",
    name: "Retro Brasil '06/'08 Home Kit",
    club: "Brasil National Team",
    league: "International",
    season: "2006",
    type: "Retro",
    badge: "RONALDO #9 // WORLD CUP ARCHIVE",
    price: 1200,
    originalPrice: 1500,
    rating: 5.0,
    reviews: 64,
    description: "Timeless 2006 World Cup Brasil Home Kit worn by O Fenômeno Ronaldo #9. Classic canary yellow body with green stand collar, 5-star CBF crest, and official golden nameset on back.",
    image: "assets/products/brasil-06-1.jpg",
    images: [
      "assets/products/brasil-06-1.jpg",
      "assets/products/brasil-06-2.jpg",
      "assets/products/brasil-06-3.jpg",
      "assets/products/brasil-06-4.jpg"
    ],
    stock: { S: 5, M: 9, L: 14, XL: 6, XXL: 3 },
    featured: true,
    isNew: false,
    availability: "On-Hand Ready to Ship"
  },
  {
    id: "fb-kit-portugal-04-retro",
    name: "Retro Portugal '04 Home Kit",
    club: "Portugal National Team",
    league: "International",
    season: "2004",
    type: "Retro",
    badge: "C. RONALDO #17 // EURO 2004",
    price: 1200,
    originalPrice: 1500,
    rating: 5.0,
    reviews: 47,
    description: "Iconic Portugal Euro 2004 Total 90 Home Kit worn during Cristiano Ronaldo's breakout international tournament. Rich garnet red body, golden yellow circular number 17, and green collar accents.",
    image: "assets/products/portugal-04-1.jpg",
    images: [
      "assets/products/portugal-04-1.jpg",
      "assets/products/portugal-04-2.jpg",
      "assets/products/portugal-04-3.jpg",
      "assets/products/portugal-04-4.jpg"
    ],
    stock: { S: 4, M: 8, L: 11, XL: 5, XXL: 2 },
    featured: true,
    isNew: false,
    availability: "On-Hand Ready to Ship"
  },
  {
    id: "fb-kit-germany-1990-retro",
    name: "Germany Retro 1990 Home Kit",
    club: "Germany National Team",
    league: "International",
    season: "1990",
    type: "Retro",
    badge: "DFB CHEVRON // ITALIA '90",
    price: 1100,
    originalPrice: 1300,
    rating: 4.9,
    reviews: 31,
    description: "The quintessential World Cup 1990 Germany Home Kit featuring the legendary tricolor German flag ribbon chevron across the chest. Classic white body with DFB crest.",
    image: "assets/products/germany-1990-1.jpg",
    images: [
      "assets/products/germany-1990-1.jpg"
    ],
    stock: { S: 3, M: 6, L: 8, XL: 4, XXL: 2 },
    featured: false,
    isNew: false,
    availability: "On-Hand Ready to Ship"
  }
];

// Payment methods tailored to 100201 Football Shop (Philippines + International)
export const INITIAL_PAYMENT_METHODS = [
  {
    id: "pm-gcash-01",
    type: "gcash",
    brand: "GCash",
    accountName: "100201 Football Shop",
    accountNumber: "0917-882-0101",
    isDefault: true,
    badgeText: "GCASH"
  },
  {
    id: "pm-maya-02",
    type: "maya",
    brand: "Maya",
    accountName: "100201 Football Shop",
    accountNumber: "0917-882-0101",
    isDefault: false,
    badgeText: "MAYA"
  },
  {
    id: "pm-bdo-03",
    type: "bank",
    brand: "BDO Unibank",
    accountName: "100201 Sports Merch",
    accountNumber: "0012-3456-7890",
    isDefault: false,
    badgeText: "BDO"
  },
  {
    id: "pm-card-04",
    type: "card",
    cardBrand: "visa",
    cardHolder: "Alex Sterling",
    last4: "4242",
    expiry: "11/28",
    isDefault: false,
    badgeText: "VISA"
  },
  {
    id: "pm-cop-05",
    type: "pickup",
    brand: "Cash on Pick-up",
    accountName: "Store Collection Point",
    accountNumber: "Pay at Pick-up Counter",
    isDefault: false,
    badgeText: "PICKUP"
  }
];

// Orders start clean and are recorded upon customer checkout
export const INITIAL_ORDERS = [];

export const KIT_IMAGE_PRESETS = [
  { name: "Argentina 3-Star Stripes", url: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=800&q=80" },
  { name: "Real Madrid Pristine White", url: "https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&w=800&q=80" },
  { name: "Arsenal Highbury Maroon", url: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=800&q=80" },
  { name: "Samurai Blue Origami", url: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=800&q=80" },
  { name: "Spain Red & Gold", url: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80" },
  { name: "Manchester United Retro Red", url: "https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=800&q=80" },
  { name: "Bayern Burgundy Retro", url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80" },
  { name: "Blaugrana Stripes", url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80" }
];
