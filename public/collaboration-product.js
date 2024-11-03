document.addEventListener('DOMContentLoaded', async () => {
    const productId = window.location.pathname.split('/').pop();
    await loadProduct(productId);
});

function collabInsta() {
    let instahandle = document.getElementById("product-collaborator").innerText.slice(1);
    console.log(instahandle);
    window.open("https://www.instagram.com/" + instahandle + "/", '_blank');
}
async function loadProduct(productId) {
    try {
        const response = await fetch('/collaborations.json');
        const products = await response.json();
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            window.location.href = '/collaborations';
            return;
        }

        document.getElementById('product-name').textContent = product.name;
        document.getElementById('product-collaborator').textContent = product.collaborator;
        
        // Create description HTML with proper formatting
        const descriptionHTML = `
            ${product.description}
            ${product.note ? `
            <div class="note">
                * ${product.note}
            </div>` : ''}
        `;
        document.getElementById('product-description').innerHTML = descriptionHTML;
        
        document.getElementById('product-price').textContent = `$${product.price.toFixed(2)}`;
        document.getElementById('product-prepayment').textContent = `$${product.prepayment.toFixed(2)}`;
        document.getElementById('product-delivery').textContent = product.delivery ? 'Included' : 'Not included';
        document.getElementById('product-size').textContent = product.size;
        document.getElementById('product-color').textContent = product.color;

        const imagesContainer = document.getElementById('product-images');
        imagesContainer.innerHTML = '';

        if (product.images && product.images.length > 0) {
            product.images.forEach(image => {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'product-image-container';

                if (image.endsWith('.mp4') || image.endsWith('.mov') || image.endsWith('.webm')) {
                    const video = document.createElement('video');
                    video.className = 'product-media-item';
                    video.controls = true;
                    video.loop = true;
                    video.muted = true;
                    video.src = `/uploads/${image}`;
                    imgContainer.appendChild(video);
                } else {
                    const img = document.createElement('img');
                    img.src = `/uploads/${image}`;
                    img.alt = product.name;
                    img.className = 'product-media-item';
                    img.onclick = () => openFullscreen(img.src);
                    imgContainer.appendChild(img);
                }

                imagesContainer.appendChild(imgContainer);
            });
        }
    } catch (error) {
        console.error('Error loading product:', error);
    }
}

function openFullscreen(src) {
    const fullscreenView = document.createElement('div');
    fullscreenView.className = 'fullscreen-view';
    
    fullscreenView.innerHTML = `
        <div class="fullscreen-content">
            <span class="close-fullscreen">&times;</span>
            <img src="${src}" alt="Fullscreen view" class="fullscreen-image">
        </div>
    `;

    document.body.appendChild(fullscreenView);

    const closeBtn = fullscreenView.querySelector('.close-fullscreen');
    closeBtn.onclick = () => document.body.removeChild(fullscreenView);
    
    fullscreenView.onclick = (e) => {
        if (e.target === fullscreenView) {
            document.body.removeChild(fullscreenView);
        }
    };
} 