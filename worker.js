addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const ipfsPath = url.pathname.replace("/ipfs/", "");
  
  // List of IPFS gateways to try
  const gateways = [
    `https://cloudflare-ipfs.com/ipfs/${ipfsPath}${url.search}`,
    `https://ipfs.io/ipfs/${ipfsPath}${url.search}`,
    `https://dweb.link/ipfs/${ipfsPath}${url.search}` // Additional reliable gateway
  ];

  const cache = caches.default;
  let response = await cache.match(request);
  if (response) {
    console.log(`Cache hit for ${request.url}`);
    return response;
  }

  // Try each gateway until one succeeds
  for (const gateway of gateways) {
    try {
      response = await fetch(gateway, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MossNet/1.0)",
          "Accept": "application/json"
        }
      });
      if (response.ok) {
        // Cache the response
        const cacheResponse = response.clone();
        event.waitUntil(cache.put(request, cacheResponse));
        break; // Exit loop on success
      } else {
        console.log(`Gateway ${gateway} failed with status ${response.status}`);
      }
    } catch (error) {
      console.log(`Error fetching from ${gateway}: ${error}`);
    }
  }

  if (!response || !response.ok) {
    return new Response("All IPFS gateways failed", { status: 502 });
  }

  // Add CORS headers
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*"); // Use wildcard for testing
  newHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  newHeaders.set("Access-Control-Allow-Headers", "*");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}