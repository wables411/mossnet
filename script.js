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
    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (!accounts[0]) {
            walletAddressEl.textContent = 'Please reconnect wallet.';
            walletAddressEl.classList.remove('hidden');
            connectWalletBtn.textContent = 'Connect Wallet';
            connectWalletBtn.onclick = connectWallet;
            return;
        }
        const owner = accounts[0].toLowerCase();
        console.log(`Checking NFTs for owner: ${owner}`);
        nftList.innerHTML = '';
        nftEmpty.classList.add('hidden');
        nftLoading.classList.remove('hidden');
        let nfts = [];

        for (const slug of COLLECTION_SLUGS) {
            const allNfts = await fetchAllNfts(slug);
            console.log(`All NFTs for ${slug}:`, allNfts);

            // Filter NFTs owned by the wallet
            const ownedNfts = allNfts.filter(nft => nft.owner && nft.owner.toLowerCase() === owner);
            console.log(`Owned NFTs for ${slug}:`, ownedNfts);

            for (const nft of ownedNfts) {
                const tokenId = nft.token_id || nft.id || 'Unknown';
                const metadata = nft.metadata ? (typeof nft.metadata === 'string' ? JSON.parse(nft.metadata) : nft.metadata) : {};
                const name = metadata.name || nft.name || `Token #${tokenId}`;
                const image = await fetchImage(nft.image_url, nft.image, tokenId, slug);
                const collection = slug === 'mossnet' ? 'MossNet' : 'MossNet: Banners';
                nfts.push({
                    token_id: tokenId,
                    token_address: nft.address || slug,
                    metadata: JSON.stringify(metadata),
                    name,
                    image,
                    collection
                });
            }
        }

        nftLoading.classList.add('hidden');
        if (nfts.length === 0) {
            nftEmpty.textContent = 'No NFTs found from these collections. Verify wallet or API data.';
            nftEmpty.classList.remove('hidden');
        } else {
            nfts.forEach(nft => {
                const nftItem = document.createElement('div');
                nftItem.className = 'nft-item';
                const img = document.createElement('img');
                img.src = nft.image;
                img.alt = nft.name;
                img.className = 'nft-image';
                img.addEventListener('error', () => {
                    console.warn(`Image failed for ${nft.collection} #${nft.token_id}: ${nft.image}`);
                    img.src = 'assets/placeholder.png';
                });
                img.addEventListener('click', () => {
                    console.log(`Clicked NFT image: ${nft.image}`);
                    modalImage.src = nft.image;
                    imageModal.classList.remove('hidden');
                });
                nftItem.appendChild(img);
                nftItem.innerHTML += `
                    <p>${nft.name}</p>
                    <p>ID: ${nft.token_id}</p>
                    <p>${nft.collection}</p>
                `;
                nftList.appendChild(nftItem);
            });
        }
        nftOverlay.classList.remove('hidden');
    } catch (error) {
        console.error('NFT fetch failed:', error);
        nftLoading.classList.add('hidden');
        nftEmpty.textContent = 'Failed to load NFTs. Try again.';
        nftEmpty.classList.remove('hidden');
        nftOverlay.classList.remove('hidden');
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