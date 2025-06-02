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
const walletStatus = document.getElementById('wallet-status');
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
const SCATTER_API_URL = 'https://api.scatter.art/v1';
const COLLECTION_SLUG = 'sancigawa';
const COLLECTION_ADDRESS = '0xDf821CDa5B4c6143a77c69Fc1d8b270ec37eDAC8';
const CHAIN_ID = 1996;
const TEST_INVITE_LIST_ID = 'si3k3jkwi8h8j8fcspx4ry07';

// ERC20 ABI
const erc20Abi = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }, { name: '_spender', type: 'address' }],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [{ name: '_spender', type: 'address' }, { name: '_value', type: 'uint256' }],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
];

// Wallet connection
async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    console.warn('No wallet detected');
    walletStatus.textContent = 'Please install MetaMask';
    walletStatus.classList.remove('hidden');
    return;
  }
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x7CC' }],
    });
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const walletAddress = accounts[0];
    console.log(`Connected to wallet: ${walletAddress}`);
    walletStatus.textContent = `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    walletStatus.classList.remove('hidden');
    connectWalletBtn.textContent = 'Check NFTs';
    connectWalletBtn.onclick = checkNFTs;
    await fetchInviteLists(walletAddress);
  } catch (error) {
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x7CC',
            chainName: 'Sanko',
            nativeCurrency: { name: 'Sanko Token', symbol: 'SANKO', decimals: 18 },
            rpcUrls: ['https://mainnet.sanko.xyz'],
            blockExplorerUrls: ['https://explorer.sanko.xyz'],
          }],
        });
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const walletAddress = accounts[0];
        console.log(`Connected to wallet: ${walletAddress}`);
        walletStatus.textContent = `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
        walletStatus.classList.remove('hidden');
        connectWalletBtn.textContent = 'Check NFTs';
        connectWalletBtn.onclick = checkNFTs;
        await fetchInviteLists(walletAddress);
      } catch (addError) {
        console.error('Failed to add Sanko chain:', addError);
        walletStatus.textContent = `Error: ${addError.message}`;
        walletStatus.classList.remove('hidden');
      }
    } else {
      console.error('Connection failed:', error);
      walletStatus.textContent = `Error: ${error.message}`;
      walletStatus.classList.remove('hidden');
    }
  }
}

// Fetch invite lists
async function fetchInviteLists(walletAddress) {
  if (!inviteListsEl) {
    console.error('Invite lists container not found.');
    return;
  }
  try {
    inviteListsEl.innerHTML = '<p>Loading invite lists...</p>';
    const response = await fetch(
      `${SCATTER_API_URL}/collection/${COLLECTION_SLUG}/eligible-invite-lists?minterAddress=${encodeURIComponent(walletAddress)}`
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch invite lists');
    }
    const lists = await response.json();
    inviteListsEl.innerHTML = '';
    if (lists.length === 0) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>Test List</h3>
        <p>Price: FREE</p>
        <p>Wallet Limit: 3</p>
        <p>List Limit: 3</p>
        <button class="mint-button">Mint</button>
      `;
      inviteListsEl.appendChild(card);
      const mintButton = card.querySelector('.mint-button');
      mintButton.addEventListener('click', () => mintNFT(TEST_INVITE_LIST_ID));
      return;
    }
    lists.forEach(list => {
      const card = document.createElement('div');
      card.className = 'card';
      const price = list.token_price === '0' ? 'FREE' : `${list.token_price} ${list.currency_symbol}`;
      card.innerHTML = `
        <h3>${list.name}</h3>
        <p>Price: ${price}</p>
        <p>Wallet Limit: ${list.wallet_limit}</p>
        <p>List Limit: ${list.list_limit}</p>
        <button class="mint-button">Mint</button>
      `;
      inviteListsEl.appendChild(card);
      const mintButton = card.querySelector('.mint-button');
      mintButton.addEventListener('click', () => mintNFT(list.id));
    });
  } catch (error) {
    console.error('Fetch invite lists failed:', error);
    walletStatus.textContent = `Error: ${error.message}`;
    walletStatus.classList.remove('hidden');
    inviteListsEl.innerHTML = '';
  }
}

// Mint NFT
async function mintNFT(listId) {
  try {
    const mintButton = document.querySelector('.mint-button');
    mintButton.disabled = true;
    mintButton.textContent = 'Minting...';
    walletStatus.textContent = 'Minting in progress...';
    walletStatus.classList.remove('hidden');

    const address = window.ethereum?.selectedAddress;
    if (!address) throw new Error('Please connect your wallet');

    const response = await fetch(`${SCATTER_API_URL}/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectionAddress: COLLECTION_ADDRESS,
        chainId: CHAIN_ID,
        minterAddress: address,
        lists: [{ id: listId, quantity: 1 }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Mint request failed');
    }

    const { mintTransaction, erc20s } = await response.json();

    for (const erc20 of erc20s || []) {
      const web3 = new Web3(window.ethereum);
      const erc20Contract = new web3.eth.Contract(erc20Abi, erc20.address);
      const allowance = await erc20Contract.methods.allowance(address, COLLECTION_ADDRESS).call();
      if (BigInt(allowance) < BigInt(erc20.amount)) {
        await erc20Contract.methods.approve(COLLECTION_ADDRESS, '0x' + BigInt(2**256 - 1).toString(16)).send({ from: address });
      }
    }

    const tx = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: address,
        to: mintTransaction.to,
        value: mintTransaction.value,
        data: mintTransaction.data,
      }],
    });

    console.log('Minted:', tx);
    walletStatus.textContent = `NFT minted successfully! Tx: ${tx.slice(0, 6)}...${tx.slice(-4)}`;
    walletStatus.classList.remove('hidden');
  } catch (error) {
    console.error('Minting failed:', error);
    walletStatus.textContent = `Minting failed: ${error.message}`;
    walletStatus.classList.remove('hidden');
  } finally {
    const mintButton = document.querySelector('.mint-button');
    mintButton.disabled = false;
    mintButton.textContent = 'Mint';
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
      const response = await fetch(
        `${SCATTER_API_URL}/collection/${encodeURIComponent(collection.slug)}/nfts?ownerAddress=${encodeURIComponent(owner)}&pageSize=100`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json();
      const collectionNfts = data.nfts.map(nft => ({
        contractAddress: collection.address,
        tokenId: nft.token_id.toString(),
        imageUrl: nft.image,
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
    console.error('NFT display elements not found.');
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
  nftOverlay.classList.remove('hidden');
}

// Event listeners
connectWalletBtn.addEventListener('click', connectWallet);
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
  iframeEmbed.addEventListener('error', () => iframeFallback.classList.remove('hidden'), { once: true });
  setTimeout(() => {
    if (!iframeEmbed.contentWindow) iframeFallback.classList.remove('hidden');
  }, 5000);
});
minimizeIframeBtn.addEventListener('click', () => {
  iframeOverlay.classList.add('hidden');
  iframeFallback.classList.add('hidden');
});
stationThisBotBtn.addEventListener('click', () => window.open('https://x.com/stationthisbot', '_blank'));
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
imageModal.addEventListener('click', (e) => {
  if (e.target === imageModal) {
    imageModal.classList.add('hidden');
    modalImage.src = '';
  }
});