require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const https = require('https');

// Use environment variable for token
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set in environment variables');
    process.exit(1);
}

// Modified bot configuration to use HTTPS
const bot = new TelegramBot(token, {
    polling: true,
    request: {
        agentOptions: {
            keepAlive: true,
            family: 4  // Force IPv4
        }
    },
    baseApiUrl: "https://api.telegram.org",
    filepath: false
});

// Add connection status tracking
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Store product data temporarily while user is adding a product
const productDrafts = new Map();

// Error handling
bot.on('error', (error) => {
    console.log('Bot error:', error.code);
    if (!isConnected && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(() => {
            bot.startPolling();
        }, 5000);
    }
});

bot.on('polling_error', (error) => {
    console.log('Polling error:', error.code);
    isConnected = false;
});

// Test connection on start
async function testConnection() {
    try {
        const me = await bot.getMe();
        console.log('Bot connected successfully:', me.username);
        isConnected = true;
        reconnectAttempts = 0;
    } catch (error) {
        console.error('Connection test failed:', error.code);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            setTimeout(testConnection, 5000);
        }
    }
}

// Initialize bot
async function initBot() {
    try {
        await bot.deleteWebHook();
        console.log('Bot started successfully');
    } catch (error) {
        console.error('Error starting bot:', error);
    }
}

// Command handlers
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        'Welcome to Omelchuk Atelier Product Manager!\n\n' +
        'Commands:\n' +
        '/addproduct - Start adding a new product\n' +
        '/listproducts - List all products\n' +
        '/deleteproduct - Delete a product\n' +
        '/deletecollaboration  - Delete a collaboration product\n' +
        '/addcollaboration - Start adding a new collaboration product'
    );
});

bot.onText(/\/addproduct/, (msg) => {
    const chatId = msg.chat.id;
    productDrafts.set(chatId, {});
    bot.sendMessage(chatId, 'Please send the product name:');
});

bot.onText(/\/listproducts/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const products = JSON.parse(await fsPromises.readFile(path.join(__dirname, 'public', 'products.json'), 'utf-8'));
        let message = 'Products:\n\n';
        products.forEach(product => {
            message += `${product.name}\n`;
            message += `Price: $${product.price}\n`;
            message += `Prepayment: $${product.prepayment}\n`;
            message += `Delivery: ${product.delivery ? 'Included' : 'Not included'}\n\n`;
        });
        bot.sendMessage(chatId, message);
    } catch (error) {
        bot.sendMessage(chatId, 'Error loading products');
    }
});

bot.onText(/\/deleteproduct/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const products = JSON.parse(await fsPromises.readFile(path.join(__dirname, 'public', 'products.json'), 'utf-8'));
        if (products.length === 0) {
            bot.sendMessage(chatId, 'No products to delete.');
            return;
        }

        let message = 'Select a product to delete by sending its number:\n\n';
        products.forEach((product, index) => {
            message += `${index + 1}. ${product.name}\n`;
        });
        
        productDrafts.set(chatId, { action: 'delete', products });
        bot.sendMessage(chatId, message);
    } catch (error) {
        console.error('Error listing products for deletion:', error);
        bot.sendMessage(chatId, 'Error loading products');
    }
});

bot.onText(/\/addcollaboration/, (msg) => {
    const chatId = msg.chat.id;
    productDrafts.set(chatId, { isCollaboration: true });
    bot.sendMessage(chatId, 'Please send the collaboration product name:');
});

bot.onText(/\/deletecollaboration/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const collaborations = JSON.parse(await fsPromises.readFile(path.join(__dirname, 'public', 'collaborations.json'), 'utf-8'));
        if (collaborations.length === 0) {
            bot.sendMessage(chatId, 'No collaborations to delete.');
            return;
        }

        let message = 'Select a collaboration to delete by sending its number:\n\n';
        collaborations.forEach((collab, index) => {
            message += `${index + 1}. ${collab.name} x ${collab.collaborator}\n`;
        });
        
        productDrafts.set(chatId, { action: 'deleteCollab', collaborations });
        bot.sendMessage(chatId, message);
    } catch (error) {
        console.error('Error listing collaborations for deletion:', error);
        bot.sendMessage(chatId, 'Error loading collaborations');
    }
});

