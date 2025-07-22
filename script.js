console.log("script.js loaded.");
// Firebase মডিউল ইম্পোর্ট করুন
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, get, push, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
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
    isAdmin = user && (user.email === adminEmail || user.role === 'admin' || user.role === 'co-admin');
    const uploadForm = document.getElementById('product-update');
    if (uploadForm) {
        uploadForm.classList.toggle('hidden', !isAdmin);
    }

    const mobileAdminLink = document.getElementById('mobileAdminLink');
    const desktopAdminLink = document.getElementById('desktopAdminLink');

    if (mobileAdminLink) {
        mobileAdminLink.classList.toggle('hidden', !isAdmin);
    }
    if (desktopAdminLink) {
        desktopAdminLink.classList.toggle('hidden', !isAdmin);
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
                role: 'user', // Default role
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
    const cartTotalProductsElement = document.getElementById('cartTotalProducts');
    if (!cartItemsContainer || !totalPriceElement || !cartCountElement || !cartTotalProductsElement) return;

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
                <img src="${item.image ? item.image.split(',')[0] : 'https://via.placeholder.com/50'}" class="w-16 h-16 object-cover rounded-lg mr-3 flex-shrink-0" alt="${item.name}">
                <div class="flex flex-col flex-grow">
                    <div class="flex items-center justify-between w-full">
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
    cartTotalProductsElement.textContent = totalQuantity;
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
};

