import os
import re

tabs = [
    "src/renderer/src/features/catalog/CatalogTab.tsx",
    "src/renderer/src/features/inventory/InventoryTab.tsx",
    "src/renderer/src/features/transactions/TransactionsTab.tsx",
    "src/renderer/src/features/friends/FriendsTab.tsx",
    "src/renderer/src/features/avatar/AvatarTab.tsx",
]

for tab in tabs:
    path = os.path.join("/Users/admin/Downloads/sentra-main", tab)
    if not os.path.exists(path):
        continue
    
    with open(path, "r") as f:
        content = f.read()

    # Pattern to match the Hero Header Bento block in the tsx files
    pattern = re.compile(r'\s*\{\/\* Hero Header Bento \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*', re.MULTILINE)
    
    new_content, count = pattern.subn('\n', content, count=1)
    
    if count > 0:
        print(f"Removed Hero Header Bento from {tab}")
        with open(path, "w") as f:
            f.write(new_content)
    else:
        print(f"Hero Header Bento not found in {tab} via regex")
