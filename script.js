console.log("script.js loaded.");
// Firebase মডিউল ইম্পোর্ট করুন
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, get, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase কনফিগারেশন
const firebaseConfig = {
    apiKey: "AIzaSyCVSzQS1c7H4BLhsDF_fW8wnqUN4B35LPA",
    authDomain: "nahid-6714.firebaseapp.com",
    databaseURL: "https://nahid-6714-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "nahid-6714",
    storageBucket: "nahid-6714.firebasestorage.app",
    messagingSenderId: "505741217147",
    appId: "1:505741217147:web:25ed4e9f0d00e3c4d381de",
    measurementId: "G-QZ7CTRKHCW"
};



// Firebase ইনিশিয়ালাইজ করুন
let app, auth, database, provider;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app);
    provider = new GoogleAuthProvider();
} catch (error) {
    console.error("Firebase ইনিশিয়ালাইজেশন ব্যর্থ: ", error.message);
}

// গ্লোবাল ভেরিয়েবল
window.auth = auth;
window.database = database;
window.provider = provider;
window.firebaseDatabase = { ref, push, onValue, set, get };
let cartItems = [];
let products = [];
let isAdmin = false;
let currentCartItems = []; // Make currentCartItems global

// ইউনিক userId জেনারেট করা বা লোড করা
window.getUserId = function() {
    if (auth.currentUser) {
        return auth.currentUser.uid;
    } else {
        let userId = localStorage.getItem('tempUserId');
        if (!userId) {
            userId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('tempUserId', userId);
        }
        return userId;
    }
};

// লগইন মডাল খোলার ফাংশন
window.openLoginModal = function() {
    window.loginWithGmail();
};

// Google দিয়ে লগইন করার ফাংশন
window.loginWithGmail = function() {
    if (!auth || !provider) return;
    signInWithPopup(auth, provider)
        .then((result) => {
            const user = result.user;
            window.showToast(`লগইন সফল! স্বাগতম, ${user.displayName}`);
            window.updateLoginButton(user);
            window.checkAdminAndShowUploadForm(user);
            window.loadCartFromFirebase();
            window.saveUserToFirebase(user);
        })
        .catch((error) => {
            console.error("লগইন ত্রুটি: ", error.message);
        });
};

// লগইন বাটন আপডেট করার ফাংশন
window.updateLoginButton = function(user) {
    const mobileLoginButton = document.getElementById('mobileLoginButton');
    const desktopLoginButton = document.getElementById('desktopLoginButton');
    if (user) {
        const displayName = user.displayName || 'ব্যবহারকারী';
        const commonHTML = `
            <div class="flex flex-col">
                <span class="flex items-center"><i class="fas fa-user mr-2"></i>${displayName}</span>
                <button onclick="confirmLogout()" class="text-left text-sm text-red-500 hover:text-red-700 mt-1">লগআউট</button>
            </div>
        `;
        if (mobileLoginButton) mobileLoginButton.innerHTML = commonHTML;
        if (desktopLoginButton) desktopLoginButton.innerHTML = commonHTML;
    }
};

// লগআউট নিশ্চিতকরণ ফাংশন
window.confirmLogout = function() {
    if (confirm("আপনি কি সত্যিই লগআউট করতে চান?")) {
        window.logout();
    }
};

// লগআউট ফাংশন
window.logout = function() {
    if (!auth) return;
    signOut(auth).then(() => {
        window.showToast("লগআউট সফল হয়েছে।");
        window.updateLoginButton(null);
        cartItems = [];
        window.updateCartUI();
    });
};

// এডমিন চেক করার এবং প্রোডাক্ট আপলোড ফর্ম দেখানোর ফাংশন
window.checkAdminAndShowUploadForm = function(user) {
    const adminEmail = "mdnahidislam6714@gmail.com";
    isAdmin = user && user.email === adminEmail;
    const uploadForm = document.getElementById('product-update');
    if (uploadForm) {
        uploadForm.classList.toggle('hidden', !isAdmin);
    }
};

// টোস্ট নোটিফিকেশন দেখানোর ফাংশন
window.showToast = function(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
};

