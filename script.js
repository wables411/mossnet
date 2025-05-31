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
const minimizeNftBtn = document.getElementById('minimize-nft-btn');

// Moralis setup
Moralis.start({
    apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjFhZGY2OGE4LTk1MjMtNGE3NC1iNWI1LTMzNTQ0MGZhNjE5NiIsIm9yZ0lkIjoiNDUwMTQyIiwidXNlcklkIjoiNDYzMTU1IiwidHlwZUlkIjoiNDcyYWQxZWQtMDBlMi00M2RiLWI4MjAtMTI0NGE1NzdlMjg0IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDg2MzgwNDgsImV4cCI6NDkwNDM5ODA0OH0.Syr_w9VIl7ozDwIOLoQFA74qlgqP4t14WBvXORwsjfY' // Replace with your Moralis API key
});

// Wallet connection
async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send('eth_requestAccounts', []);
            const address = accounts[0];
            walletAddressEl.textContent = `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`;
            walletAddressEl.classList.remove('hidden');
            connectWalletBtn.textContent = 'Check NFTs';
            connectWalletBtn.onclick = checkNFTs;

            // Check current chain
            const chainId = await provider.getNetwork().then(net => net.chainId);
            if (Number(chainId) !== 1996) {
                await addSankoChain();
            }
        } catch (error) {
            console.error('Wallet connection failed:', error);
            if (error.code === 4001) {
                walletAddressEl.textContent = 'Please accept the MetaMask prompt.';
            } else {
                walletAddressEl.textContent = 'Connection failed. Try again.';
            }
            walletAddressEl.classList.remove('hidden');
        }
    } else {
        walletAddressEl.textContent = 'Please install MetaMask.';
        walletAddressEl.classList.remove('hidden');
    }
}

// Add Sanko chain
async function addSankoChain() {
    try {
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: '0x7CC', // 1996
                chainName: 'Sanko Mainnet',
                rpcUrls: ['https://mainnet.sanko.xyz'],
                nativeCurrency: { name: 'Dream Machine Token', symbol: 'DMT', decimals: 18 },
                blockExplorerUrls: ['https://explorer.sanko.xyz']
            }]
        });
    } catch (error) {
        console.error('Failed to add Sanko chain:', error);
        walletAddressEl.textContent = 'Please switch to Sanko chain (ID: 1996) manually.';
        walletAddressEl.classList.remove('hidden');
    }
}

// Check NFTs
async function checkNFTs() {
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_accounts', []);
        if (!accounts[0]) {
            walletAddressEl.textContent = 'Please reconnect wallet.';
            walletAddressEl.classList.remove('hidden');
            connectWalletBtn.textContent = 'Connect Wallet';
            connectWalletBtn.onclick = connectWallet;
            return;
        }
        nftList.innerHTML = '';
        nftEmpty.classList.add('hidden');
        let nfts = [];

        // Sanko NFTs (chain ID: 1996)
        const sankoNfts = await Moralis.EvmApi.nft.getWalletNFTs({
            chain: '0x7CC',
            address: accounts[0],
            tokenAddresses: [
                '0x8e718b4aFe2ad12345c5a327e3c2cB7645026BB2',
                '0x9275Bf0a32ae3c9227065f998Ac0B392FB9f0BFe'
            ]
        });
        nfts = nfts.concat(sankoNfts.raw.result);

        // Ethereum NFTs (chain ID: 1)
        const ethNfts = await Moralis.EvmApi.nft.getWalletNFTs({
            chain: '0x1',
            address: accounts[0],
            tokenAddresses: ['0x71f7bedf8572b75e446766906079dcf05a386737']
        });
        nfts = nfts.concat(ethNfts.raw.result);

        if (nfts.length === 0) {
            nftEmpty.classList.remove('hidden');
        } else {
            nfts.forEach(nft => {
                const metadata = nft.metadata ? JSON.parse(nft.metadata) : {};
                const name = metadata.name || `Token #${nft.token_id}`;
                const image = metadata.image || 'assets/placeholder.png';
                const collection = getCollectionName(nft.token_address);
                const nftItem = document.createElement('div');
                nftItem.className = 'nft-item';
                nftItem.innerHTML = `
                    <img src="${image}" alt="${name}">
                    <p>${name}</p>
                    <p>ID: ${nft.token_id}</p>
                    <p>${collection}</p>
                `;
                nftList.appendChild(nftItem);
            });
        }
        nftOverlay.classList.remove('hidden');
    } catch (error) {
        console.error('NFT fetch failed:', error);
        if (error.message.includes('Token is invalid format')) {
            nftEmpty.textContent = 'Invalid Moralis API key. Please contact support.';
        } else {
            nftEmpty.textContent = 'Failed to load NFTs. Try again.';
        }
        nftEmpty.classList.remove('hidden');
        nftOverlay.classList.remove('hidden');
    }
}

// Map contract to collection name
function getCollectionName(address) {
    const collections = {
        '0x8e718b4afe2ad12345c5a327e3c2cb7645026bb2': 'MossNet',
        '0x9275bf0a32ae3c9227065f998ac0b392fb9f0bfe': 'MossNet: Banners',
        '0x71f7bedf8572b75e446766906079dcf05a386737': 'Mossawrettes'
    };
    return collections[address.toLowerCase()] || 'Unknown';
}

// Event listeners
connectWalletBtn.addEventListener('click', connectWallet);
minimizeNftBtn.addEventListener('click', () => {
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