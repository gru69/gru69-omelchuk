let allProducts = [];

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    setupFilters();
});

async function loadProducts() {
    try {
        const response = await fetch('/collaborations.json');
        allProducts = await response.json();
        populateFilters();
        displayProducts(allProducts);
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function setupFilters() {
    document.getElementById('size-filter').addEventListener('change', applyFilters);
    document.getElementById('color-filter').addEventListener('change', applyFilters);
    document.getElementById('price-sort').addEventListener('change', applyFilters);
}

function populateFilters() {
    const sizes = new Set();
    const colors = new Set();
    
    allProducts.forEach(product => {
        if (product.size) sizes.add(product.size);
        if (product.color) colors.add(product.color);
    });

    const sizeFilter = document.getElementById('size-filter');
    const colorFilter = document.getElementById('color-filter');

    sizes.forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size;
        sizeFilter.appendChild(option);
    });

    colors.forEach(color => {
        const option = document.createElement('option');
        option.value = color;
        option.textContent = color;
        colorFilter.appendChild(option);
    });
}

function applyFilters() {
    const selectedSize = document.getElementById('size-filter').value;
    const selectedColor = document.getElementById('color-filter').value;
    const priceSort = document.getElementById('price-sort').value;

    let filteredProducts = allProducts.filter(product => {
        const sizeMatch = !selectedSize || product.size === selectedSize;
        const colorMatch = !selectedColor || product.color === selectedColor;
        return sizeMatch && colorMatch;
    });

    if (priceSort === 'low-high') {
        filteredProducts.sort((a, b) => a.price - b.price);
    } else if (priceSort === 'high-low') {
        filteredProducts.sort((a, b) => b.price - a.price);
    }

    displayProducts(filteredProducts);
}

function displayProducts(products) {
    const productGrid = document.getElementById('product-grid');
    productGrid.innerHTML = '';
  
    if (products.length === 0) {
      productGrid.innerHTML = '<p class="no-products">No products match your filters.</p>';
      return;
    }
  
    products.forEach(product => {
      const productDiv = document.createElement('div');
      productDiv.className = 'product-item';
  
      const imagesContainer = document.createElement('div');
      imagesContainer.className = 'product-images';
  
      // Only display the first image (if images exist)
      if (product.images && product.images.length > 0) {
        const firstImage = product.images[0];
        const img = document.createElement('img');
        img.src = `/uploads/${firstImage}`;
        img.alt = product.name;
        img.className = 'product-image';
        imagesContainer.appendChild(img);
      }
  
      const productInfo = document.createElement('div');
      productInfo.className = 'product-info';
      productInfo.innerHTML = `
        <h3 class="product-name">${product.name || 'Unnamed Product'}</h3>
        <p class="collaboration-with">In collaboration with: ${product.collaborator}</p>
        <a href="/collaboration/${product.id}" class="view-product-btn">View Product</a>
      `;
  
      productDiv.appendChild(imagesContainer);
      productDiv.appendChild(productInfo);
      productGrid.appendChild(productDiv);
    });
  }