// সাইডবার ক্যাটাগরি ক্লিক হ্যান্ডলার
window.handleCategoryClick = function(category, event, isSubmenu) {
    if (event) {
        event.stopPropagation();
    }
    window.filterProducts(category);
    if (isSubmenu) {
        window.closeSidebar();
    }
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
        // Prevent clicks inside the sidebar from closing it
        sidebar.addEventListener('click', (event) => {
            event.stopPropagation();
        });
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

// ডেস্কটপ সাবমেনু টগল ফাংশন
window.toggleSubMenuDesktop = function() {
    const desktopSubMenuBar = document.getElementById('desktopSubMenuBar');
    const desktopArrowIcon = document.getElementById('desktopArrowIcon');
    if (desktopSubMenuBar && desktopArrowIcon) {
        desktopSubMenuBar.classList.toggle('hidden');
        desktopArrowIcon.classList.toggle('rotate-180');
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
            let currentImageIndex = 0;

            function updateMainImage(index) {
                if (imageUrls.length > 0) {
                    mainImage.src = imageUrls[index];
                    currentImageIndex = index;
                    // Update active thumbnail
                    Array.from(thumbnailContainer.children).forEach((img, i) => {
                        img.classList.toggle('active', i === index);
                    });
                }
            }

            if (imageUrls.length > 0) {
                mainImage.src = imageUrls[0];
                thumbnailContainer.innerHTML = '';
                imageUrls.forEach((url, index) => {
                    const thumbnail = document.createElement('img');
                    thumbnail.src = url;
                    thumbnail.className = `thumbnail ${index === 0 ? 'active' : ''}`;
                    thumbnail.onclick = () => updateMainImage(index);
                    thumbnailContainer.appendChild(thumbnail);
                });
            } else {
                mainImage.src = 'https://via.placeholder.com/500x400.png?text=No Image';
            }

            // Full-screen modal logic
            const modal = document.getElementById('imageModal');
            const modalImage = document.getElementById('modalImage');
            const closeBtn = document.getElementById('modalCloseBtn');
            const prevBtn = document.getElementById('modalPrevBtn');
            const nextBtn = document.getElementById('modalNextBtn');

            if(modal && modalImage && closeBtn && prevBtn && nextBtn) {
                mainImage.onclick = () => {
                    if(imageUrls.length > 0) {
                        modal.style.display = "flex";
                        modalImage.src = mainImage.src;
                    }
                };

                closeBtn.onclick = () => {
                    modal.style.display = "none";
                };
                
                modal.onclick = (event) => {
                    if (event.target === modal) {
                        modal.style.display = "none";
                    }
                };
                
                function showNextImage() {
                    currentImageIndex = (currentImageIndex + 1) % imageUrls.length;
                    modalImage.src = imageUrls[currentImageIndex];
                    mainImage.src = imageUrls[currentImageIndex];
                    updateMainImage(currentImageIndex);
                }

                function showPrevImage() {
                    currentImageIndex = (currentImageIndex - 1 + imageUrls.length) % imageUrls.length;
                    modalImage.src = imageUrls[currentImageIndex];
                    mainImage.src = imageUrls[currentImageIndex];
                    updateMainImage(currentImageIndex);
                }

                nextBtn.onclick = showNextImage;
                prevBtn.onclick = showPrevImage;
            }

            // Function to toggle order details visibility
            window.toggleOrderDetails = function(element) {
                const detailsDiv = element.nextElementSibling;
                const icon = element.querySelector('i');
                if (detailsDiv.classList.contains('hidden')) {
                    detailsDiv.classList.remove('hidden');
                    icon.classList.add('rotate-180');
                } else {
                    detailsDiv.classList.add('hidden');
                    icon.classList.remove('rotate-180');
                }
            };


            // Quantity Selector
            const quantityInput = document.getElementById('quantityInput');
            const decreaseQuantityBtn = document.getElementById('decreaseQuantityBtn');
            const increaseQuantityBtn = document.getElementById('increaseQuantityBtn');

            if(quantityInput && decreaseQuantityBtn && increaseQuantityBtn) {
                decreaseQuantityBtn.addEventListener('click', () => {
                    let currentValue = parseInt(quantityInput.value);
                    if (currentValue > 1) {
                        quantityInput.value = currentValue - 1;
                    }
                });

                increaseQuantityBtn.addEventListener('click', () => {
                    let currentValue = parseInt(quantityInput.value);
                    quantityInput.value = currentValue + 1;
                });
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
            const whatsappMessage = encodeURIComponent(`আমি এই প্রোডাক্টটি কিনতে চাই:
প্রোডাক্টের নাম: ${product.name}
দাম: ${product.price} টাকা
লিঙ্ক: ${window.location.href}`);
            whatsappBtn.href = `https://wa.me/?text=${whatsappMessage}`;

            // Add to Cart from Detail Page
            window.addToCartFromDetail = function() {
                const quantity = parseInt(document.getElementById('quantityInput').value) || 1;
                window.addToCart(product, quantity);
            };

            // Buy Now from Detail Page
            window.buyNow = function() {
                const quantity = parseInt(document.getElementById('quantityInput').value) || 1;
                const buyNowCart = [{ ...product, quantity: quantity }];
                localStorage.setItem('checkoutCartItems', JSON.stringify(buyNowCart));
                window.location.href = `order-form.html`;
            };

        } else {
            document.getElementById('productTitle').textContent = "প্রোডাক্ট পাওয়া যায়নি।";
            console.error("Product not found in Firebase.");
        }
    } catch (error) {
        console.error("Error loading product details:", error);
        document.getElementById('productTitle').textContent = "প্রোডাক্ট লোড করতে সমস্যা হয়েছে।";
    }
};""

// Function to load HTML content into a placeholder
window.loadHTML = async function(url, elementId) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        document.getElementById(elementId).innerHTML = html;
    } catch (error) {
        console.error(`Error loading ${url}:`, error);
    }
};

