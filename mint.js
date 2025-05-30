// Wagmi configuration for Sanko chain
const config = window.wagmi.createConfig({
    chains: [{
        id: 1996,
        name: 'Sanko',
        network: 'sanko',
        nativeCurrency: { name: 'Dream', symbol: 'DMT', decimals: 18 },
        rpcUrls: { default: { http: ['https://mainnet.sanko.xyz'] } },
        blockExplorers: { default: { name: 'Sanko Explorer', url: 'https://explorer.sanko.xyz' } }
    }],
    connectors: [window.wagmi.metaMaskConnector()]
});

// Scatter API settings
const SCATTER_API_KEY = 'YOUR_SCATTER_API_KEY'; // Replace with your Scatter API key
const COLLECTION_SLUG = 'cigsuiga'; // Your collection slug
const COLLECTION_ADDRESS = 'YOUR_COLLECTION_ADDRESS'; // Replace with your collection address
const CHAIN_ID = 1996; // Sanko chain
const API_BASE_URL = 'https://api.scatter.art/v1'; // From Scatter API reference

// DOM elements
const connectWalletBtn = document.getElementById('connect-wallet');
const mintNftBtn = document.getElementById('mint-nft');
const mintStatus = document.getElementById('mint-status');

// Fetch eligible invite lists
async function getEligibleInviteLists({ collectionSlug, walletAddress }) {
    const url = walletAddress
        ? `${API_BASE_URL}/collection/${collectionSlug}/eligible-invite-lists?walletAddress=${walletAddress}`
        : `${API_BASE_URL}/collection/${collectionSlug}/eligible-invite-lists`;
    const response = await fetch(url, {
        headers: { 'x-api-key': SCATTER_API_KEY }
    });
    if (!response.ok) throw new Error(`Failed to fetch invite lists: ${response.statusText}`);
    return await response.json();
}

// Get mint transaction
async function getMintTransaction({ collectionAddress, chainId, minterAddress, lists }) {
    const response = await fetch(`${API_BASE_URL}/mint`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': SCATTER_API_KEY
        },
        body: JSON.stringify({
            collectionAddress,
            chainId,
            minterAddress,
            lists
        })
    });
    if (!response.ok) throw new Error(`Failed to get mint transaction: ${response.statusText}`);
    return await response.json();
}

// Approve ERC20 tokens if needed
async function approveErc20s({ collectionAddress, chainId, erc20s, minterAddress }) {
    for (const erc20 of erc20s) {
        const allowance = await window.wagmi.readContract({
            abi: [
                {
                    name: 'allowance',
                    type: 'function',
                    inputs: [
                        { type: 'address', name: 'owner' },
                        { type: 'address', name: 'spender' }
                    ],
                    outputs: [{ type: 'uint256' }],
                    stateMutability: 'view'
                }
            ],
            address: erc20.address,
            functionName: 'allowance',
            chainId,
            args: [minterAddress, collectionAddress]
        });
        if (allowance < BigInt(erc20.amount)) {
            await window.wagmi.writeContract({
                abi: [
                    {
                        name: 'approve',
                        type: 'function',
                        inputs: [
                            { type: 'address', name: 'spender' },
                            { type: 'uint256', name: 'amount' }
                        ],
                        outputs: [{ type: 'bool' }],
                        stateMutability: 'nonpayable'
                    }
                ],
                address: erc20.address,
                functionName: 'approve',
                chainId,
                args: [collectionAddress, window.viem.maxUint256]
            });
        }
    }
}

// Connect wallet and enable minting
connectWalletBtn.addEventListener('click', async () => {
    try {
        const accounts = await window.wagmi.connect({
            connector: window.wagmi.metaMaskConnector()
        });
        const minterAddress = accounts[0].address;
        connectWalletBtn.textContent = `Connected: ${minterAddress.slice(0, 6)}...`;
        connectWalletBtn.disabled = true;

        mintStatus.textContent = 'Checking eligible mints...';
        const inviteLists = await getEligibleInviteLists({
            collectionSlug: COLLECTION_SLUG,
            walletAddress: minterAddress
        });

        if (inviteLists.length > 0) {
            mintNftBtn.disabled = false;
            mintStatus.textContent = `Eligible to mint from ${inviteLists[0].name}`;
            mintNftBtn.dataset.inviteListId = inviteLists[0].id;
        } else {
            mintStatus.textContent = 'No eligible mints found.';
        }
    } catch (error) {
        mintStatus.textContent = `Error: ${error.message}`;
    }
});

// Mint NFT
mintNftBtn.addEventListener('click', async () => {
    try {
        const minterAddress = (await window.wagmi.getAccount()).address;
        const inviteListId = mintNftBtn.dataset.inviteListId;
        mintStatus.textContent = 'Generating mint transaction...';

        const response = await getMintTransaction({
            collectionAddress: COLLECTION_ADDRESS,
            chainId: CHAIN_ID,
            minterAddress,
            lists: [{ id: inviteListId, quantity: 1 }]
        });

        if (response.erc20s && response.erc20s.length > 0) {
            mintStatus.textContent = 'Approving tokens...';
            await approveErc20s({
                collectionAddress: COLLECTION_ADDRESS,
                chainId: CHAIN_ID,
                erc20s: response.erc20s,
                minterAddress
            });
        }

        mintStatus.textContent = 'Sending mint transaction...';
        const { to, value, data } = response.mintTransaction;
        const txHash = await window.wagmi.sendTransaction({
            to,
            value: BigInt(value || 0),
            data,
            chainId: CHAIN_ID
        });

        mintStatus.textContent = `NFT minted! Tx: ${txHash}`;
        mintNftBtn.disabled = true;
    } catch (error) {
        mintStatus.textContent = `Error: ${error.message}`;
    }
});