// নতুন ইউজারের ডাটা Firebase-এ সেভ করার ফাংশন
window.saveUserToFirebase = function(user) {
    if (!database) return;
    const userRef = ref(database, `users/${user.uid}`);
    get(userRef).then((snapshot) => {
        if (!snapshot.exists()) {
            set(userRef, {
                name: user.displayName || "নাম পাওয়া যায়নি",
                email: user.email,
                createdAt: new Date().toISOString()
            });
        }
    });
};

// কার্টে আইটেম যোগ করার ফাংশন
window.addToCart = function(productData, quantityToAdd = 1) {
    if (!productData || !productData.id) {
        window.showToast("কার্টে প্রোডাক্ট যোগ করতে সমস্যা হয়েছে।");
        return;
    }
    const existingProduct = cartItems.find(p => p.id === productData.id);
    if (existingProduct) {
        existingProduct.quantity += quantityToAdd;
    } else {
        cartItems.push({ ...productData, quantity: quantityToAdd });
    }
    window.updateCartUI();
    window.saveCartToFirebase();
    window.showToast("প্রোডাক্ট কার্টে যোগ করা হয়েছে!");
    window.openCartSidebar();
};

// কার্ট UI আপডেট করার ফাংশন
window.updateCartUI = function() {
    const cartItemsContainer = document.getElementById('cartItems');
    const totalPriceElement = document.getElementById('totalPrice');
    const cartCountElement = document.getElementById('cartCount');
    if (!cartItemsContainer || !totalPriceElement || !cartCountElement) return;

    cartItemsContainer.innerHTML = '';
    let totalPrice = 0;
    let totalQuantity = 0;

    cartItems.forEach((item, index) => {
        const itemPrice = (parseFloat(item.price) || 0) * (item.quantity || 1);
        totalPrice += itemPrice;
        totalQuantity += item.quantity;
        const cartItem = document.createElement('div');
        cartItem.className = 'bg-white p-3 rounded-lg shadow mb-4';
        cartItem.innerHTML = `
            <h3 class="text-lg font-bold text-gray-800 mb-3 truncate">${item.name || 'নাম পাওয়া যায়নি'}</h3>
            <div class="flex items-start space-x-3">
                <img src="${item.image ? item.image.split(',')[0] : 'https://via.placeholder.com/50'}" class="w-16 h-16 object-cover rounded-lg flex-shrink-0" alt="${item.name}">
                <div class="flex flex-col flex-grow justify-between">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center space-x-2">
                            <button onclick="window.decreaseQuantity(${index})" class="bg-lipstick text-white w-6 h-6 rounded-full flex items-center justify-center">-</button>
                            <span class="px-2 font-bold text-lipstick">${item.quantity || 1}</span>
                            <button onclick="window.increaseQuantity(${index})" class="bg-lipstick text-white w-6 h-6 rounded-full flex items-center justify-center">+</button>
                        </div>
                        <button onclick="window.removeFromCart(${index})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                    </div>
                    <p class="text-lipstick font-bold mt-1">৳ ${itemPrice}</p>
                </div>
            </div>
        `;
        cartItemsContainer.appendChild(cartItem);
    });

    totalPriceElement.textContent = `মোট মূল্য: ${totalPrice} টাকা`;
    cartCountElement.textContent = totalQuantity;
    cartCountElement.classList.toggle('hidden', totalQuantity === 0);
};

// কার্ট থেকে আইটেম রিমুভ করার ফাংশন
window.removeFromCart = function(index) {
    cartItems.splice(index, 1);
    window.updateCartUI();
    window.saveCartToFirebase();
    window.showToast("প্রোডাক্ট কার্ট থেকে সরানো হয়েছে!");
};

// কার্ট থেকে পরিমাণ কমানোর ফাংশন
window.decreaseQuantity = function(index) {
    if (cartItems[index].quantity > 1) {
        cartItems[index].quantity--;
    } else {
        cartItems.splice(index, 1);
    }
    window.updateCartUI();
    window.saveCartToFirebase();
};

// কার্টে পরিমাণ বাড়ানোর ফাংশন
window.increaseQuantity = function(index) {
    cartItems[index].quantity++;
    window.updateCartUI();
    window.saveCartToFirebase();
};

// Checkout ফাংশন
window.checkout = function() {
    
    if (cartItems.length === 0) {
        window.showToast("আপনার কার্ট খালি।");
        return;
    }
    // কার্ট আইটেমগুলো লোকাল স্টোরেজে সেভ করুন
    localStorage.setItem('checkoutCartItems', JSON.stringify(cartItems));
    window.location.href = 'order-form.html';
};