// DOM লোড হওয়ার পরে সব শুরু করা
        document.addEventListener("DOMContentLoaded", async () => {
            setTimeout(() => {
                window.closeSidebar(); // Close mobile sidebar on any page load
            }, 100);

            // Admin panel security check
            if (window.location.pathname.includes('admin.html')) {
                const adminEmail = "mdnahidislam6714@gmail.com";
                onAuthStateChanged(auth, (user) => {
                    if (!user || user.email !== adminEmail) {
                        alert("Access Denied! You must be the admin to access this page.");
                        window.location.href = 'index.html'; // Redirect to home page
                    }
                });
            }
            














            // Load header and footer
            window.loadHTML('header.html', 'header-placeholder');
            window.loadHTML('footer.html', 'footer-placeholder');


    const shareButton = document.getElementById('shareButton');
    const socialIcons = document.getElementById('socialIcons');
    const closeShareButton = document.getElementById('closeShareButton');

    if (shareButton && socialIcons && closeShareButton) {
        shareButton.addEventListener('click', (event) => {
            event.stopPropagation();
            socialIcons.classList.remove('hidden');
            shareButton.classList.add('hidden');
        });

        closeShareButton.addEventListener('click', (event) => {
            event.stopPropagation();
            socialIcons.classList.add('hidden');
            shareButton.classList.remove('hidden');
        });
    }

    // Hide social icons if clicked outside
    document.addEventListener('click', (event) => {
        if (socialIcons && !socialIcons.classList.contains('hidden') && !socialIcons.contains(event.target) && !shareButton.contains(event.target)) {
            socialIcons.classList.add('hidden');
        }
    });

    window.addEventListener("scroll", () => {
        const mobileSearchBar = document.getElementById('mobileSearchBar');
        if (mobileSearchBar && !mobileSearchBar.classList.contains('hidden')) {
            closeMobileSearch();
        }
    });
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
            if (user) {
                // Fetch user role from Firebase and save to localStorage
                const userRef = ref(database, `users/${user.uid}`);
                get(userRef).then(snapshot => {
                    const userData = snapshot.val();
                    const userWithRole = { ...user, role: userData ? userData.role : 'user' };
                    localStorage.setItem('loggedInUser', JSON.stringify(userWithRole));
                    window.checkAdminAndShowUploadForm(userWithRole);
                });
            } else {
                localStorage.removeItem('loggedInUser');
                window.checkAdminAndShowUploadForm(null);
            }
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
        console.log("Initializing Order Track Page...");
        const loadingIndicator = document.getElementById('loadingIndicator');
        const loginPrompt = document.getElementById('loginPrompt');
        const orderTrackResult = document.getElementById('orderTrackResult');
        const noOrderFoundMessage = document.getElementById('noOrderFoundMessage');
        const phoneNumberSearchInput = document.getElementById('phoneNumberSearch');
        const searchByPhoneBtn = document.getElementById('searchByPhoneBtn');
        const orderDetailsModal = document.getElementById('orderDetailsModal');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const modalContent = document.getElementById('modalContent');

        // Initially hide all dynamic sections
        loadingIndicator.classList.add('hidden');
        loginPrompt.classList.add('hidden');
        orderTrackResult.classList.add('hidden');
        noOrderFoundMessage.classList.add('hidden');
        orderDetailsModal.classList.add('hidden');

        // Function to display orders
        const displayOrders = (orders) => {
            console.log("Displaying orders:", orders);
            orderTrackResult.innerHTML = '';
            if (orders.length === 0) {
                noOrderFoundMessage.textContent = "আপনার কোনো অর্ডার পাওয়া যায়নি।";
                noOrderFoundMessage.classList.remove('hidden');
                orderTrackResult.classList.add('hidden');
            } else {
                noOrderFoundMessage.classList.add('hidden');
                orderTrackResult.classList.remove('hidden');
                orders.forEach(order => {
                    const orderDiv = document.createElement('div');
                    orderDiv.className = "bg-white p-4 rounded-lg shadow-md mb-4 cursor-pointer";
                    orderDiv.innerHTML = `
                        <h3 class="text-xl font-bold text-lipstick mb-2">${order.items[0] ? order.items[0].name : 'অর্ডার'}</h3>
                        <p class="text-gray-700"><strong>স্ট্যাটাস:</strong> <span class="font-semibold text-green-600">${order.status}</span></p>
                        <p class="text-gray-700"><strong>মোট প্রদেয়:</strong> ${order.totalAmount} টাকা</p>
                    `;
                    orderDiv.addEventListener('click', () => {
                        console.log("Order summary clicked:", order.id);
                        showOrderDetailsModal(order);
                    });
                    orderTrackResult.appendChild(orderDiv);
                });
            }
        };

        // Function to show order details in modal
        const showOrderDetailsModal = (order) => {
            console.log("Showing modal for order:", order.id);
            console.log("Modal element:", orderDetailsModal);
            console.log("Modal content element:", modalContent);
            modalContent.innerHTML = `
                <p class="text-gray-700 mb-2"><strong>অর্ডার আইডি:</strong> ${order.id}</p>
                <p class="text-gray-700 mb-2"><strong>স্ট্যাটাস:</strong> <span class="font-semibold text-green-600">${order.status}</span></p>
                <p class="text-gray-700 mb-2"><strong>অর্ডার তারিখ:</strong> ${new Date(order.orderDate).toLocaleString('bn-BD')}</p>
                <p class="text-gray-700 mb-2"><strong>মোট প্রদেয়:</strong> ${order.totalAmount} টাকা</p>
                <p class="text-gray-700 mb-2"><strong>ডেলিভারি ঠিকানা:</strong> ${order.address}</p>
                <h4 class="font-semibold text-gray-800 mt-4 mb-2">অর্ডারকৃত পণ্যসমূহ:</h4>
                <ul class="list-disc list-inside">
                    ${order.items.map(item => `<li>
                        <a href="product-detail.html?id=${item.id}" class="flex items-center space-x-2 hover:text-blue-600">
                            <img src="${item.image ? item.image.split(',')[0] : 'https://via.placeholder.com/50'}" class="w-12 h-12 object-cover rounded-md" alt="${item.name}">
                            <span>${item.name} (পরিমাণ: ${item.quantity}, মূল্য: ${item.price} টাকা)</span>
                        </a>
                    </li>`).join('')}
                </ul>
            `;
            orderDetailsModal.classList.remove('hidden');
            console.log("Modal should be visible now.");
        };

        // Close modal event
        closeModalBtn.addEventListener('click', () => {
            console.log("Closing modal...");
            orderDetailsModal.classList.add('hidden');
        });
        orderDetailsModal.addEventListener('click', (event) => {
            if (event.target === orderDetailsModal) {
                console.log("Clicked outside modal, closing...");
                orderDetailsModal.classList.add('hidden');
            }
        });

        // Load orders from local storage (if any)
        const loadOrdersFromLocalStorage = async () => {
            console.log("Loading orders from local storage...");
            try {
                const savedOrderIds = JSON.parse(localStorage.getItem('userOrderIds')) || [];
                const orders = [];
                for (const orderId of savedOrderIds) {
                    const orderRef = ref(database, `orders/${orderId}`);
                    const snapshot = await get(orderRef);
                    if (snapshot.exists()) {
                        orders.push({ id: orderId, ...snapshot.val() });
                    }
                }
                return orders;
            } catch (error) {
                console.error("Error loading orders from local storage:", error);
                window.showToast("অর্ডার লোড করতে সমস্যা হয়েছে।", "error");
                return []; // Return empty array on error
            }
        };

        // Search orders by phone number
        const searchOrdersByPhoneNumber = async (phoneNumber) => {
            console.log("Searching orders by phone number:", phoneNumber);
            try {
                const ordersRef = ref(database, 'orders');
                const snapshot = await get(ordersRef);
                const allOrders = snapshot.exists() ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data })) : [];
                const filteredOrders = allOrders.filter(order => order.phoneNumber === phoneNumber);
                return filteredOrders;
            } catch (error) {
                console.error("ফোন নম্বর দিয়ে অর্ডার খুঁজতে সমস্যা হয়েছে:", error);
                window.showToast("অর্ডার খুঁজতে সমস্যা হয়েছে।", "error");
                return []; // Return empty array on error
            }
        };

        // Event listener for phone number search button
        if (searchByPhoneBtn) {
            searchByPhoneBtn.addEventListener('click', searchOrdersByPhoneNumber);
            console.log("Search by phone button event listener added.");
        }

        // Initial load based on login status or local storage
        if (auth.currentUser) {
            console.log("User is logged in, loading orders from local storage.");
            loadOrdersFromLocalStorage();
        } else {
            console.log("User is not logged in, attempting to load orders from local storage.");
            loadOrdersFromLocalStorage();
            // If no orders in local storage, then show login prompt
            if (JSON.parse(localStorage.getItem('userOrderIds'))?.length === 0) {
                loginPrompt.classList.remove('hidden');
                console.log("No orders in local storage, showing login prompt.");
            }
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
        // This ensures that user refreshes or navigates back, the buyNow product is still there.
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

            // Toggle visibility of payment fields based on delivery location
            const deliveryPaymentGroup = document.getElementById('deliveryPaymentGroup');
            const paymentNotice = document.getElementById('paymentNotice');
            const paymentNumberGroup = document.getElementById('paymentNumberGroup');
            const transactionIdGroup = document.getElementById('transactionIdGroup');

            if (selectedDeliveryLocation && selectedDeliveryLocation.value === 'outsideDhaka') {
                deliveryPaymentGroup.classList.remove('hidden');
                paymentNotice.classList.remove('hidden');
                paymentNumberGroup.classList.remove('hidden');
                transactionIdGroup.classList.remove('hidden');
            } else {
                deliveryPaymentGroup.classList.add('hidden');
                paymentNotice.classList.add('hidden');
                paymentNumberGroup.classList.add('hidden');
                transactionIdGroup.classList.add('hidden');
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

        // Add event listeners to delivery location radios
        deliveryLocationRadios.forEach(radio => {
            radio.addEventListener('change', updatePriceSummary);
        });

        // Initial call to update price summary and payment fields visibility
        updatePriceSummary();

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

    // Checkout Form Submission Handling
    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const customerName = document.getElementById('customerName').value;
            const phoneNumber = document.getElementById('phoneNumber').value;
            const address = document.getElementById('address').value;
            const deliveryLocation = document.querySelector('input[name="deliveryLocation"]:checked').value;
            const deliveryNote = document.getElementById('deliveryNote').value;
            const productPaymentMethod = document.getElementById('productPaymentMethod').value;

            let deliveryPaymentMethod = '';
            let paymentNumber = '';
            let transactionId = '';

            if (deliveryLocation === 'outsideDhaka') {
                deliveryPaymentMethod = document.getElementById('deliveryPaymentMethod').value;
                paymentNumber = document.getElementById('paymentNumber').value;
                transactionId = document.getElementById('transactionId').value;

                if (!deliveryPaymentMethod || !paymentNumber || !transactionId) {
                    window.showToast("ঢাকার বাইরের অর্ডারের জন্য ডেলিভারি চার্জ পেমেন্টের তথ্য পূরণ করুন।", "error");
                    return;
                }
            }

            if (!customerName || !phoneNumber || !address) {
                window.showToast("অনুগ্রহ করে সকল প্রয়োজনীয় ফিল্ড পূরণ করুন।", "error");
                return;
            }

            const orderData = {
                customerName,
                phoneNumber,
                address,
                deliveryLocation,
                deliveryNote,
                items: currentCartItems, // Assuming currentCartItems is globally available and updated
                totalAmount: parseFloat(document.getElementById('totalAmountDisplay').textContent.replace(' টাকা', '')),
                subTotal: parseFloat(document.getElementById('subTotalDisplay').textContent.replace(' টাকা', '')),
                deliveryFee: parseFloat(document.getElementById('deliveryFeeDisplay').textContent.replace(' টাকা', '')),
                productPaymentMethod,
                deliveryPaymentMethod: deliveryPaymentMethod || 'N/A',
                paymentNumber: paymentNumber || 'N/A',
                transactionId: transactionId || 'N/A',
                orderDate: new Date().toISOString(),
                status: 'Pending'
            };

            try {
                const newOrderRef = push(ref(database, 'orders'), orderData);
                const orderId = newOrderRef.key;

                // Save orderId to local storage for tracking
                let userOrderIds = JSON.parse(localStorage.getItem('userOrderIds')) || [];
                userOrderIds.push(orderId);
                localStorage.setItem('userOrderIds', JSON.stringify(userOrderIds));

                window.showToast("আপনার অর্ডার সফলভাবে কনফার্ম হয়েছে!", "success");
                checkoutForm.reset(); // Reset the form
                localStorage.removeItem('checkoutCartItems'); // Clear cart items after order
                currentCartItems = []; // Clear current cart items
                window.updateCartUI(); // Update cart UI

                // Show the order list link
                const orderListLink = document.getElementById('orderListLink');
                if (orderListLink) {
                    orderListLink.classList.remove('hidden');
                }

            } catch (error) {
                console.error("অর্ডার কনফার্ম করতে সমস্যা হয়েছে:", error);
                window.showToast("অর্ডার কনফার্ম করতে সমস্যা হয়েছে।", "error");
            }
        });
    }
});

