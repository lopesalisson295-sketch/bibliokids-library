from PIL import Image

def remove_background(image_path, output_path):
    img = Image.open(image_path).convert('RGBA')
    data = img.getdata()
    new_data = []
    
    # Tolerância para o branco
    threshold = 230
    
    for item in data:
        # Check if pixel is white or near-white
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            # Change to transparent
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(output_path, 'PNG')

if __name__ == '__main__':
    remove_background('public/images/logo-unifor.png', 'public/images/logo-unifor-transparent.png')