bot.on('message', async (msg) => {
    try {
        const chatId = msg.chat.id;
        const draft = productDrafts.get(chatId);

        if (!draft) return;

        if (draft.action === 'delete') {
            const productIndex = parseInt(msg.text) - 1;
            if (isNaN(productIndex) || productIndex < 0 || productIndex >= draft.products.length) {
                bot.sendMessage(chatId, 'Please send a valid product number.');
                return;
            }

            try {
                const productToDelete = draft.products[productIndex];
                const productsPath = path.join(__dirname, 'public', 'products.json');
                
                const productFolder = path.join(__dirname, 'public', 'uploads', productToDelete.name.replace(/[^a-z0-9]/gi, '_').toLowerCase());
                try {
                    await fsPromises.rm(productFolder, { recursive: true, force: true });
                } catch (error) {
                    console.error('Error deleting product folder:', error);
                }

                draft.products.splice(productIndex, 1);
                await fsPromises.writeFile(productsPath, JSON.stringify(draft.products, null, 2));
                
                bot.sendMessage(chatId, `Product "${productToDelete.name}" deleted successfully.`);
                productDrafts.delete(chatId);
                return;
            } catch (error) {
                console.error('Error deleting product:', error);
                bot.sendMessage(chatId, 'Error deleting product. Please try again.');
                productDrafts.delete(chatId);
                return;
            }
        }

        if (draft.action === 'deleteCollab') {
            const collabIndex = parseInt(msg.text) - 1;
            if (isNaN(collabIndex) || collabIndex < 0 || collabIndex >= draft.collaborations.length) {
                bot.sendMessage(chatId, 'Please send a valid collaboration number.');
                return;
            }

            try {
                const collabToDelete = draft.collaborations[collabIndex];
                const collaborationsPath = path.join(__dirname, 'public', 'collaborations.json');
                
                // Remove collaboration folder and its contents
                const collabFolder = path.join(__dirname, 'public', 'uploads', 
                    collabToDelete.name.replace(/[^a-z0-9]/gi, '_').toLowerCase());
                try {
                    await fsPromises.rm(collabFolder, { recursive: true, force: true });
                } catch (error) {
                    console.error('Error deleting collaboration folder:', error);
                }

                // Update collaborations.json
                draft.collaborations.splice(collabIndex, 1);
                await fsPromises.writeFile(collaborationsPath, JSON.stringify(draft.collaborations, null, 2));
                
                bot.sendMessage(chatId, `Collaboration "${collabToDelete.name} x ${collabToDelete.collaborator}" deleted successfully.`);
                productDrafts.delete(chatId);
                return;
            } catch (error) {
                console.error('Error deleting collaboration:', error);
                bot.sendMessage(chatId, 'Error deleting collaboration. Please try again.');
                productDrafts.delete(chatId);
                return;
            }
        }

        if (!draft.name) {
            draft.name = msg.text;
            if (draft.isCollaboration) {
                bot.sendMessage(chatId, 'Please send the collaborator name:');
            } else {
                bot.sendMessage(chatId, 'Please send the product description:');
            }
            return;
        }

        if (draft.isCollaboration && !draft.collaborator) {
            draft.collaborator = msg.text;
            bot.sendMessage(chatId, 'Please send the product description:');
            return;
        }

        if (!draft.description) {
            draft.description = msg.text;
            bot.sendMessage(chatId, 'Please send the product price:');
            return;
        }

        if (!draft.price) {
            const price = parseFloat(msg.text);
            if (isNaN(price)) {
                bot.sendMessage(chatId, 'Please send a valid price number:');
                return;
            }
            draft.price = price;
            bot.sendMessage(chatId, 'Please send the prepayment amount:');
            return;
        }

        if (!draft.prepayment) {
            const prepayment = parseFloat(msg.text);
            if (isNaN(prepayment)) {
                bot.sendMessage(chatId, 'Please send a valid prepayment amount:');
                return;
            }
            draft.prepayment = prepayment;
            bot.sendMessage(chatId, 'Is delivery included? (yes/no):');
            return;
        }

        if (!draft.delivery) {
            const response = msg.text.toLowerCase();
            if (response !== 'yes' && response !== 'no') {
                bot.sendMessage(chatId, 'Please reply with "yes" or "no":');
                return;
            }
            draft.delivery = response === 'yes';
            bot.sendMessage(chatId, 'Please send the product size:');
            return;
        }

        if (!draft.size) {
            draft.size = msg.text;
            bot.sendMessage(chatId, 'Please send the product color:');
            return;
        }

        if (!draft.color) {
            draft.color = msg.text;
            bot.sendMessage(chatId, 'Please send the product images (send all images and then type "done"):');
            draft.images = [];
            return;
        }

        if (msg.text && msg.text.toLowerCase() === 'done') {
            try {
                const filePath = draft.isCollaboration ? 
                    path.join(__dirname, 'public', 'collaborations.json') :
                    path.join(__dirname, 'public', 'products.json');
                
                let products = [];
                try {
                    const productsData = await fsPromises.readFile(filePath, 'utf-8');
                    products = JSON.parse(productsData);
                } catch (error) {
                    console.error('Error reading products file:', error);
                }

                const newProduct = {
                    id: Date.now().toString(),
                    name: draft.name,
                    description: draft.description || '',
                    price: draft.price,
                    prepayment: draft.prepayment,
                    delivery: draft.delivery,
                    size: draft.size,
                    color: draft.color,
                    images: draft.images || [],
                    ...(draft.isCollaboration && { collaborator: draft.collaborator })
                };

                products.push(newProduct);
                await fsPromises.writeFile(filePath, JSON.stringify(products, null, 2));
                
                await bot.sendMessage(chatId, `${draft.isCollaboration ? 'Collaboration' : 'Product'} added successfully!`);
                productDrafts.delete(chatId);
            } catch (error) {
                console.error('Error saving product:', error);
                await bot.sendMessage(chatId, 'Error saving product. Please try again.');
            }
            return;
        }

        if (msg.photo || msg.document || msg.video) {
            let file_id;
            let file_name;
            let file_type;
            
            if (msg.photo) {
                const photo = msg.photo[msg.photo.length - 1];
                file_id = photo.file_id;
                file_name = `${Date.now()}-${file_id}.jpg`;
                file_type = 'image';
            } else if (msg.video) {
                file_id = msg.video.file_id;
                file_name = `${Date.now()}-${file_id}.mp4`;
                file_type = 'video';
            } else if (msg.document) {
                file_id = msg.document.file_id;
                const mime = msg.document.mime_type || '';
                if (mime.startsWith('image/')) {
                    file_type = 'image';
                    file_name = msg.document.file_name || `${Date.now()}-${file_id}${getExtensionFromMime(mime)}`;
                } else if (mime.startsWith('video/')) {
                    file_type = 'video';
                    file_name = msg.document.file_name || `${Date.now()}-${file_id}${getExtensionFromMime(mime)}`;
                } else {
                    return; // Unsupported file type
                }
            } else {
                return;
            }
            
            const file_path = path.join(__dirname, 'public', 'uploads', draft.name.replace(/[^a-z0-9]/gi, '_').toLowerCase());
            
            try {
                console.log('Creating directory:', file_path);
                await fsPromises.mkdir(file_path, { recursive: true });
                
                console.log('Getting file info from Telegram');
                const file_info = await bot.getFile(file_id);
                console.log('File info received:', file_info);
                
                if (!file_info || !file_info.file_path) {
                    throw new Error('Failed to get file info from Telegram');
                }
                
                const download_path = path.join(file_path, file_name);
                console.log('Downloading to:', download_path);
                
                await downloadFile(file_info.file_path, download_path);
                console.log('Download completed successfully');
                
                if (!draft.images) draft.images = [];
                draft.images.push(`${draft.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}/${file_name}`);
                await bot.sendMessage(chatId, 'Image received! Send more images or type "done" to finish.');
            } catch (error) {
                console.error('Error handling photo:', error);
                await bot.sendMessage(chatId, 'Error saving image. Please try again.');
            }
            return;
        }
    } catch (error) {
        console.error('Error in message handler:', error);
        try {
            await bot.sendMessage(msg.chat.id, 'An error occurred. Please try again.');
        } catch (sendError) {
            console.error('Error sending error message:', sendError);
        }
    }
});