// Dashboard Overview Functions
window.loadDashboardOverview = async function() {
    const totalProductsElement = document.querySelector('#dashboard-overview .text-lipstick');
    const pendingOrdersElement = document.querySelector('#dashboard-overview .text-yellow-500');
    const totalUsersElement = document.querySelector('#dashboard-overview .text-blue-500');

    if (!totalProductsElement || !pendingOrdersElement || !totalUsersElement) return;

    try {
        // Fetch total products
        const productsRef = ref(database, 'products');
        const productsSnapshot = await get(productsRef);
        const totalProducts = productsSnapshot.exists() ? Object.keys(productsSnapshot.val()).length : 0;
        totalProductsElement.textContent = totalProducts;

        // Fetch pending orders
        const ordersRef = ref(database, 'orders');
        const ordersSnapshot = await get(ordersRef);
        let pendingOrders = 0;
        if (ordersSnapshot.exists()) {
            Object.values(ordersSnapshot.val()).forEach(order => {
                if (order.status === 'Pending') {
                    pendingOrders++;
                }
            });
        }
        pendingOrdersElement.textContent = pendingOrders;

        // Fetch total users
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);
        const totalUsers = usersSnapshot.exists() ? Object.keys(usersSnapshot.val()).length : 0;
        totalUsersElement.textContent = totalUsers;

    } catch (error) {
        console.error("Error loading dashboard overview:", error);
        window.showToast('Failed to load dashboard data.', 'error');
    }
};

