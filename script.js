// Requires <script src="script.js" type="module"> in index.html for ES modules

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
const mintNFTBtn = document.getElementById('mint-nft-btn');
const walletAddressEl = document.getElementById('wallet-address');
const inviteListsEl = document.getElementById('invite-lists');
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
const SCATTER_API = 'https://api.scatter.art/v1/';
const COLLECTION_SLUGS = ['mossnet', 'mossnet-banners'];
const CIGSUIGA_SLUG = 'cigsuiga'; // Replace with your actual Cigsuiga collection slug
const CIGSUIGA_ADDRESS = 'YOUR_CIGSUIGA_ADDRESS'; // Replace with your Cigsuiga contract address
const SCATTER_API_KEY = ''; // Add if required by Scatter.art (optional for public endpoints)

// Wagmi config for Sanko chain
import { configureChains, createConfig, connect, sendTransaction } from 'https://unpkg.com/@wagmi/core@2.13.8/dist/index.js';
import { publicProvider } from 'https://unpkg.com/@wagmi/core@2.13.8/dist/providers/public.js';

const sankoChain = {
    id: 1996,
    name: 'Sanko Mainnet',
    network: 'sanko',
    nativeCurrency: { name: 'Dream Machine Token', symbol: 'DMT', decimals: 18 },
    rpcUrls: { default: { http: ['https://mainnet.sanko.xyz'] }, public: { http: ['https://mainnet.sanko.xyz'] } },
    blockExplorers: { default: { name: 'SankoExplorer', url: 'https://explorer.sanko.xyz' } },
};

const { chains, publicClient } = configureChains([sankoChain], [publicProvider()]);
const config = createConfig({
    autoConnect: false,
    publicClient,
});