async function downloadFile(file_path, dest_path, retries = 3) {
    return new Promise((resolve, reject) => {
        const tryDownload = (attemptNumber) => {
            console.log(`Attempting download (attempt ${attemptNumber}/${retries})`);
            
            // Create directory if it doesn't exist
            const dir = path.dirname(dest_path);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            const file = fs.createWriteStream(dest_path);
            const url = `https://api.telegram.org/file/bot${token}/${file_path}`;
            console.log('Downloading from URL:', url);
            
            const request = https.get(url, {
                timeout: 30000,
                headers: {
                    'Connection': 'keep-alive'
                }
            });

            request.on('response', (response) => {
                console.log('Response status:', response.statusCode);
                if (response.statusCode !== 200) {
                    file.close();
                    if (fs.existsSync(dest_path)) {
                        fs.unlinkSync(dest_path);
                    }
                    if (attemptNumber < retries) {
                        setTimeout(() => tryDownload(attemptNumber + 1), 1000);
                    } else {
                        reject(new Error(`Failed to download: ${response.statusCode}`));
                    }
                    return;
                }

                response.pipe(file);

                response.on('end', () => {
                    file.end();
                });
            });

            file.on('finish', () => {
                file.close();
                console.log('File downloaded successfully');
                resolve();
            });

            request.on('error', (err) => {
                console.error('Download error:', err);
                file.close();
                if (fs.existsSync(dest_path)) {
                    fs.unlinkSync(dest_path);
                }
                if (attemptNumber < retries && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
                    console.log(`Error occurred (${err.code}), retrying...`);
                    setTimeout(() => tryDownload(attemptNumber + 1), 1000);
                } else {
                    reject(err);
                }
            });

            request.on('timeout', () => {
                console.log('Request timed out');
                request.destroy();
                file.close();
                if (fs.existsSync(dest_path)) {
                    fs.unlinkSync(dest_path);
                }
                if (attemptNumber < retries) {
                    console.log('Request timed out, retrying...');
                    setTimeout(() => tryDownload(attemptNumber + 1), 1000);
                } else {
                    reject(new Error('Request timeout after all attempts'));
                }
            });
        };

        tryDownload(1);
    });
}

// Initialize with connection test
testConnection();

// Initialize the bot
initBot();

module.exports = bot;

function getExtensionFromMime(mimeType) {
    const mimeMap = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/tiff': '.tiff',
        'image/bmp': '.bmp',
        'video/mp4': '.mp4',
        'video/quicktime': '.mov',
        'video/x-msvideo': '.avi',
        'video/webm': '.webm'
    };
    return mimeMap[mimeType] || '.jpg';
}