window.promoteToCoAdmin = async function(uid) {
    if (!confirm('Are you sure you want to promote this user to Co-Admin?')) return;
    try {
        const userRef = ref(database, `users/${uid}`);
        await set(userRef, { ... (await get(userRef)).val(), role: 'co-admin' });
        window.showToast('User promoted to Co-Admin successfully!');
        window.loadUsersForAdmin(); // Reload user list
    } catch (error) {
        console.error("Error promoting user:", error);
        window.showToast('Failed to promote user.', 'error');
    }
};

window.demoteFromCoAdmin = async function(uid) {
    if (!confirm('Are you sure you want to demote this user?')) return;
    try {
        const userRef = ref(database, `users/${uid}`);
        await set(userRef, { ... (await get(userRef)).val(), role: 'user' });
        window.showToast('User demoted successfully!');
        window.loadUsersForAdmin(); // Reload user list
    } catch (error) {
        console.error("Error demoting user:", error);
        window.showToast('Failed to demote user.', 'error');
    }
};

// Product Management Functions
window.loadProductsForAdmin = async function() {
    const productListDiv = document.getElementById('product-list-admin');
    if (!productListDiv) return;

    productListDiv.innerHTML = '<p>Loading products...</p>';

    try {
        const productsRef = ref(database, 'products');
        const snapshot = await get(productsRef);

        if (snapshot.exists()) {
            const products = Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }));
            productListDiv.innerHTML = `
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white rounded-lg shadow-md">
                        <thead>
                            <tr class="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                                <th class="py-3 px-6 text-left">Image</th>
                                <th class="py-3 px-6 text-left">Name</th>
                                <th class="py-3 px-6 text-left">Price</th>
                                <th class="py-3 px-6 text-left">Description</th>
                                <th class="py-3 px-6 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="text-gray-600 text-sm font-light">
                            ${products.map(product => `
                                <tr class="border-b border-gray-200 hover:bg-gray-100">
                                    <td class="py-3 px-6 text-left whitespace-nowrap">
                                        <img src="${product.image ? product.image.split(',')[0] : 'https://via.placeholder.com/50'}" class="w-12 h-12 object-cover rounded-md" alt="${product.name}">
                                    </td>
                                    <td class="py-3 px-6 text-left">${product.name}</td>
                                    <td class="py-3 px-6 text-left">৳ ${product.price}</td>
                                    <td class="py-3 px-6 text-left truncate max-w-xs">${product.description}</td>
                                    <td class="py-3 px-6 text-center">
                                        <button onclick="window.editProduct('${product.id}')" class="bg-yellow-500 text-white px-3 py-1 rounded text-xs hover:bg-yellow-600 mr-2">Edit</button>
                                        <button onclick="window.deleteProduct('${product.id}')" class="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            productListDiv.innerHTML = '<p>No products found.</p>';
        }
    } catch (error) {
        console.error("Error loading products for admin:", error);
        productListDiv.innerHTML = '<p class="text-red-500">Error loading products.</p>';
    }
};