// Firebase-এ কার্ট সেভ করার ফাংশন
window.saveCartToFirebase = function() {
    if (!database) return;
    const userId = window.getUserId();
    const cartRef = ref(database, `carts/${userId}`);
    set(cartRef, cartItems);
};

// Firebase থেকে কার্ট লোড করার ফাংশন
window.loadCartFromFirebase = function() {
    if (!database) return;
    const userId = window.getUserId();
    const cartRef = ref(database, `carts/${userId}`);
    onValue(cartRef, (snapshot) => {
        cartItems = snapshot.val() || [];
        window.updateCartUI();
    });
};

// Firebase থেকে প্রোডাক্ট লোড করার ফাংশন
window.loadProductsFromFirebase = function() {
    return new Promise((resolve, reject) => {
        // Try to load from localStorage first
        const cachedProducts = localStorage.getItem('cachedProducts');
        if (cachedProducts) {
            products = JSON.parse(cachedProducts);
            console.log("Products loaded from cache.");
            resolve(products);
            return;
        }

        if (!database) return reject(new Error("Firebase Database is not initialized."));
        const productsRef = ref(database, 'products');
        get(productsRef).then(snapshot => {
            products = snapshot.exists() ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data })) : [];
            // Save to localStorage after fetching from Firebase
            localStorage.setItem('cachedProducts', JSON.stringify(products));
            console.log("Products loaded from Firebase and cached.");
            resolve(products);
        }).catch(reject);
    });
};

// প্রোডাক্ট লোড করার ফাংশন
window.loadProducts = function(filteredProducts = products) {
    const productList = document.getElementById("productList");
    if (!productList) return;
    productList.innerHTML = "";
    filteredProducts.forEach(product => {
        const card = document.createElement("div");
        card.className = "bg-white rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-2 transition-transform duration-300 ease-in-out cursor-pointer flex flex-col";
        card.onclick = () => window.showProductDetail(product.id);
        card.innerHTML = `
            <img src="${product.image ? product.image.split(',')[0] : 'https://via.placeholder.com/300'}" class="w-full h-48 object-cover mb-4 rounded-lg">
            <div class="p-4 flex-grow flex flex-col">
                <h3 class="text-lg font-bold mb-2 text-gray-800">${product.name || 'নাম পাওয়া যায়নি'}</h3>
                <p class="text-lipstick font-bold mb-2 text-xl">${product.price || '0'} ৳</p>
                <div class="mt-auto flex justify-between items-stretch pt-4 border-t border-gray-200 gap-2">
                    <a href="order-form.html?id=${product.id}&quantity=1" class="flex-1 bg-green-500 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-green-600 transition-colors duration-300 text-center flex items-center justify-center">
                      <i class="fas fa-bolt mr-1"></i> অর্ডার করুন
                    </a>
                    <button class="add-to-cart-btn flex-1 bg-teal-500 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-teal-600 transition-colors duration-300 text-center flex items-center justify-center">
                      <i class="fas fa-cart-plus mr-1"></i> কার্টে যোগ করুন
                    </button>
                </div>
            </div>
        `;
        productList.appendChild(card);
        card.querySelector('.add-to-cart-btn').addEventListener('click', (event) => {
            event.stopPropagation();
            window.addToCart(product, 1);
        });
    });
};

// ক্যাটাগরি ফিল্টার ফাংশন
window.filterProducts = function(category) {
    let filtered = [];
    if (category === 'all') {
        filtered = products;
    } else {
        filtered = products.filter(p => p.category && p.category.toLowerCase() === category.toLowerCase());
    }
    window.loadProducts(filtered);
    window.closeSidebar(); // Close sidebar after filtering
};

// সাইডবার ক্যাটাগরি ক্লিক হ্যান্ডলার
window.handleCategoryClick = function(category, event) {
    if (event) {
        event.stopPropagation(); // Prevent sidebar from closing immediately
    }
    window.filterProducts(category);
};

// প্রোডাক্ট ডিটেইল পেজে রিডাইরেক্ট
window.showProductDetail = function(productId) {
    window.location.href = `product-detail.html?id=${productId}`;
};

