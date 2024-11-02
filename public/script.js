let products = [];
let currentProduct = null;
let currentImageIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.pathname === '/shop') {
        await loadProducts();
        setupEventListeners();
    }
});

async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        products = await response.json();
        renderProducts(products);
        populateFilters();
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function renderProducts(productsToRender) {
    const productGrid = document.getElementById('product-grid');
    productGrid.innerHTML = '';

    productsToRender.forEach(product => {
        const productElement = document.createElement('div');
        productElement.classList.add('product');
        productElement.innerHTML = `
            <div class="product-image-container">
                <img src="${product.images[0]}" alt="${product.name}">
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="price">$${product.price.toFixed(2)}</p>
                <button onclick="viewProductDetails(${product.id})">View Details</button>
            </div>
        `;
        productGrid.appendChild(productElement);
    });
}

function populateFilters() {
    const modelFilter = document.getElementById('model-filter');
    const colorFilter = document.getElementById('color-filter');
    const models = [...new Set(products.map(p => p.size))];
    const colors = [...new Set(products.map(p => p.color))];

    modelFilter.innerHTML = '<option value="">All Models</option>';
    colorFilter.innerHTML = '<option value="">All Colors</option>';

    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelFilter.appendChild(option);
    });

    colors.forEach(color => {
        const option = document.createElement('option');
        option.value = color;
        option.textContent = color;
        colorFilter.appendChild(option);
    });
}

function setupEventListeners() {
    document.getElementById('model-filter').addEventListener('change', applyFiltersAndSort);
    document.getElementById('color-filter').addEventListener('change', applyFiltersAndSort);
    document.getElementById('sort-options').addEventListener('change', applyFiltersAndSort);

    document.querySelector('.close').addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === document.getElementById('productModal')) {
            closeModal();
        }
    });
}

function applyFiltersAndSort() {
    let filteredProducts = [...products];

    const modelFilter = document.getElementById('model-filter').value;
    const colorFilter = document.getElementById('color-filter').value;
    const searchInput = document.getElementById('search-input').value.toLowerCase();

    if (modelFilter) {
        filteredProducts = filteredProducts.filter(p => p.size === modelFilter);
    }
    if (colorFilter) {
        filteredProducts = filteredProducts.filter(p => p.color === colorFilter);
    }
    if (searchInput) {
        filteredProducts = filteredProducts.filter(p => 
            p.name.toLowerCase().includes(searchInput) || 
            p.description.toLowerCase().includes(searchInput)
        );
    }

    const sortOption = document.getElementById('sort-options').value;
    switch (sortOption) {
        case 'high-to-low':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        case 'low-to-high':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'newest':
            filteredProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
    }

    renderProducts(filteredProducts);
}

function viewProductDetails(productId) {
    currentProduct = products.find(p => p.id === productId);
    if (currentProduct) {
        currentImageIndex = 0;
        updateProductModal();
        document.getElementById('productModal').style.display = 'block';
    }
}

function updateProductModal() {
    document.getElementById('mainImage').src = currentProduct.images[currentImageIndex];
    document.getElementById('productName').textContent = currentProduct.name;
    document.getElementById('productPrice').textContent = `$${currentProduct.price}`;
    document.getElementById('productSize').textContent = currentProduct.size;
    document.getElementById('productColor').textContent = currentProduct.color;
    document.getElementById('productDescription').textContent = currentProduct.description;
}

function changeImage(direction) {
    currentImageIndex += direction;
    if (currentImageIndex < 0) {
        currentImageIndex = currentProduct.images.length - 1;
    } else if (currentImageIndex >= currentProduct.images.length) {
        currentImageIndex = 0;
    }
    document.getElementById('mainImage').src = currentProduct.images[currentImageIndex];
}

function closeModal() {
    document.getElementById('productModal').style.display = 'none';
}