window.editProduct = async function(productId) {
    const productEditModal = document.getElementById('productEditModal');
    const editProductId = document.getElementById('edit-product-id');
    const editProductName = document.getElementById('edit-product-name');
    const editProductDescription = document.getElementById('edit-product-description');
    const editProductPrice = document.getElementById('edit-product-price');
    const editProductImage = document.getElementById('edit-product-image');

    try {
        const productRef = ref(database, `products/${productId}`);
        const snapshot = await get(productRef);

        if (snapshot.exists()) {
            const product = snapshot.val();
            editProductId.value = productId;
            editProductName.value = product.name;
            editProductDescription.value = product.description;
            editProductPrice.value = product.price;
            editProductImage.value = product.image;
            productEditModal.classList.remove('hidden');
        } else {
            window.showToast('Product not found.', 'error');
        }
    } catch (error) {
        console.error("Error loading product for edit:", error);
        window.showToast('Failed to load product for edit.', 'error');
    }
};

window.closeProductEditModal = function() {
    document.getElementById('productEditModal').classList.add('hidden');
};

window.updateProduct = async function(event) {
    event.preventDefault();

    const productId = document.getElementById('edit-product-id').value;
    const productName = document.getElementById('edit-product-name').value;
    const productDescription = document.getElementById('edit-product-description').value;
    const productPrice = parseFloat(document.getElementById('edit-product-price').value);
    const productImage = document.getElementById('edit-product-image').value;

    if (!productName || !productDescription || isNaN(productPrice) || productPrice <= 0 || !productImage) {
        window.showToast("Please fill in all product details correctly.", "error");
        return;
    }

    const productData = {
        name: productName,
        description: productDescription,
        price: productPrice,
        image: productImage
    };

    try {
        const productRef = ref(database, `products/${productId}`);
        await update(productRef, productData);
        window.showToast('Product updated successfully!');
        window.closeProductEditModal();
        window.loadProductsForAdmin(); // Reload product list after update
    } catch (error) {
        console.error("Error updating product:", error);
        window.showToast('Failed to update product.', 'error');
    }
};

