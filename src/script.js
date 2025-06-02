const SCATTER_API_URL = 'https://api.scatter.art/v1';
const COLLECTION_SLUG = 'sancigawa';
const COLLECTION_ADDRESS = '0xDf821CDa5B4c6143a77c69Fc1d8b270ec37eDAC8';
const CHAIN_ID = 1996;
const TEST_INVITE_LIST_ID = 'si3k3jkwi8h8j8fcspx4ry07';

const connectButton = document.getElementById('connectButton');
const inviteListsDiv = document.getElementById('inviteLists');
const status = document.getElementById('status');

async function connectWallet() {
  try {
    if (!window.ethereum) throw new Error('MetaMask is not installed');
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x7CC' }],
    });
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const address = accounts[0];
    status.textContent = `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`;
    status.className = 'success';
    await fetchInviteLists(address);
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
        const address = accounts[0];
        status.textContent = `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`;
        status.className = 'success';
        await fetchInviteLists(address);
      } catch (addError) {
        console.error('Failed to add Sanko chain:', addError);
        status.textContent = `Error: ${addError.message}`;
        status.className = 'error';
      }
    } else {
      console.error('Connection failed:', error);
      status.textContent = `Error: ${error.message}`;
      status.className = 'error';
    }
  }
}

async function fetchInviteLists(address) {
  try {
    inviteListsDiv.innerHTML = '<p>Loading invite lists...</p>';
    const response = await fetch(
      `${SCATTER_API_URL}/collection/${COLLECTION_SLUG}/eligible-invite-lists?minterAddress=${encodeURIComponent(address)}`
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch invite lists');
    }
    const lists = await response.json();
    inviteListsDiv.innerHTML = '';
    if (lists.length === 0) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>Test List</h3>
        <p>Price: FREE</p>
        <p>Wallet Limit: 3</p>
        <p>List Limit: 3</p>
        <button onclick="mintNFT('${TEST_INVITE_LIST_ID}')" id="mintButton">Mint</button>
      `;
      inviteListsDiv.appendChild(card);
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
        <button onclick="mintNFT('${list.id}')" id="mintButton">Mint</button>
      `;
      inviteListsDiv.appendChild(card);
    });
  } catch (error) {
    console.error('Fetch invite lists failed:', error);
    status.textContent = `Error: ${error.message}`;
    status.className = 'error';
    inviteListsDiv.innerHTML = '';
  }
}

async function mintNFT(listId) {
  try {
    const mintButton = document.getElementById('mintButton');
    mintButton.disabled = true;
    mintButton.textContent = 'Minting...';
    status.textContent = 'Minting in progress...';
    status.className = '';

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

    const { mintTransaction } = await response.json();
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
    status.textContent = `NFT minted successfully! Tx: ${tx.slice(0, 6)}...${tx.slice(-4)}`;
    status.className = 'success';
  } catch (error) {
    console.error('Minting failed:', error);
    status.textContent = `Minting failed: ${error.message}`;
    status.className = 'error';
  } finally {
    const mintButton = document.getElementById('mintButton');
    mintButton.disabled = false;
    mintButton.textContent = 'Mint';
  }
}

connectButton.addEventListener('click', connectWallet);