// সার্চ ফাংশনালিটি
window.searchProducts = function() {
    const searchInput = document.getElementById("searchInput");
    const searchResults = document.getElementById("searchResults");
    if (!searchInput || !searchResults) return;
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm === "") {
        searchResults.innerHTML = "";
        searchResults.classList.add("hidden");
        return;
    }
    const filtered = products.filter(p => (p.name && p.name.toLowerCase().includes(searchTerm)) || (p.tags && p.tags.toLowerCase().includes(searchTerm)));
    window.displaySearchResults(filtered, searchResults);
};

window.searchProductsDesktop = function() {
    const searchInput = document.getElementById("searchInputDesktop");
    const searchResults = document.getElementById("searchResultsDesktop");
    if (!searchInput || !searchResults) return;
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm === "") {
        searchResults.innerHTML = "";
        searchResults.classList.add("hidden");
        return;
    }
    const filtered = products.filter(p => (p.name && p.name.toLowerCase().includes(searchTerm)) || (p.tags && p.tags.toLowerCase().includes(searchTerm)));
    window.displaySearchResults(filtered, searchResults);
};

window.displaySearchResults = function(filteredProducts, searchResults) {
    searchResults.innerHTML = "";
    if (filteredProducts.length === 0) {
        searchResults.innerHTML = `<div class="p-2 text-gray-600">কোনো প্রোডাক্ট পাওয়া যায়নি</div>`;
    } else {
        filteredProducts.forEach(product => {
            const card = document.createElement("div");
            card.className = "p-2 hover:bg-gray-100 cursor-pointer";
            card.onclick = () => window.showProductDetail(product.id);
            card.innerHTML = `
                <div class="flex items-center">
                    <img src="${product.image ? product.image.split(',')[0] : 'https://via.placeholder.com/50'}" class="w-12 h-12 object-cover rounded-lg mr-4">
                    <div>
                        <h3 class="text-lg font-bold">${product.name || 'নাম পাওয়া যায়নি'}</h3>
                        <p class="text-lipstick font-bold">দাম: ${product.price || '0'} টাকা</p>
                    </div>
                </div>
            `;
            searchResults.appendChild(card);
        });
    }
    searchResults.classList.remove("hidden");
};

// নতুন ইমেজ ইনপুট ফিল্ড যোগ করার ফাংশন
window.addImageField = function() {
    const imageInputsDiv = document.getElementById('imageInputs');
    if (imageInputsDiv) {
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'w-full p-2 border rounded mb-2';
        newInput.placeholder = 'ছবির লিংক';
        imageInputsDiv.appendChild(newInput);
    }
};

window.focusMobileSearch = function() {
    const mobileSearchBar = document.getElementById('mobileSearchBar');
    if (mobileSearchBar) {
        mobileSearchBar.classList.toggle('hidden');
        mobileSearchBar.classList.toggle('show');
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.focus();
    }
};

window.closeMobileSearch = function() {
    const mobileSearchBar = document.getElementById('mobileSearchBar');
    if (mobileSearchBar) {
        mobileSearchBar.classList.add('hidden');
    }
};

window.toggleSidebarSection = function(sectionId) {
    const section = document.getElementById(sectionId);
    const allSections = document.querySelectorAll('#sidebar > div > div > div');
    allSections.forEach(s => {
        if (s.id !== sectionId) {
            s.classList.add('hidden');
            s.previousElementSibling.querySelector('i').classList.remove('rotate-180');
        }
    });
    section.classList.toggle('hidden');
    section.previousElementSibling.querySelector('i').classList.toggle('rotate-180');
};

// সাইডবার কন্ট্রোল
window.openSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebar && sidebarOverlay) {
        sidebar.classList.remove('-translate-x-full');
        sidebarOverlay.classList.remove('hidden');
    }
};

window.closeSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebar && sidebarOverlay) {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    }
};

window.openCartSidebar = function() {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartSidebar && cartOverlay) {
        cartSidebar.classList.remove('translate-x-full');
        cartOverlay.classList.remove('hidden');
    }
};

window.closeCartSidebar = function() {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartSidebar && cartOverlay) {
        cartSidebar.classList.add('translate-x-full');
        cartOverlay.classList.add('hidden');
    }
};

