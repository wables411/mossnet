import json
import os

# Path to the folder containing the JSON files
FOLDER_PATH = "/Users/wables/mossmossmoss-website/assets/nft-metadata"

# Ensure the folder exists
if not os.path.exists(FOLDER_PATH):
    print(f"Folder {FOLDER_PATH} does not exist. Please check the path.")
    exit()

# Loop through files 1 to 100
for i in range(1, 101):
    file_name = str(i)  # Files are named "1", "2", ..., "100" (no .json extension)
    file_path = os.path.join(FOLDER_PATH, file_name)
    
    # Check if the file exists
    if not os.path.exists(file_path):
        print(f"File {file_name} not found. Skipping...")
        continue
    
    try:
        # Read the JSON file
        with open(file_path, "r", encoding="utf-8") as file:
            data = json.load(file)
        
        # Update the name field
        old_name = data.get("name", "")
        if "Cigsuiga" in old_name:
            new_name = old_name.replace("Cigsuiga", "sancigawa")
            data["name"] = new_name
        else:
            print(f"File {file_name}: 'Cigsuiga' not found in name '{old_name}'. Skipping update.")
            continue
        
        # Save the updated JSON file
        with open(file_path, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=4)
        
        print(f"Updated file {file_name}: Name changed to '{new_name}'")
    
    except json.JSONDecodeError:
        print(f"File {file_name}: Invalid JSON format. Skipping...")
    except Exception as e:
        print(f"File {file_name}: Error - {str(e)}. Skipping...")

print("Metadata update complete.")