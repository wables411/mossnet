// Elements
const beetleBtn = document.getElementById('beetle-btn');
const videoOverlay = document.getElementById('video-overlay');
const overlayVideo = document.getElementById('overlay-video');
const minimizeVideoBtn = document.getElementById('minimize-video-btn');
const seedBtn = document.getElementById('seed-btn');
const iframeOverlay = document.getElementById('iframe-overlay');
const iframeEmbed = document.getElementById('iframe-embed');
const iframeFallback = document.querySelector('.iframe-fallback');
const minimizeIframeBtn = document.getElementById('minimize-iframe-btn');
const connectWalletBtn = document.getElementById('connect-wallet-btn');
const walletAddressEl = document.getElementById('wallet-address');
const nftOverlay = document.getElementById('nft-overlay');
const nftList = document.getElementById('nft-list');
const nftEmpty = document.getElementById('nft-empty');
const nftLoading = document.getElementById('nft-loading');
const minimizeNFTBtn = document.getElementById('minimize-nft-btn');
const stationThisBotBtn = document.getElementById('stationthisbot-btn');
const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const closeModal = document.getElementById('close-modal');

// Cloudflare Worker URL and fallback gateways
const PROXY_URL = 'https://mossnet-proxy.wablesphoto.workers.dev';
const ipfsGateways = [
    `${PROXY_URL}/ipfs/`,
    'https://dweb.link/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.io/ipfs/'
];

// Scatter API config
const SCATTER_API = 'https://api.scatter.art/';
const COLLECTION_SLUGS = ['mossnet', 'mossnet-banners'];
const SCATTER_API_KEY = ''; // Empty unless required

// Wallet connection
async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const web3 = new Web3(window.ethereum);
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const walletAddress = accounts[0];
            console.log(`Connected to wallet: ${walletAddress}`);
            walletAddressEl.textContent = `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
            walletAddressEl.classList.remove('hidden');
            connectWalletBtn.textContent = 'Check NFTs';
            connectWalletBtn.onclick = checkNFTs;

            // Check Sanko chain
            const chainId = await web3.eth.getChainId();
            if (chainId !== 1996) {
                await addSankoChain();
            }
        } catch (error) {
            console.error('Wallet connection error:', error);
            walletAddressEl.textContent = error.code === 4001 ? 'Please accept the wallet prompt.' : 'Connection failed. Try again.';
            walletAddressEl.classList.remove('hidden');
        }
    } else {
        console.warn('No wallet detected');
        walletAddressEl.textContent = 'Please install a MetaMask wallet.';
        walletAddressEl.classList.remove('hidden');
    }
}

// Add Sanko chain
async function addSankoChain() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x7CC' }]
        });
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x7CC',
                        chainName: 'Sanko Mainnet',
                        rpcUrls: ['https://mainnet.sanko.xyz'],
                        nativeCurrency: { name: 'Dream Machine Token', symbol: 'DMT', decimals: 18 },
                        blockExplorerUrls: ['https://explorer.sanko.xyz']
                    }]
                });
            } catch (error) {
                console.error('Failed to add Sanko chain:', error);
                walletAddressEl.textContent = 'Please switch to Sanko chain (ID: 1996).';
                walletAddressEl.classList.remove('hidden');
            }
        } else {
            console.error('Failed to switch to Sanko chain:', switchError);
            walletAddressEl.textContent = 'Please switch to Sanko chain (ID: 1996).';
            walletAddressEl.classList.remove('hidden');
        }
    }
}

// Preload image
function preloadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(url);
        img.onerror = () => reject(new Error(`Failed to preload ${url}`));
    });
}

// Fetch image with fallback gateways
async function fetchImage(imageUrl, ipfsImage, tokenId, slug) {
    // Try image_url first
    if (imageUrl) {
        try {
            await preloadImage(imageUrl);
            console.log(`Image loaded for ${slug}, token ${tokenId}: ${imageUrl}`);
            return imageUrl;
        } catch (error) {
            console.warn(`Failed to load image_url for ${slug}, token ${tokenId}: ${imageUrl}`, error.message);
        }
    }
    // Fallback to ipfs image
    if (ipfsImage && ipfsImage.startsWith('ipfs://')) {
        const cid = ipfsImage.replace('ipfs://', '');
        const urls = ipfsGateways.map(gateway => `${gateway}${cid}`);
        for (const url of urls) {
            try {
                await preloadImage(url);
                console.log(`Image loaded for ${slug}, token ${tokenId}: ${url}`);
                return url;
            } catch (error) {
                console.warn(`Failed to load image for ${slug}, token ${tokenId} via ${url}:`, error.message);
            }
        }
        console.error(`All gateways failed for ${slug}, token ${tokenId}`);
    }
    return 'assets/placeholder.png';
}

// Fetch all pages of Scatter API
async function fetchAllNfts(slug) {
    let allNfts = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (SCATTER_API_KEY) headers['Authorization'] = `Bearer ${SCATTER_API_KEY}`;
            const response = await fetch(`${SCATTER_API}/collection/${slug}/nfts?page=${page}&pageSize=50`, {
                method: 'GET',
                headers
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${slug}: ${response.statusText}`);
            }
            const data = await response.json();
            console.log(`NFTs for ${slug}, page ${page}:`, data);

            if (data.data && Array.isArray(data.data)) {
                allNfts = allNfts.concat(data.data);
                totalPages = data.totalPages || 1;
                page++;
            } else {
                console.warn(`No data array for ${slug}, page ${page}`);
                break;
            }
        } catch (error) {
            console.error(`Failed to fetch NFTs for ${slug}, page ${page}:`, error.message);
            break;
        }
    }
    return allNfts;
}