window.deleteProduct = async function(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
        const productRef = ref(database, `products/${productId}`);
        await set(productRef, null); // Set to null to delete
        window.showToast('Product deleted successfully!');
        window.loadProductsForAdmin(); // Reload product list
    } catch (error) {
        console.error("Error deleting product:", error);
        window.showToast('Failed to delete product.', 'error');
    }
};

window.handleProductUpload = async function(event) {
    event.preventDefault();

    const productName = document.getElementById('product-name').value;
    const productDescription = document.getElementById('product-description').value;
    const productPrice = parseFloat(document.getElementById('product-price').value);
    const productImage = document.getElementById('product-image').value;

    if (!productName || !productDescription || isNaN(productPrice) || productPrice <= 0 || !productImage) {
        window.showToast("Please fill in all product details correctly.", "error");
        return;
    }

    const productData = {
        name: productName,
        description: productDescription,
        price: productPrice,
        image: productImage,
        createdAt: new Date().toISOString()
    };

    try {
        await push(ref(database, 'products'), productData);
        window.showToast('Product uploaded successfully!');
        document.getElementById('product-upload-form').reset(); // Clear the form
        window.loadProductsForAdmin(); // Reload product list after upload
    } catch (error) {
        console.error("Error uploading product:", error);
        window.showToast('Failed to upload product.', 'error');
    }
};

window.loadAllOrdersForAdmin = async function() {
    const orderListContainer = document.getElementById('order-list-admin');
    if (!orderListContainer) return;

    orderListContainer.innerHTML = '<p>Loading orders...</p>';

    try {
        const ordersRef = ref(database, 'orders');
        const snapshot = await get(ordersRef);

        if (snapshot.exists()) {
            const orders = snapshot.val();
            orderListContainer.innerHTML = `
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white rounded-lg shadow-md">
                        <thead>
                            <tr class="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                                <th class="py-3 px-6 text-left">Order ID</th>
                                <th class="py-3 px-6 text-left">Customer</th>
                                <th class="py-3 px-6 text-left">Phone</th>
                                <th class="py-3 px-6 text-left">Total</th>
                                <th class="py-3 px-6 text-left">Date</th>
                                <th class="py-3 px-6 text-left">Status</th>
                                <th class="py-3 px-6 text-center">Details</th>
                            </tr>
                        </thead>
                        <tbody class="text-gray-600 text-sm font-light">
                            ${Object.entries(orders).map(([orderId, order]) => `
                                <tr class="border-b border-gray-200 hover:bg-gray-100">
                                    <td class="py-3 px-6 text-left">${orderId}</td>
                                    <td class="py-3 px-6 text-left">${order.customerName}</td>
                                    <td class="py-3 px-6 text-left">${order.phoneNumber}</td>
                                    <td class="py-3 px-6 text-left">৳ ${order.totalAmount}</td>
                                    <td class="py-3 px-6 text-left">${new Date(order.orderDate).toLocaleDateString('bn-BD')}</td>
                                    <td class="py-3 px-6 text-left">
                                        <select id="status-${orderId}" onchange="window.updateOrderStatus('${orderId}', this.value)" class="p-2 border rounded-md">
                                            <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                            <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
                                            <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                                            <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                                            <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                                        </select>
                                    </td>
                                    <td class="py-3 px-6 text-center">
                                        <button onclick="window.showOrderDetailsModalAdmin('${orderId}')" class="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600">View</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            orderListContainer.innerHTML = '<p>No orders found.</p>';
        }
    } catch (error) {
        console.error("Error loading orders for admin:", error);
        orderListContainer.innerHTML = '<p class="text-red-500">Error loading orders.</p>';
    }
};

