document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    loadProducts();
    loadCollections();
    loadCollaborations();
    setupEventListeners();
});

function setupTabs() {
    const tabs = document.querySelectorAll('.nav-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.admin-section').forEach(content => content.classList.remove('active'));
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

function setupEventListeners() {
    document.getElementById('add-product-btn').addEventListener('click', () => openModal('product'));
    document.getElementById('add-collection-btn').addEventListener('click', () => openModal('collection'));
    document.getElementById('add-collaboration-btn').addEventListener('click', () => openModal('collaboration'));
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('item-form').addEventListener('submit', handleSubmit);
}

async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        renderList(products, 'product-list', 'product');
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

async function loadCollections() {
    try {
        const response = await fetch('/api/collections');
        const collections = await response.json();
        renderList(collections, 'collection-list', 'collection');
    } catch (error) {
        console.error('Error loading collections:', error);
    }
}

async function loadCollaborations() {
    try {
        const response = await fetch('/api/collaborations');
        const collaborations = await response.json();
        renderList(collaborations, 'collaboration-list', 'collaboration');
    } catch (error) {
        console.error('Error loading collaborations:', error);
    }
}

function renderList(items, listId, type) {
    const list = document.getElementById(listId);
    list.innerHTML = '';
    items.forEach(item => {
        const li = document.createElement('div');
        li.classList.add('admin-item');
        li.innerHTML = `
            <img src="${item.images ? item.images[0] : (item.image || 'placeholder.jpg')}" alt="${item.name || item.title}" class="admin-item-preview">
            <h3>${item.name || item.title}</h3>
            <p>${item.description || ''}</p>
            <div class="admin-item-actions">
                <button onclick="editItem('${type}', ${item.id})"><i class="fas fa-edit"></i></button>
                <button onclick="deleteItem('${type}', ${item.id})"><i class="fas fa-trash"></i></button>
            </div>
        `;
        list.appendChild(li);
    });
}

function openModal(type, id = null) {
    const modal = document.getElementById('modal');
    const form = document.getElementById('item-form');
    const title = document.getElementById('modal-title');

    form.innerHTML = '';
    title.textContent = id ? `Edit ${type}` : `Add New ${type}`;

    // Add form fields based on the type
    if (type === 'product') {
        form.innerHTML = `
            <input type="hidden" name="type" value="product">
            <input type="hidden" name="id" value="${id || ''}">
            <input type="text" name="name" placeholder="Product Name" required>
            <input type="number" name="price" placeholder="Price" step="0.01" required>
            <input type="text" name="size" placeholder="Size" required>
            <input type="text" name="color" placeholder="Color" required>
            <textarea name="description" placeholder="Description" required></textarea>
            <input type="file" name="images" multiple accept="image/*">
        `;
    } else if (type === 'collection') {
        form.innerHTML = `
            <input type="hidden" name="type" value="collection">
            <input type="hidden" name="id" value="${id || ''}">
            <input type="text" name="name" placeholder="Collection Name" required>
            <textarea name="description" placeholder="Description" required></textarea>
            <input type="file" name="image" accept="image/*">
        `;
    } else if (type === 'collaboration') {
        form.innerHTML = `
            <input type="hidden" name="type" value="collaboration">
            <input type="hidden" name="id" value="${id || ''}">
            <input type="text" name="title" placeholder="Collaboration Title" required>
            <textarea name="description" placeholder="Description" required></textarea>
            <input type="url" name="link" placeholder="Link (optional)">
        `;
    }

    form.innerHTML += '<button type="submit">Save</button>';

    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const type = formData.get('type');
    const id = formData.get('id');
    const url = id ? `/api/${type}s/${id}` : `/api/${type}s`;
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            body: formData
        });
        if (response.ok) {
            closeModal();
            if (type === 'product') loadProducts();
            else if (type === 'collection') loadCollections();
            else if (type === 'collaboration') loadCollaborations();
            alert(`${type} saved successfully`);
        } else {
            const errorData = await response.json();
            alert(`Error saving ${type}: ${errorData.message}`);
        }
    } catch (error) {
        console.error(`Error saving ${type}:`, error);
        alert(`Error saving ${type}. Please try again.`);
    }
}

window.editItem = function(type, id) {
    openModal(type, id);
};

window.deleteItem = async function(type, id) {
    if (confirm(`Are you sure you want to delete this ${type}?`)) {
        try {
            const response = await fetch(`/api/${type}s/${id}`, { method: 'DELETE' });
            if (response.ok) {
                alert(`${type} deleted successfully`);
                if (type === 'product') loadProducts();
                else if (type === 'collection') loadCollections();
                else if (type === 'collaboration') loadCollaborations();
            } else {
                const errorData = await response.json();
                alert(`Error deleting ${type}: ${errorData.message}`);
            }
        } catch (error) {
            console.error(`Error deleting ${type}:`, error);
            alert(`Error deleting ${type}. Please try again.`);
        }
    }
};