// প্রোডাক্ট ডিটেইল পেজ ইনিশিয়ালাইজেশন
window.initializeProductDetailPage = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        console.error("Product ID not found in URL.");
        document.getElementById('productTitle').textContent = "প্রোডাক্ট পাওয়া যায়নি।";
        return;
    }

    try {
        const productsRef = ref(database, `products/${productId}`);
        const snapshot = await get(productsRef);

        if (snapshot.exists()) {
            const product = { id: productId, ...snapshot.val() };
            document.getElementById('productTitle').textContent = product.name || 'নাম পাওয়া যায়নি';
            document.getElementById('productPrice').textContent = `৳ ${product.price || '0'}`;
            document.getElementById('productDescription').textContent = product.description || 'কোনো বিবরণ নেই।';

            // Image Gallery
            const mainImage = document.getElementById('mainImage');
            const thumbnailContainer = document.getElementById('thumbnailContainer');
            const imageUrls = product.image ? product.image.split(',').map(url => url.trim()) : [];

            if (imageUrls.length > 0) {
                mainImage.src = imageUrls[0];
                thumbnailContainer.innerHTML = '';
                imageUrls.forEach((url, index) => {
                    const thumbnail = document.createElement('img');
                    thumbnail.src = url;
                    thumbnail.className = `thumbnail ${index === 0 ? 'active' : ''}`;
                    thumbnail.onclick = () => {
                        mainImage.src = url;
                        Array.from(thumbnailContainer.children).forEach(img => img.classList.remove('active'));
                        thumbnail.classList.add('active');
                    };
                    thumbnailContainer.appendChild(thumbnail);
                });
            } else {
                mainImage.src = 'https://via.placeholder.com/500x400.png?text=No Image';
            }

            // Enable buttons
            const buyNowBtn = document.getElementById('buyNowBtn');
            const addToCartBtn = document.getElementById('addToCartBtn');
            const whatsappBtn = document.getElementById('whatsappBtn');

            // Always enable buttons as stock is removed
            buyNowBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            buyNowBtn.disabled = false;
            addToCartBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            addToCartBtn.disabled = false;

            // WhatsApp Button
            const whatsappMessage = encodeURIComponent(`আমি এই প্রোডাক্টটি কিনতে চাই:\nপ্রোডাক্টের নাম: ${product.name}\nদাম: ${product.price} টাকা\nলিঙ্ক: ${window.location.href}`);
            whatsappBtn.href = `https://wa.me/?text=${whatsappMessage}`;

            // Add to Cart from Detail Page
            window.addToCartFromDetail = function() {
                window.addToCart(product, 1);
            };

            // Buy Now from Detail Page
            window.buyNow = function() {
                localStorage.setItem('buyNowProduct', JSON.stringify({ id: product.id, quantity: 1 }));
                window.location.href = `order-form.html?source=buyNow&id=${product.id}&quantity=1`;
            };

        } else {
            document.getElementById('productTitle').textContent = "প্রোডাক্ট পাওয়া যায়নি।";
            console.error("Product not found in Firebase.");
        }
    } catch (error) {
        console.error("Error loading product details:", error);
        document.getElementById('productTitle').textContent = "প্রোডাক্ট লোড করতে সমস্যা হয়েছে।";
    }
};

