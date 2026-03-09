import sys

with open("src/pages/Acervo.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

with open("new_fetch.tsx", "r", encoding="utf-8") as f:
    new_content = f.read()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "const fetchBookByIsbn = async (isbnToFetch" in line:
        start_idx = i
        break

if start_idx != -1:
    for i in range(start_idx, len(lines)):
        if "const handleDelete = async" in lines[i]:
            end_idx = i - 1
            break

if start_idx != -1 and end_idx != -1:
    del lines[start_idx:end_idx]
    lines.insert(start_idx, new_content + "\n")
    with open("src/pages/Acervo.tsx", "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("Success")
else:
    print(f"Error finding indices: start={start_idx}, end={end_idx}")