window.showOrderDetailsModalAdmin = async function(orderId) {
    const orderDetailsModal = document.getElementById('orderDetailsModalAdmin');
    const modalContent = document.getElementById('orderDetailsModalAdminContent');
    if (!orderDetailsModal || !modalContent) return;

    try {
        const orderRef = ref(database, `orders/${orderId}`);
        const snapshot = await get(orderRef);

        if (snapshot.exists()) {
            const order = snapshot.val();
            modalContent.innerHTML = `
                <h3 class="text-xl font-bold mb-4">Order Details (ID: ${orderId})</h3>
                <p><strong>Customer Name:</strong> ${order.customerName}</p>
                <p><strong>Phone Number:</strong> ${order.phoneNumber}</p>
                <p><strong>Address:</strong> ${order.address}</p>
                <p><strong>Delivery Location:</strong> ${order.deliveryLocation}</p>
                <p><strong>Delivery Note:</strong> ${order.deliveryNote || 'N/A'}</p>
                <p><strong>Product Payment Method:</strong> ${order.productPaymentMethod}</p>
                <p><strong>Delivery Payment Method:</strong> ${order.deliveryPaymentMethod}</p>
                <p><strong>Payment Number:</strong> ${order.paymentNumber}</p>
                <p><strong>Transaction ID:</strong> ${order.transactionId}</p>
                <p><strong>Sub Total:</strong> ৳ ${order.subTotal}</p>
                <p><strong>Delivery Fee:</strong> ৳ ${order.deliveryFee}</p>
                <p><strong>Total Amount:</strong> ৳ ${order.totalAmount}</p>
                <p><strong>Order Date:</strong> ${new Date(order.orderDate).toLocaleString('bn-BD')}</p>
                <p><strong>Status:</strong> ${order.status}</p>
                <h4 class="font-semibold mt-4 mb-2">Items:</h4>
                <ul class="list-disc list-inside">
                    ${order.items.map(item => `<li>${item.name} (Qty: ${item.quantity}, Price: ৳ ${item.price})</li>`).join('')}
                </ul>
            `;
            orderDetailsModal.classList.remove('hidden');
        } else {
            window.showToast('Order not found.', 'error');
        }
    } catch (error) {
        console.error("Error loading order details:", error);
        window.showToast('Failed to load order details.', 'error');
    }
};

window.updateOrderStatus = async function(orderId, newStatus) {
    if (!confirm(`Are you sure you want to change status of Order ${orderId} to ${newStatus}?`)) return;
    try {
        const orderRef = ref(database, `orders/${orderId}`);
        await update(orderRef, { status: newStatus }); // Use update instead of set
        window.showToast('Order status updated successfully!');
        // No need to reload all orders, as Firebase's onValue listener will update if used
        // For now, we'll just show toast. If onValue is not used, then reloadAllOrdersForAdmin()
    } catch (error) {
        console.error("Error updating order status:", error);
        window.showToast('Failed to update order status.', 'error');
    }
};

window.updateOrderStatus = async function(orderId, newStatus) {
    if (!confirm(`Are you sure you want to change status of Order ${orderId} to ${newStatus}?`)) return;
    try {
        const orderRef = ref(database, `orders/${orderId}`);
        await set(orderRef, { ... (await get(orderRef)).val(), status: newStatus });
        window.showToast('Order status updated successfully!');
        // No need to reload all orders, as Firebase's onValue listener will update if used
        // For now, we'll just show toast. If onValue is not used, then reloadAllOrdersForAdmin()
    } catch (error) {
        console.error("Error updating order status:", error);
        window.showToast('Failed to update order status.', 'error');
    }
};