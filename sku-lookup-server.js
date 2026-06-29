const http = require("http");
const https = require("https");

const SHOPIFY_DOMAIN = "www.levelupforless.com";

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; SKULookup/1.0)"
      }
    };
    https.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`not JSON`)); }
      });
    }).on("error", reject);
  });
}

function extractSearchQueries(sku) {
  const clean = sku.trim();
  const queries = [clean];

  const spaceIdx = clean.lastIndexOf(" ");
  if (spaceIdx > 0) {
    queries.push(clean.substring(0, spaceIdx));
  }

  const dashParts = clean.split("-");
  if (dashParts.length >= 2) {
    const lastPart = dashParts[dashParts.length - 1];
    if (lastPart.length <= 2 && lastPart.match(/^[A-Z]+$/i)) {
      queries.push(dashParts.slice(0, -1).join("-"));
    }
  }

  return queries;
}

function getVariantIndicator(sku) {
  const clean = sku.trim();
  const spaceIdx = clean.lastIndexOf(" ");
  if (spaceIdx > 0) {
    return clean.substring(spaceIdx + 1).trim();
  }
  const dashParts = clean.split("-");
  const lastPart = dashParts[dashParts.length - 1];
  if (lastPart.length <= 2 && lastPart.match(/^[A-Z]+$/i)) {
    return lastPart;
  }
  return null;
}

function matchVariant(sku, variants, variantIndicator) {
  const clean = sku.trim().toUpperCase();

  for (const v of variants) {
    if (v.sku && v.sku.toUpperCase().includes(clean)) return v;
    if (v.sku && clean.includes(v.sku.toUpperCase())) return v;
  }

  if (variantIndicator) {
    const vi = variantIndicator.toUpperCase();
    for (const v of variants) {
      const title = (v.title || v.option1 || "").toUpperCase();
      const opt1 = (v.option1 || "").toUpperCase();
      if (title === vi || opt1 === vi) return v;
      if (title.startsWith(vi) || opt1.startsWith(vi)) return v;
    }
  }

  for (const v of variants) {
    if (v.sku && v.sku.toUpperCase().includes(variantIndicator?.toUpperCase() || "")) return v;
  }

  return variants[0] || null;
}

async function lookupSKU(sku) {
  const queries = extractSearchQueries(sku);
  const variantIndicator = getVariantIndicator(sku);
  console.log(`[lookup] "${sku}" => ${products.length > 0 ? "found" : "not found"}`);

  let suggest = null;
  let products = [];

  for (const q of queries) {
    try {
      suggest = await fetchJSON(
        `https://${SHOPIFY_DOMAIN}/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product`
      );
      products = suggest?.resources?.results?.products || [];
      if (products.length > 0) break;
    } catch (e) {
      continue;
    }
  }

  if (products.length === 0) {
    return { sku, imageUrl: "", available: false, variantSku: "", error: null };
  }

  const product = products[0];
  const handle = product.handle;

  let detail;
  try {
    detail = await fetchJSON(`https://${SHOPIFY_DOMAIN}/products/${handle}.json`);
  } catch (e) {
    return { sku, imageUrl: "", available: false, variantSku: "", error: null };
  }

  const variants = detail?.product?.variants || [];
  const variant = matchVariant(sku, variants, variantIndicator);

  if (!variant) {
    return { sku, imageUrl: "", available: false, variantSku: "", error: null };
  }

  let imageUrl = product.image || product.featured_image?.url || "";
  if (variant?.featured_image?.src) {
    imageUrl = variant.featured_image.src;
  } else if (variant?.image_id && detail?.product?.images) {
    const vi = detail.product.images.find((img) => img.id === variant.image_id);
    if (vi) imageUrl = vi.src;
  }
  const fullImageUrl = imageUrl.startsWith("http")
    ? imageUrl.replace("http:", "https:")
    : imageUrl ? `https:${imageUrl}` : "/";

  return {
    sku,
    imageUrl: fullImageUrl || "/",
    available: variant.available ?? true,
    variantSku: variant.sku || sku,
    error: null,
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/lookup") {
    const sku = url.searchParams.get("sku");
    if (!sku) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Missing ?sku= parameter" }));
    }
    try {
      const result = await lookupSKU(sku);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(200);
      res.end(JSON.stringify({ sku, imageUrl: "/", available: false, variantSku: "/", error: null }));
    }
    return;
  }

  if (url.pathname === "/health") {
    res.writeHead(200);
    return res.end(JSON.stringify({ status: "ok" }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

const PORT = process.env.PORT || 3456;
server.listen(PORT, () => {
  console.log(`SKU Lookup Server running on port ${PORT}`);
  console.log(`Test: curl "http://localhost:${PORT}/lookup?sku=IOCH-207-BG"`);
});