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
    apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjFhZGY2OGE4LTk1MjMtNGE3NC1iNWI1LTMzNTQ0MGZhNjE5NiIsIm9yZ0lkIjoiNDUwMTQyIiwidXNlcklkIjoiNDYzMTU1IiwidHlwZUlkIjoiNDcyYWQxZWQtMDBlMi00M2RiLWI4MjAtMTI0NGE1NzdlMjg0IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDg2MzgwNDgsImV4cCI6NDkwNDM5ODA0OH0.Syr_w9VIl7ozDwIOLoQFA74qlgqP4t14WBvXORwsjfY'
});

// ERC-721 ABI (standard JSON format with Transfer event)
const erc721Abi = [
    {
        "constant": true,
        "inputs": [
            {
                "name": "owner",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "owner",
                "type": "address"
            },
            {
                "name": "index",
                "type": "uint256"
            }
        ],
        "name": "tokenOfOwnerByIndex",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "tokenURI",
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "ownerOf",
        "outputs": [
            {
                "name": "",
                "type": "address"
            }
        ],
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "name": "from", "type": "address" },
            { "indexed": true, "name": "to", "type": "address" },
            { "indexed": true, "name": "tokenId", "type": "uint256" }
        ],
        "name": "Transfer",
        "type": "event"
    }
];

// Sanko chain config
const sankoRpc = 'https://mainnet.sanko.xyz';
const sankoContracts = [
    '0x8e718b4aFe2ad12345c5a327e3c2cB7645026BB2', // MossNet
    '0x9275Bf0a32ae3c9227065f998Ac0B392FB9f0BFe'  // MossNet: Banners
];

// IPFS gateways supporting CORS
const ipfsGateways = [
    'https://nftstorage.link/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.io/ipfs/' // Fallback, may have CORS issues
];

// Wallet connection
async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const web3 = new Web3(window.ethereum);
            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
            const address = accounts[0];
            walletAddressEl.textContent = `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`;
            walletAddressEl.classList.remove('hidden');
            connectWalletBtn.textContent = 'Check NFTs';
            connectWalletBtn.onclick = checkNFTs;

            // Check current chain
            const chainId = await web3.eth.getChainId();
            if (chainId !== 1996) {
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
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x7CC' }]
        });
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x7CC', // 1996
                        chainName: 'Sanko Mainnet',
                        rpcUrls: [sankoRpc],
                        nativeCurrency: { name: 'Dream Machine Token', symbol: 'DMT', decimals: 18 },
                        blockExplorerUrls: ['https://explorer.sanko.xyz']
                    }]
                });
            } catch (addError) {
                console.error('Failed to add Sanko chain:', addError);
                walletAddressEl.textContent = 'Please switch to Sanko chain (ID: 1996) manually.';
                walletAddressEl.classList.remove('hidden');
            }
        } else {
            console.error('Failed to switch to Sanko chain:', switchError);
            walletAddressEl.textContent = 'Please switch to Sanko chain (ID: 1996) manually.';
            walletAddressEl.classList.remove('hidden');
        }
    }
}

// Fetch metadata with fallback gateways
async function fetchMetadata(fetchUrl, contractAddress, tokenId) {
    for (const gateway of ipfsGateways) {
        const url = fetchUrl.replace('ipfs://', gateway);
        try {
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            const metadata = await response.json();
            console.log(`Metadata for ${contractAddress}, token ${tokenId} via ${gateway}:`, metadata);
            return metadata;
        } catch (error) {
            console.warn(`Failed to fetch metadata for ${contractAddress}, token ${tokenId} via ${gateway}:`, error);
        }
    }
    console.error(`All gateways failed for ${contractAddress}, token ${tokenId}`);
    return {};
}

