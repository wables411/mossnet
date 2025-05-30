import json
import os

# Configuration
IMAGE_FOLDER = 'assets/nft-images'  # Folder with NFT images (e.g., 1.png to 100.png)
OUTPUT_FOLDER = 'assets/nft-metadata'  # Where to save metadata JSON files
BASE_URI = 'ipfs://QmcwcnXngcMxKnkPu1pAacFVsVCYBvatBdPLP9w2FtR4Wa/'  # Images CID
COLLECTION_NAME = 'Cigsuiga'
DESCRIPTION = 'A collection of paintings of memories of adventures with friends.'
WEBSITE_URL = 'https://mossmossmoss.quest'  # Website link

# Ensure output folder exists
if not os.path.exists(OUTPUT_FOLDER):
    os.makedirs(OUTPUT_FOLDER)

# Generate metadata for each image
for filename in os.listdir(IMAGE_FOLDER):
    if filename.endswith(('.png', '.jpg', '.jpeg', '.gif')):
        token_id = filename.split('.')[0]  # e.g., '1' from '1.png'
        metadata = {
            'name': f'{COLLECTION_NAME} #{token_id}',
            'description': DESCRIPTION,
            'image': f'{BASE_URI}{filename}',
            'external_url': WEBSITE_URL,  # Added website link
            'attributes': [
                {'trait_type': 'Rest in Peace', 'value': 'Pappachaga'},
                {'trait_type': 'Made With', 'value': '@stationthisbot'},
                {'trait_type': 'With the Help of', 'value': 'cigbot.meme'}
            ]
        }
        # Save metadata as JSON
        with open(f'{OUTPUT_FOLDER}/{token_id}.json', 'w') as f:
            json.dump(metadata, f, indent=4)
        print(f'Generated metadata for {filename}')