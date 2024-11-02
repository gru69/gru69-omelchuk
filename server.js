const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const bot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const productName = req.body.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const dir = path.join(__dirname, 'public', 'uploads', productName);
        fs.mkdir(dir, { recursive: true })
            .then(() => cb(null, dir))
            .catch(err => cb(err));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.get('/product/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.redirect('/login.html');
    }
};

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/shop', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'shop.html'));
});

app.get('/collaborations', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'collaborations.html'));
});

app.get('/gallery', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    console.log('Login attempt:', req.body);
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        req.session.isAuthenticated = true;
        console.log('Login successful');
        res.sendStatus(200);
    } else {
        console.log('Login failed');
        res.status(401).send('Invalid credentials');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/login.html');
    });
});

app.get('/admin', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/save-product', isAuthenticated, upload.array('images', 5), async (req, res) => {
    try {
        console.log('Received product data:', req.body);
        console.log('Received files:', req.files);

        const productsPath = path.join(__dirname, 'public', 'products.json');
        let products = [];

        try {
            const productsData = await fs.readFile(productsPath, 'utf-8');
            products = JSON.parse(productsData);
            console.log('Existing products:', products);
        } catch (readError) {
            console.error('Error reading products.json:', readError);
            // If the file doesn't exist or is empty, we'll start with an empty array
        }

        const productId = req.body.id || Date.now().toString();
        const productName = req.body.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const imageFiles = req.files ? req.files.map(file => `${productName}/${file.filename}`) : [];
        const newProduct = {
            id: productId,
            name: req.body.name,
            description: req.body.description,
            price: parseFloat(req.body.price),
            size: req.body.size,
            color: req.body.color,
            images: imageFiles
        };

        console.log('New product object:', newProduct);

        const existingIndex = products.findIndex(p => p.id === productId);
        if (existingIndex !== -1) {
            console.log('Updating existing product');
            products[existingIndex] = newProduct;
        } else {
            console.log('Adding new product');
            products.push(newProduct);
        }

        console.log('Updated products array:', products);

        await fs.writeFile(productsPath, JSON.stringify(products, null, 2));
        console.log('Product saved successfully');
        res.sendStatus(200);
    } catch (error) {
        console.error('Error saving product:', error);
        res.status(500).send(`Error saving product: ${error.message}`);
    }
});

app.delete('/delete-product/:id', isAuthenticated, async (req, res) => {
    try {
        const productId = req.params.id;
        const productsPath = path.join(__dirname, 'public', 'products.json');
        let products = JSON.parse(await fs.readFile(productsPath, 'utf-8'));
        const productToDelete = products.find(p => p.id === productId);
        
        if (productToDelete) {
            // Remove product folder and its contents
            const productFolder = path.join(__dirname, 'public', 'uploads', 
                productToDelete.name.replace(/[^a-z0-9]/gi, '_').toLowerCase());
            try {
                await fs.rm(productFolder, { recursive: true, force: true });
            } catch (error) {
                console.error('Error deleting product folder:', error);
            }
            
            // Update products.json
            products = products.filter(p => p.id !== productId);
            await fs.writeFile(productsPath, JSON.stringify(products, null, 2));
            res.sendStatus(200);
        } else {
            res.status(404).send('Product not found');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).send('Error deleting product');
    }
});

app.get('/collaboration/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'collaboration-product.html'));
});

app.delete('/delete-collaboration/:id', isAuthenticated, async (req, res) => {
    try {
        const collaborationId = req.params.id;
        const collaborationsPath = path.join(__dirname, 'public', 'collaborations.json');
        let collaborations = JSON.parse(await fs.readFile(collaborationsPath, 'utf-8'));
        const collaborationToDelete = collaborations.find(c => c.id === collaborationId);
        
        if (collaborationToDelete) {
            // Remove collaboration folder and its contents
            const collaborationFolder = path.join(__dirname, 'public', 'uploads', 
                collaborationToDelete.name.replace(/[^a-z0-9]/gi, '_').toLowerCase());
            try {
                await fs.rm(collaborationFolder, { recursive: true, force: true });
            } catch (error) {
                console.error('Error deleting collaboration folder:', error);
            }
            
            // Update collaborations.json
            collaborations = collaborations.filter(c => c.id !== collaborationId);
            await fs.writeFile(collaborationsPath, JSON.stringify(collaborations, null, 2));
            res.sendStatus(200);
        } else {
            res.status(404).send('Collaboration not found');
        }
    } catch (error) {
        console.error('Error deleting collaboration:', error);
        res.status(500).send('Error deleting collaboration');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