// Check NFTs via Scatter API
async function checkNFTs() {
    const owner = window.ethereum.selectedAddress;
    const collections = [
        { slug: "mossnet", address: "0x8e718b4aFe2ad12345c5a327e3c2cB7645026BB2" },
        { slug: "mossnet-banners", address: "0x9275Bf0a32ae3c9227065f998Ac0B392FB9f0BFe" }
    ];
    let nfts = [];
    for (const collection of collections) {
        try {
            const response = await fetch(
                `https://api.scatter.art/v1/collection/${collection.slug}/nfts?ownerAddress=${owner}&pageSize=100`,
                {
                    headers: {
                        "Authorization": "Bearer YOUR_SCATTER_API_KEY"
                    }
                }
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const collectionNfts = data.data.map(nft => ({
                contractAddress: collection.address,
                tokenId: nft.token_id.toString(),
                imageUrl: nft.image_url // Use Scatter's image_url directly
            }));
            nfts.push(...collectionNfts);
            console.log(`Fetched ${collectionNfts.length} NFTs for ${collection.slug}`);
        } catch (error) {
            console.log(`Error fetching NFTs for ${collection.slug}: ${error}`);
        }
    }
    async function displayNFTs(nfts) {
    const nftList = document.getElementById("nft-list");
    const nftLoading = document.getElementById("nft-loading");
    const nftEmpty = document.getElementById("nft-empty");
    nftList.innerHTML = "";
    nftLoading.classList.remove("hidden");
    nftEmpty.classList.add("hidden");
    if (nfts.length === 0) {
        nftLoading.classList.add("hidden");
        nftEmpty.classList.remove("hidden");
        return;
    }
    for (const nft of nfts) {
        try {
            const img = document.createElement("img");
            img.src = nft.imageUrl;
            img.alt = `NFT ${nft.tokenId}`;
            img.classList.add("nft-image");
            img.addEventListener("click", () => {
                const modal = document.getElementById("image-modal");
                const modalImage = document.getElementById("modal-image");
                modalImage.src = nft.imageUrl;
                modal.classList.remove("hidden");
            });
            nftList.appendChild(img);
            console.log(`Added NFT ${nft.tokenId} from ${nft.contractAddress}`);
        } catch (error) {
            console.log(`Error displaying NFT ${nft.tokenId}: ${error}`);
        }
    }
    nftLoading.classList.add("hidden");
    if (nftList.innerHTML === "") {
        nftEmpty.classList.remove("hidden");
    }
}
}

// Event listeners
connectWalletBtn.addEventListener('click', connectWallet);
minimizeNFTBtn.addEventListener('click', () => {
    nftOverlay.classList.add('hidden');
});

beetleBtn.addEventListener('click', () => {
    videoOverlay.classList.remove('hidden');
    overlayVideo.play();
});

minimizeVideoBtn.addEventListener('click', () => {
    videoOverlay.classList.add('hidden');
    overlayVideo.pause();
});

seedBtn.addEventListener('click', () => {
    iframeOverlay.classList.remove('hidden');
    iframeEmbed.addEventListener('error', () => {
        iframeFallback.classList.remove('hidden');
    });
    setTimeout(() => {
        if (!iframeEmbed.contentWindow) {
            iframeFallback.classList.remove('hidden');
        }
    }, 5000);
});

minimizeIframeBtn.addEventListener('click', () => {
    iframeOverlay.classList.add('hidden');
    iframeFallback.classList.add('hidden');
});

if (stationThisBotBtn) {
    stationThisBotBtn.addEventListener('click', () => {
        window.open('https://x.com/stationthisbot', '_blank');
    });
}

if (closeModal) {
    closeModal.addEventListener('click', () => {
        imageModal.classList.add('hidden');
        modalImage.src = '';
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !imageModal.classList.contains('hidden')) {
            imageModal.classList.add('hidden');
            modalImage.src = '';
        }
    });
}

if (imageModal) {
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            imageModal.classList.add('hidden');
            modalImage.src = '';
        }
    });
}