// Check NFTs
async function checkNFTs() {
    try {
        const web3 = new Web3(window.ethereum);
        const accounts = await web3.eth.getAccounts();
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

        // Ethereum NFTs (chain ID: 1) via Moralis
        try {
            const ethNfts = await Moralis.EvmApi.nft.getWalletNFTs({
                chain: '0x1',
                address: accounts[0],
                tokenAddresses: ['0x71f7bedf8572b75e446766906079dcf05a386737']
            });
            nfts = nfts.concat(ethNfts.raw.result);
        } catch (ethError) {
            console.error('Ethereum NFT fetch failed:', ethError);
        }

        // Sanko NFTs via Custom RPC
        const sankoWeb3 = new Web3(sankoRpc);
        for (const contractAddress of sankoContracts) {
            try {
                const contract = new sankoWeb3.eth.Contract(erc721Abi, contractAddress);
                let tokenIds = [];

                // Standard balanceOf and tokenOfOwnerByIndex
                try {
                    console.log(`Fetching balance for ${contractAddress}, owner: ${accounts[0]}`);
                    const balance = await contract.methods.balanceOf(accounts[0]).call();
                    console.log(`Balance for ${contractAddress}: ${balance}`);
                    if (contractAddress.toLowerCase() !== '0x9275bf0a32ae3c9227065f998ac0b392fb9f0bfe') {
                        for (let i = 0; i < balance; i++) {
                            try {
                                const tokenId = await contract.methods.tokenOfOwnerByIndex(accounts[0], i).call();
                                tokenIds.push(tokenId.toString());
                            } catch (indexError) {
                                console.warn(`tokenOfOwnerByIndex failed for ${contractAddress}, index ${i}:`, indexError);
                            }
                        }
                    } else {
                        // Fallback for MossNet: Banners (0x9275Bf0...)
                        if (balance > 0) {
                            console.log(`Attempting token ID enumeration for ${contractAddress}`);
                            try {
                                // Query Transfer events
                                const events = await contract.getPastEvents('Transfer', {
                                    filter: { to: accounts[0] },
                                    fromBlock: 0,
                                    toBlock: 'latest'
                                });
                                const tokenIdsSet = new Set();
                                for (const event of events) {
                                    const tokenId = event.returnValues.tokenId;
                                    try {
                                        const owner = await contract.methods.ownerOf(tokenId).call();
                                        if (owner.toLowerCase() === accounts[0].toLowerCase()) {
                                            tokenIdsSet.add(tokenId.toString());
                                        }
                                    } catch (ownerError) {
                                        console.warn(`ownerOf failed for token ${tokenId}:`, ownerError);
                                    }
                                }
                                tokenIds = Array.from(tokenIdsSet);
                                console.log(`Found token IDs for ${contractAddress}:`, tokenIds);
                            } catch (eventError) {
                                console.error(`Event-based enumeration failed for ${contractAddress}:`, eventError);
                            }
                        }
                    }
                } catch (balanceError) {
                    console.warn(`balanceOf failed for ${contractAddress}:`, balanceError);
                }

                // Process token IDs
                for (const tokenId of tokenIds) {
                    let tokenURI = '';
                    try {
                        tokenURI = await contract.methods.tokenURI(tokenId).call();
                        console.log(`TokenURI for ${contractAddress}, token ${tokenId}:`, tokenURI);
                    } catch (uriError) {
                        console.warn(`Failed to fetch tokenURI for ${contractAddress}, token ${tokenId}:`, uriError);
                    }
                    let metadata = {};
                    if (tokenURI) {
                        if (tokenURI.startsWith('ipfs://')) {
                            metadata = await fetchMetadata(tokenURI, contractAddress, tokenId);
                        } else if (tokenURI.startsWith('http')) {
                            try {
                                const response = await fetch(tokenURI, { mode: 'cors' });
                                if (!response.ok) {
                                    throw new Error(`HTTP error ${response.status}`);
                                }
                                metadata = await response.json();
                                console.log(`Metadata for ${contractAddress}, token ${tokenId}:`, metadata);
                            } catch (fetchError) {
                                console.error(`Failed to fetch metadata for ${contractAddress}, token ${tokenId}:`, fetchError);
                            }
                        } else {
                            console.warn(`Invalid tokenURI for ${contractAddress}, token ${tokenId}: ${tokenURI}`);
                        }
                    }
                    const name = metadata.name || `Token #${tokenId}`;
                    let image = metadata.image || 'assets/placeholder.png';
                    if (image.startsWith('ipfs://')) {
                        image = image.replace('ipfs://', ipfsGateways[0]);
                    }
                    const collection = getCollectionName(contractAddress);
                    nfts.push({
                        token_id: tokenId,
                        token_address: contractAddress,
                        metadata: JSON.stringify(metadata),
                        name,
                        image,
                        collection
                    });
                }
            } catch (contractError) {
                console.error(`Failed to fetch NFTs for contract ${contractAddress}:`, contractError);
            }
        }

        if (nfts.length === 0) {
            nftEmpty.textContent = 'No NFTs found from these collections.';
            nftEmpty.classList.add('hidden');
        } else {
            nfts.forEach(nft => {
                const nftItem = document.createElement('div');
                nftItem.className = 'nft-item';
                nftItem.innerHTML = `
                    <img src="${nft.image}" alt="${nft.name}" onerror="this.src='assets/placeholder.png'">
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
        nftEmpty.textContent = 'Failed to load NFTs. Try again.';
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