// DOM লোড হওয়ার পরে সব শুরু করা
document.addEventListener("DOMContentLoaded", async () => {
    window.addEventListener("scroll", () => {
        const mobileSearchBar = document.getElementById('mobileSearchBar');
        if (mobileSearchBar && !mobileSearchBar.classList.contains('hidden')) {
            closeMobileSearch();
        }
    });
    // Load header and footer
    const headerDiv = document.getElementById("header");
    const footerDiv = document.getElementById("footer");
    if(headerDiv) {
        fetch("header.html").then(res => res.text()).then(data => headerDiv.innerHTML = data).then(() => {
             // Re-initialize event listeners for dynamically loaded header elements
            document.getElementById('sidebarOverlay').addEventListener('click', window.closeSidebar);
            document.getElementById('cartOverlay').addEventListener('click', window.closeCartSidebar);
        });
    }
    if(footerDiv) {
        fetch("footer.html").then(res => res.text()).then(data => footerDiv.innerHTML = data);
    }

    // Load products if on the right page
    if (document.getElementById("productList")) {
        try {
            const products = await window.loadProductsFromFirebase();
            window.loadProducts(products);
        } catch (error) {
            console.error("প্রোডাক্ট লোড করতে সমস্যা হয়েছে:", error);
        }
    }

    // Initialize product detail page if on product-detail.html
    if (document.getElementById('productTitle')) {
        window.initializeProductDetailPage();
    }

    // Populate productQuantity select box
    const productQuantitySelect = document.getElementById('productQuantity');
    if (productQuantitySelect) {
        for (let i = 1; i <= 100; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            productQuantitySelect.appendChild(option);
        }
    }

    // Auth state change listener
    if (auth) {
        onAuthStateChanged(auth, (user) => {
            window.updateLoginButton(user);
            window.checkAdminAndShowUploadForm(user);
            window.loadCartFromFirebase();
            // If on order-form.html, initialize it after auth state is known
            if (document.getElementById('checkoutForm')) {
                window.initializeOrderFormPage();
            }
            // If on order-track.html, initialize it after auth state is known
            if (document.getElementById('orderTrackForm')) {
                window.initializeOrderTrackPage();
            }
        });
    } else {
        window.loadCartFromFirebase(); // Load from local storage if not logged in
        // If on order-form.html and not logged in, initialize it
        if (document.getElementById('checkoutForm')) {
            window.initializeOrderFormPage();
        }
        // If on order-track.html and not logged in, initialize it
        if (document.getElementById('orderTrackForm')) {
            window.initializeOrderTrackPage();
        }
    }

    // Initialize Order Track Page
    window.initializeOrderTrackPage = async function() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const loginPrompt = document.getElementById('loginPrompt');
        const orderTrackForm = document.getElementById('orderTrackForm');
        const orderTrackResult = document.getElementById('orderTrackResult');
        const noOrderFoundMessage = document.getElementById('noOrderFoundMessage');

        // Initially hide all dynamic sections
        loadingIndicator.classList.add('hidden');
        loginPrompt.classList.add('hidden');
        orderTrackForm.classList.add('hidden'); // Keep this hidden as it's now empty
        orderTrackResult.classList.add('hidden');
        noOrderFoundMessage.classList.add('hidden');

        // Load orders from local storage
        const savedOrderIds = JSON.parse(localStorage.getItem('userOrderIds')) || [];

        if (savedOrderIds.length === 0) {
            noOrderFoundMessage.textContent = "আপনার কোনো অর্ডার পাওয়া যায়নি।";
            noOrderFoundMessage.classList.remove('hidden');
            return;
        }

        loadingIndicator.classList.remove('hidden');
        orderTrackResult.innerHTML = ''; // Clear previous results

        try {
            let foundOrders = 0;
            for (const orderId of savedOrderIds) {
                const orderRef = ref(database, `orders/${orderId}`);
                const snapshot = await get(orderRef);

                if (snapshot.exists()) {
                    const order = snapshot.val();
                    // Display order details
                    orderTrackResult.innerHTML += `
                        <div class="bg-white p-4 rounded-lg shadow-md mb-4">
                            <h3 class="text-xl font-bold text-lipstick mb-3">অর্ডার আইডি: ${orderId}</h3>
                            <p class="text-gray-700 mb-2"><strong>স্ট্যাটাস:</strong> <span class="font-semibold text-green-600">${order.status}</span></p>
                            <p class="text-gray-700 mb-2"><strong>অর্ডার তারিখ:</strong> ${new Date(order.orderDate).toLocaleString('bn-BD')}</p>
                            <p class="text-gray-700 mb-2"><strong>মোট প্রদেয়:</strong> ${order.totalAmount} টাকা</p>
                            <p class="text-gray-700 mb-2"><strong>ডেলিভারি ঠিকানা:</strong> ${order.address}</p>
                            <h4 class="font-semibold text-gray-800 mt-4 mb-2">অর্ডারকৃত পণ্যসমূহ:</h4>
                            <ul class="list-disc list-inside">
                                ${order.items.map(item => `<li>${item.name} (পরিমাণ: ${item.quantity}, মূল্য: ${item.price} টাকা)</li>`).join('')}
                            </ul>
                        </div>
                    `;
                    foundOrders++;
                }
            }

            if (foundOrders > 0) {
                orderTrackResult.classList.remove('hidden');
            } else {
                noOrderFoundMessage.textContent = "আপনার কোনো অর্ডার পাওয়া যায়নি।";
                noOrderFoundMessage.classList.remove('hidden');
            }
        } catch (error) {
            console.error("অর্ডার ট্র্যাক করতে সমস্যা হয়েছে:", error);
            window.showToast("অর্ডার ট্র্যাক করতে সমস্যা হয়েছে।", "error");
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    };

    window.initializeOrderFormPage = async function() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loginPrompt = document.getElementById('loginPrompt');
    const checkoutForm = document.getElementById('checkoutForm');
    const checkoutItemsContainer = document.getElementById('checkoutItems');
    const subTotalDisplay = document.getElementById('subTotalDisplay');
    const deliveryFeeDisplay = document.getElementById('deliveryFeeDisplay');
    const totalAmountDisplay = document.getElementById('totalAmountDisplay');
    const deliveryLocationRadios = document.querySelectorAll('input[name="deliveryLocation"]');
    const customerNameInput = document.getElementById('customerName');
    const phoneNumberInput = document.getElementById('phoneNumber');
    const addressInput = document.getElementById('address');
    const submitButton = document.getElementById('submitButton');

    let subTotal = 0;
    let deliveryFee = 0;
    let totalAmount = 0;

    try {
        // Always try to load from localStorage first
        const storedCartItems = localStorage.getItem('checkoutCartItems');
        if (storedCartItems) {
            currentCartItems = JSON.parse(storedCartItems);
        } else {
            currentCartItems = []; // Initialize as empty if nothing in localStorage
        }

        // If coming from buyNow, and currentCartItems doesn't contain this product, add it.
        // This ensures that if user refreshes or navigates back, the buyNow product is still there.
        const urlParams = new URLSearchParams(window.location.search);
        const source = urlParams.get('source');
        if (source === 'buyNow') {
            const productId = urlParams.get('id');
            const quantity = parseInt(urlParams.get('quantity')) || 1;
            if (productId) {
                const existingBuyNowProduct = currentCartItems.find(item => item.id === productId);
                if (!existingBuyNowProduct) {
                    try {
                        const productSnapshot = await get(ref(database, `products/${productId}`));
                        if (productSnapshot.exists()) {
                            const productData = productSnapshot.val();
                            currentCartItems = [{ ...productData, id: productId, quantity: quantity }];
                            localStorage.setItem('checkoutCartItems', JSON.stringify(currentCartItems)); // Save to localStorage
                        } else {
                            window.showToast("প্রোডাক্ট পাওয়া যায়নি।", "error");
                        }
                    } catch (error) {
                        console.error("Error fetching product for buy now:", error);
                        window.showToast("প্রোডাক্ট লোড করতে সমস্যা হয়েছে।", "error");
                    }
                }
            }
        }

        // Function to update price summary
        const updatePriceSummary = () => {
            subTotal = currentCartItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (item.quantity || 1), 0);
            subTotalDisplay.textContent = `${subTotal.toFixed(2)} টাকা`;

            const selectedDeliveryLocation = document.querySelector('input[name="deliveryLocation"]:checked');
            if (selectedDeliveryLocation) {
                deliveryFee = selectedDeliveryLocation.value === 'insideDhaka' ? 70 : 160;
            } else {
                deliveryFee = 0; // Default or initial state
            }
            deliveryFeeDisplay.textContent = `${deliveryFee.toFixed(2)} টাকা`;

            totalAmount = subTotal + deliveryFee;
            totalAmountDisplay.textContent = `${totalAmount.toFixed(2)} টাকা`;

            const totalProductCount = currentCartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const totalProductCountDisplay = document.getElementById('totalProductCountDisplay');
            if (totalProductCountDisplay) {
                totalProductCountDisplay.textContent = totalProductCount;
            }


            // Enable/disable submit button based on cart items
            if (currentCartItems.length === 0) {
                submitButton.disabled = true;
                submitButton.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                submitButton.disabled = false;
                submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        };

        

        if (currentCartItems.length === 0) {
            checkoutItemsContainer.innerHTML = '<p class="text-center text-gray-500 italic p-4">আপনার কার্ট খালি।</p>';
            submitButton.disabled = true;
            submitButton.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            checkoutItemsContainer.innerHTML = '';
            currentCartItems.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'flex flex-col mb-4 p-3 bg-white rounded-lg shadow-sm';
                itemDiv.innerHTML = `
                    <div class="flex items-center mb-2">
                        <img src="${item.image ? item.image.split(',')[0] : 'https://via.placeholder.com/50'}" class="w-16 h-16 object-cover rounded-lg mr-3 flex-shrink-0" alt="${item.name}">
                        <h4 class="font-semibold text-gray-800 truncate flex-grow">${item.name}</h4>
                        <button type="button" class="text-red-500 hover:text-red-700 ml-2" data-index="${index}" onclick="window.removeFromOrderFormCart(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            <button type="button" class="bg-lipstick text-white w-6 h-6 rounded-full flex items-center justify-center" data-index="${index}" onclick="window.decreaseOrderFormQuantity(${index})">-</button>
                            <span class="px-2 font-bold text-lipstick">${item.quantity}</span>
                            <button type="button" class="bg-lipstick text-white w-6 h-6 rounded-full flex items-center justify-center" data-index="${index}" onclick="window.increaseOrderFormQuantity(${index})">+</button>
                        </div>
                        <span class="font-bold text-gray-700">৳ ${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                    </div>
                `;
                checkoutItemsContainer.appendChild(itemDiv);
            });
        }

        // New functions for quantity control and removal in order form
        window.decreaseOrderFormQuantity = function(index) {
            if (currentCartItems[index].quantity > 1) {
                currentCartItems[index].quantity--;
            } else {
                currentCartItems.splice(index, 1);
            }
            localStorage.setItem('checkoutCartItems', JSON.stringify(currentCartItems)); // Save updated cart to localStorage
            window.initializeOrderFormPage(); // Re-render the form
        };

        window.increaseOrderFormQuantity = function(index) {
            currentCartItems[index].quantity++;
            localStorage.setItem('checkoutCartItems', JSON.stringify(currentCartItems)); // Save updated cart to localStorage
            window.initializeOrderFormPage(); // Re-render the form
        };

        window.removeFromOrderFormCart = function(index) {
            currentCartItems.splice(index, 1);
            localStorage.setItem('checkoutCartItems', JSON.stringify(currentCartItems)); // Save updated cart to localStorage
            window.initializeOrderFormPage(); // Re-render the form
        };

        updatePriceSummary();

        // Populate user info if logged in, otherwise leave blank
        const user = auth.currentUser; // Get current user here
        if (user) {
            customerNameInput.value = user.displayName || '';
            phoneNumberInput.value = user.phoneNumber || ''; // Assuming phone number is part of user profile
        }

        } finally {
        loadingIndicator.classList.add('hidden');
        loginPrompt.classList.add('hidden'); // Ensure login prompt is hidden
        checkoutForm.classList.remove('hidden');
    };
};

    // Product Form Submission Handling
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const productName = document.getElementById('productName').value;
            const productPrice = parseFloat(document.getElementById('productPrice').value);
            const productCategory = document.getElementById('productCategory').value;
            const productImages = Array.from(document.querySelectorAll('#imageInputs input')).map(input => input.value.trim()).filter(url => url !== '').join(',');
            const productTags = document.getElementById('productTags').value;
            const productDescription = document.getElementById('productDescription').value;
            const productStockStatus = document.getElementById('productStockStatus').value;
            const productQuantity = parseInt(document.getElementById('productQuantity').value);

            if (!productName || isNaN(productPrice) || productPrice <= 0 || !productDescription) {
                window.showToast("অনুগ্রহ করে সকল প্রয়োজনীয় ফিল্ড পূরণ করুন এবং সঠিক দাম দিন।", "error");
                return;
            }

            const productData = {
                name: productName,
                price: productPrice,
                category: productCategory,
                image: productImages,
                tags: productTags,
                description: productDescription,
                stockStatus: productStockStatus,
                quantity: productQuantity,
                createdAt: new Date().toISOString()
            };

            try {
                const newProductRef = push(ref(database, 'products'), productData);
                window.showToast("প্রোডাক্ট সফলভাবে পোস্ট করা হয়েছে!", "success");
                productForm.reset(); // Reset the form
                document.getElementById('imageInputs').innerHTML = '<input type="text" class="w-full p-2 border rounded mb-2" placeholder="ছবির লিংক">'; // Reset image inputs
                window.loadProductsFromFirebase().then(window.loadProducts); // Reload products on page
            } catch (error) {
                console.error("প্রোডাক্ট পোস্ট করতে সমস্যা হয়েছে:", error);
                window.showToast("প্রোডাক্ট পোস্ট করতে সমস্যা হয়েছে।", "error");
            }
        });
    }
});