// Wallet connection
async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        console.warn('No wallet detected');
        walletAddressEl.textContent = 'Please install a MetaMask wallet.';
        walletAddressEl.classList.remove('hidden');
        return;
    }

    try {
        const web3 = new Web3(window.ethereum);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const walletAddress = accounts[0];

        // Ensure Sanko chain
        const chainId = await web3.eth.getChainId();
        if (chainId !== 1996) {
            await addSankoChain();
        }

        console.log(`Connected to wallet: ${walletAddress}`);
        walletAddressEl.textContent = `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
        walletAddressEl.classList.remove('hidden');
        connectWalletBtn.textContent = 'Check NFTs';
        connectWalletBtn.onclick = checkNFTs;
        if (mintNFTBtn) mintNFTBtn.disabled = false; // Enable mint button if present
        await connect(config, { chainId: sankoChain.id }); // Connect wagmi
        await fetchInviteLists(walletAddress);
    } catch (error) {
        console.error('Wallet connection error:', error);
        walletAddressEl.textContent = error.code === 4001 ? 'Please accept the wallet prompt.' : 'Connection failed. Try again.';
        walletAddressEl.classList.remove('hidden');
    }
}

// Add Sanko chain
async function addSankoChain() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x7CC' }],
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
                        blockExplorerUrls: ['https://explorer.sanko.xyz'],
                    }],
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

// Fetch eligible invite lists for Cigsuiga
async function fetchInviteLists(walletAddress) {
    if (!inviteListsEl) {
        console.error('Invite lists container not found. Ensure <div id="invite-lists"> exists in index.html.');
        return;
    }

    try {
        if (SCATTER_API_KEY === '') console.warn('SCATTER_API_KEY is empty. Some API endpoints may require a key.');
        const response = await fetch(
            `${SCATTER_API}collection/${CIGSUIGA_SLUG}/eligible-invite-lists${walletAddress ? `?walletAddress=${walletAddress}` : ''}`,
            {
                headers: SCATTER_API_KEY ? { 'Authorization': `Bearer ${SCATTER_API_KEY}` } : {},
            }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const data = await response.json();
        console.log('Eligible invite lists:', data);
        inviteListsEl.innerHTML = '<h3>Available Mint Lists</h3>';
        if (data.length === 0) {
            inviteListsEl.innerHTML += '<p>No eligible mint lists found.</p>';
            if (mintNFTBtn) mintNFTBtn.disabled = true;
            return;
        }
        data.forEach((list) => {
            const button = document.createElement('button');
            button.textContent = `${list.name} - ${list.token_price} ${list.currency_symbol}`;
            button.classList.add('invite-list-btn');
            button.onclick = () => mintNFT(list.id);
            inviteListsEl.appendChild(button);
        });
    } catch (error) {
        console.error('Error fetching invite lists:', error);
        inviteListsEl.innerHTML = '<p>Failed to load mint lists.</p>';
        if (mintNFTBtn) mintNFTBtn.disabled = true;
    }
}

// Mint NFT
async function mintNFT(inviteListId) {
    if (CIGSUIGA_ADDRESS === 'YOUR_CIGSUIGA_ADDRESS') {
        alert('Please update CIGSUIGA_ADDRESS in script.js with your collection contract address.');
        return;
    }

    try {
        if (SCATTER_API_KEY === '') console.warn('SCATTER_API_KEY is empty. Some API endpoints may require a key.');
        const response = await fetch(`${SCATTER_API}mint`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(SCATTER_API_KEY ? { 'Authorization': `Bearer ${SCATTER_API_KEY}` } : {}),
            },
            body: JSON.stringify({
                collectionAddress: CIGSUIGA_ADDRESS,
                chainId: sankoChain.id,
                minterAddress: window.ethereum.selectedAddress,
                lists: [{ id: inviteListId, quantity: 1 }],
            }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const data = await response.json();
        console.log('Mint transaction:', data);

        if (data.erc20s.length > 0) {
            alert('ERC20 approval needed. Contact Scatter.art support for guidance.');
            return;
        }

        const { to, value, data: txData } = data.mintTransaction;
        await sendTransaction(config, {
            to,
            value: BigInt(value),
            data: txData,
            chainId: sankoChain.id,
        });
        alert('NFT minted successfully!');
        inviteListsEl.innerHTML += '<p>Mint successful! Check your wallet.</p>';
    } catch (error) {
        console.error('Minting failed:', error);
        alert('Minting failed. Check console for details.');
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
    if (imageUrl) {
        try {
            await preloadImage(imageUrl);
            console.log(`Image loaded for ${slug}, token ${tokenId}: ${imageUrl}`);
            return imageUrl;
        } catch (error) {
            console.warn(`Failed to load image_url for ${slug}, token ${tokenId}: ${imageUrl}`, error.message);
        }
    }
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

// Check NFTs via Scatter API
async function checkNFTs() {
    const owner = window.ethereum.selectedAddress;
    const collections = [
        { slug: 'mossnet', address: '0x8e718b4aFe2ad12345c5a327e3c2cB7645026BB2' },
        { slug: 'mossnet-banners', address: '0x9275Bf0a32ae3c9227065f998Ac0B392FB9f0BFe' },
    ];
    let nfts = [];
    for (const collection of collections) {
        try {
            if (SCATTER_API_KEY === '') console.warn('SCATTER_API_KEY is empty. Some API endpoints may require a key.');
            const headers = SCATTER_API_KEY ? { 'Authorization': `Bearer ${SCATTER_API_KEY}` } : {};
            const response = await fetch(
                `${SCATTER_API}collection/${collection.slug}/nfts?ownerAddress=${owner}&pageSize=100`,
                { headers }
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const data = await response.json();
            const collectionNfts = data.data.map(nft => ({
                contractAddress: collection.address,
                tokenId: nft.token_id.toString(),
                imageUrl: nft.image_url,
            }));
            nfts.push(...collectionNfts);
            console.log(`Fetched ${collectionNfts.length} NFTs for ${collection.slug}`);
        } catch (error) {
            console.error(`Error fetching NFTs for ${collection.slug}:`, error);
        }
    }
    await displayNFTs(nfts);
}

// Display NFTs
async function displayNFTs(nfts) {
    if (!nftList || !nftLoading || !nftEmpty) {
        console.error('NFT display elements not found. Check index.html.');
        return;
    }
    nftList.innerHTML = '';
    nftLoading.classList.remove('hidden');
    nftEmpty.classList.add('hidden');
    if (nfts.length === 0) {
        nftLoading.classList.add('hidden');
        nftEmpty.classList.remove('hidden');
        return;
    }
    for (const nft of nfts) {
        try {
            const img = document.createElement('img');
            img.src = await fetchImage(nft.imageUrl, null, nft.tokenId, 'mossnet');
            img.alt = `NFT ${nft.tokenId}`;
            img.classList.add('nft-image');
            img.addEventListener('click', () => {
                modalImage.src = img.src;
                imageModal.classList.remove('hidden');
            });
            nftList.appendChild(img);
            console.log(`Added NFT ${nft.tokenId} from ${nft.contractAddress}`);
        } catch (error) {
            console.error(`Error displaying NFT ${nft.tokenId}:`, error);
        }
    }
    nftLoading.classList.add('hidden');
    if (nftList.innerHTML === '') {
        nftEmpty.classList.remove('hidden');
    }
}

// Event listeners
connectWalletBtn.addEventListener('click', connectWallet);
if (mintNFTBtn) {
    mintNFTBtn.addEventListener('click', () => {
        if (!inviteListsEl) return;
        if (inviteListsEl.innerHTML === '') {
            inviteListsEl.innerHTML = '<p>Please connect wallet to see mint lists.</p>';
        } else {
            inviteListsEl.innerHTML = '<p>Please select a mint list.</p>';
        }
    });
}
minimizeNFTBtn.addEventListener('click', () => nftOverlay.classList.add('hidden'));
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
    iframeEmbed.addEventListener('error', () => iframeFallback.classList.remove('hidden'));
    setTimeout(() => {
        if (!iframeEmbed.contentWindow) iframeFallback.classList.remove('hidden');
    }, 5000);
});
minimizeIframeBtn.addEventListener('click', () => {
    iframeOverlay.classList.add('hidden');
    iframeFallback.classList.add('hidden');
});
if (stationThisBotBtn) {
    stationThisBotBtn.addEventListener('click', () => window.open('https://x.com/stationthisbot', '_blank'));
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