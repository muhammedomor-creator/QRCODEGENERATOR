
// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCustomToken, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase App Config with your provided Keys
const firebaseConfig = {
    apiKey: "AIzaSyAtxWWl7Xhy4ueVfQ6TSDiadfx5K_Mo4Dg",
    authDomain: "qrcodegeneratordynamic.firebaseapp.com",
    projectId: "qrcodegeneratordynamic",
    storageBucket: "qrcodegeneratordynamic.firebasestorage.app",
    messagingSenderId: "772697258868",
    appId: "1:772697258868:web:8973b097d1a39db9310a21"
};

// Start Engines
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'scanflow-premium-app';

// Local Variables
let currentUser = null;
let authMode = 'login';
let currentQRStylingInstance = null;
let myQrCodesList = [];
let uploadedLogoBase64 = ""; // Holds base64 of custom uploaded image logo
const CONFIG_PUBLIC_COLL = "qrcodes";

// Toast Notification Manager
function showNotification(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    
    toastMsg.innerText = message;
    
    if (type === 'success') {
        toastIcon.innerHTML = '<i class="fas fa-check-circle text-emerald-400"></i>';
        toast.firstElementChild.className = "premium-bg text-white px-5 py-4 rounded-xl shadow-2xl flex items-center space-x-3.5 border-l-2 border-emerald-500 premium-border";
    } else if (type === 'error') {
        toastIcon.innerHTML = '<i class="fas fa-exclamation-triangle text-rose-400"></i>';
        toast.firstElementChild.className = "premium-bg text-white px-5 py-4 rounded-xl shadow-2xl flex items-center space-x-3.5 border-l-2 border-rose-500 premium-border";
    } else {
        toastIcon.innerHTML = '<i class="fas fa-info-circle text-indigo-400"></i>';
        toast.firstElementChild.className = "premium-bg text-white px-5 py-4 rounded-xl shadow-2xl flex items-center space-x-3.5 border-l-2 border-indigo-500 premium-border";
    }

    toast.classList.remove('opacity-0', 'translate-y-[-100px]');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-[-100px]');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, 4000);
}

// Router State Changer
function switchView(viewName) {
    const views = {
        loading: document.getElementById('view-loading'),
        auth: document.getElementById('view-auth'),
        dashboard: document.getElementById('view-dashboard'),
        scan: document.getElementById('view-public-scan')
    };

    Object.values(views).forEach(view => view.classList.add('hidden'));
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
    }

    const header = document.getElementById('app-header');
    if (viewName === 'scan') {
        header.classList.add('hidden');
    } else {
        header.classList.remove('hidden');
    }
}

// Check scan URL query parameters
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Start Auth Mechanism
async function setupAuthSystem() {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        }
    } catch (err) {
        console.warn("Standard flow running without Custom Token.");
    }

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        updateAuthStateUI();

        const qrRedirectId = getQueryParam('id');
        if (qrRedirectId) {
            loadPublicQRDetails(qrRedirectId);
        } else {
            if (user) {
                switchView('dashboard');
                startRealtimeQRListener();
            } else {
                switchView('auth');
            }
        }
    });
}

// Update Topbar Profiles info
function updateAuthStateUI() {
    const container = document.getElementById('auth-state-area');
    if (currentUser) {
        const displayName = currentUser.displayName || currentUser.email.split('@')[0];
        const avatar = currentUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundType=gradientLinear`;
        
        container.innerHTML = `
            <div class="flex items-center space-x-3 bg-slate-900/40 px-3 py-1.5 rounded-lg border border-white/5">
                <img src="${avatar}" class="w-6 h-6 rounded-full border border-indigo-500/30" alt="profile">
                <div class="hidden md:block text-left">
                    <h4 class="text-xs font-bold text-slate-200">${displayName}</h4>
                    <p class="text-[8px] text-indigo-400 font-mono tracking-wider font-semibold">ENTERPRISE</p>
                </div>
                <button id="btn-logout" class="text-slate-500 hover:text-rose-400 p-1 transition-colors">
                    <i class="fas fa-sign-out-alt text-xs"></i>
                </button>
            </div>
        `;

        document.getElementById('btn-logout').addEventListener('click', async () => {
            await signOut(auth);
            showNotification('লগআউট সফল হয়েছে!', 'info');
            window.location.search = '';
        });
    } else {
        container.innerHTML = `
            <span class="text-[10px] text-slate-500 font-semibold uppercase tracking-widest flex items-center gap-1">
                <i class="fas fa-shield-alt text-[9px]"></i> SECURED ZONE
            </span>
        `;
    }
}

// Public scanning target visualizer
async function loadPublicQRDetails(id) {
    switchView('loading');
    try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PUBLIC_COLL, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            switchView('scan');

            const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            document.getElementById('public-scan-time').innerText = new Date(data.updatedAt || data.createdAt).toLocaleDateString('bn-BD', options);

            const content = data.content || "";
            const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
            const isUrl = urlPattern.test(content.trim());

            if (isUrl) {
                let finalUrl = content.trim();
                if (!/^https?:\/\//i.test(finalUrl)) {
                    finalUrl = 'https://' + finalUrl;
                }
                document.getElementById('public-content-icon').className = "fas fa-globe text-lg text-emerald-400";
                document.getElementById('public-link-wrapper').classList.remove('hidden');
                document.getElementById('public-text-wrapper').classList.add('hidden');
                document.getElementById('public-url-preview').innerText = finalUrl;
                document.getElementById('btn-public-redirect').href = finalUrl;
            } else {
                document.getElementById('public-content-icon').className = "fas fa-quote-right text-lg text-indigo-400";
                document.getElementById('public-text-wrapper').classList.remove('hidden');
                document.getElementById('public-link-wrapper').classList.add('hidden');
                document.getElementById('public-text-content').innerText = content;
            }
        } else {
            showNotification('কিউআর কোডটি সার্ভার থেকে ডিলিট করা হয়েছে!', 'error');
        }
    } catch (err) {
        showNotification('সার্ভার জটিলতা তৈরি হয়েছে!', 'error');
    }
}

// Listening database items in real-time
function startRealtimeQRListener() {
    if (!currentUser) return;

    const qrcodesQuery = query(collection(db, 'artifacts', appId, 'public', 'data', CONFIG_PUBLIC_COLL));

    onSnapshot(qrcodesQuery, (snapshot) => {
        myQrCodesList = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.userId === currentUser.uid) {
                myQrCodesList.push({ id: doc.id, ...data });
            }
        });
        document.getElementById('qr-count-badge').innerText = myQrCodesList.length;
        renderQRCodesList();
    }, (error) => {
        showNotification("ডেটাবেজ কানেকশন করতে সমস্যা হচ্ছে।", "error");
    });
}

// Render dynamic lists
function renderQRCodesList() {
    const listContainer = document.getElementById('qr-list-container');
    const searchVal = document.getElementById('search-qr').value.toLowerCase();
    const filtered = myQrCodesList.filter(item => 
        (item.title && item.title.toLowerCase().includes(searchVal)) || 
        (item.content && item.content.toLowerCase().includes(searchVal))
    );

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-10 text-slate-600">
                <i class="fas fa-qrcode text-xl mb-2 block opacity-20"></i>
                <p class="text-[10px] uppercase font-bold tracking-wider">Empty Collection</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = '';
    filtered.forEach(item => {
        const card = document.createElement('div');
        const activeId = document.getElementById('edit-qr-id').value;
        const isActive = activeId === item.id;
        card.className = `sidebar-card p-3 rounded-lg cursor-pointer flex justify-between items-center group relative overflow-hidden ${isActive ? 'active-card' : ''}`;
        card.setAttribute('data-id', item.id);
        
        const scanLink = `${window.location.origin}${window.location.pathname}?id=${item.id}`;

        card.innerHTML = `
            <div class="space-y-0.5 pr-4 flex-grow truncate">
                <div class="flex items-center space-x-2">
                    <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${item.color || '#00ffff'}"></span>
                    <h4 class="text-xs font-bold text-slate-300 truncate">${item.title || 'Untitled'}</h4>
                </div>
                <p class="text-[10px] text-slate-500 truncate">${item.content}</p>
            </div>
            <div class="flex items-center space-x-1 z-10">
                <button class="btn-copy-link p-1 text-slate-500 hover:text-indigo-400 transition-colors" data-link="${scanLink}">
                    <i class="fas fa-link text-[10px]"></i>
                </button>
                <button class="btn-delete-qr p-1 text-slate-500 hover:text-rose-400 transition-colors" data-id="${item.id}">
                    <i class="fas fa-trash-alt text-[10px]"></i>
                </button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-copy-link') || e.target.closest('.btn-delete-qr')) return;
            openQREditor(item);
        });

        listContainer.appendChild(card);
    });

    // Copy links action
    document.querySelectorAll('.btn-copy-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const link = btn.getAttribute('data-link');
            const temp = document.createElement('input');
            temp.value = link;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            showNotification('ডাইনামিক কিউআর লিঙ্ক কপি হয়েছে!', 'success');
        });
    });

    // Delete dynamic qr items
    document.querySelectorAll('.btn-delete-qr').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const confirmDel = confirm('আপনি কি এই কিউআর কোডটি চিরতরে ডিলিট করতে চান? প্রিন্ট করা কিউআর কোড কিন্তু অকেজো হয়ে যাবে!');
            if (confirmDel) {
                const docRef = doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PUBLIC_COLL, id);
                await deleteDoc(docRef);
                showNotification('কিউআর কোড ডিলিট সম্পন্ন!', 'success');
                if (document.getElementById('edit-qr-id').value === id) {
                    resetCreatorForm();
                }
            }
        });
    });
}

// Premium Live QR Renderer Engine (SAVES SOLID BACKGROUND & SAFE PADDING)
function updateLiveQRPreview() {
    const container = document.getElementById('qr-preview-container');
    container.innerHTML = '';

    const fgColor = document.getElementById('qr-color-foreground').value;
    const bgColor = document.getElementById('qr-color-background').value;
    const dotType = document.getElementById('qr-style-dots').value;
    const cornerType = document.getElementById('qr-style-corners').value;
    const paddingVal = parseInt(document.getElementById('qr-padding').value, 10);
    const iconType = document.getElementById('qr-icon-type').value;

    const activeId = document.getElementById('edit-qr-id').value || 'placeholder';
    const previewUrl = `${window.location.origin}${window.location.pathname}?id=${activeId}`;

    // Construct configurations
    const qrConfig = {
        width: 180,
        height: 180,
        type: "svg", // Render as high-fidelity SVG inside preview
        data: previewUrl,
        margin: paddingVal, // Strict safe margin configuration
        dotsOptions: { color: fgColor, type: dotType },
        backgroundOptions: { color: bgColor }, // Pure solid background color configuration
        cornersSquareOptions: { color: fgColor, type: cornerType },
        cornersDotOptions: { color: fgColor, type: dotType },
        imageOptions: { crossOrigin: "anonymous", margin: 3, imageSize: 0.4 }
    };

    currentQRStylingInstance = new QRCodeStyling(qrConfig);

    // Apply icon rules dynamically
    if (iconType === 'emoji') {
        const logoEmoji = document.getElementById('qr-custom-emoji-input').value.trim() || "⭐";
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.font = '84px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(logoEmoji, 64, 64);
        currentQRStylingInstance.update({ image: canvas.toDataURL() });
    } else if (iconType === 'upload' && uploadedLogoBase64) {
        currentQRStylingInstance.update({ image: uploadedLogoBase64 });
    }

    currentQRStylingInstance.append(container);
}

// Open Editor window
function openQREditor(item = null) {
    document.getElementById('welcome-panel').classList.add('hidden');
    document.getElementById('creator-panel').classList.remove('hidden');

    if (item) {
        document.getElementById('creator-title').innerText = `সম্পাদনা: ${item.title}`;
        document.getElementById('edit-qr-id').value = item.id;
        document.getElementById('qr-input-title').value = item.title || "";
        document.getElementById('qr-input-content').value = item.content || "";
        document.getElementById('qr-color-foreground').value = item.color || "#00ffff";
        document.getElementById('qr-color-foreground-hex').value = item.color || "#00ffff";
        document.getElementById('qr-color-background').value = item.bgColor || "#ffffff";
        document.getElementById('qr-color-background-hex').value = item.bgColor || "#ffffff";
        document.getElementById('qr-style-dots').value = item.dotType || "dots";
        document.getElementById('qr-style-corners').value = item.cornerType || "extra-rounded";
        document.getElementById('qr-padding').value = item.padding || "15";
        
        // Restore custom logo upload or emoji inputs safely
        if (item.logoType === 'upload' && item.uploadedLogo) {
            document.getElementById('qr-icon-type').value = 'upload';
            uploadedLogoBase64 = item.uploadedLogo;
            document.getElementById('upload-custom-area').classList.remove('hidden');
            document.getElementById('emoji-custom-area').classList.add('hidden');
            document.getElementById('upload-preview-meta').classList.remove('hidden');
            document.getElementById('upload-file-name').innerText = "সংরক্ষিত কাস্টম লোগো";
        } else if (item.logoType === 'emoji') {
            document.getElementById('qr-icon-type').value = 'emoji';
            document.getElementById('qr-custom-emoji-input').value = item.emojiVal || "⭐";
            document.getElementById('emoji-custom-area').classList.remove('hidden');
            document.getElementById('upload-custom-area').classList.add('hidden');
            uploadedLogoBase64 = "";
        } else {
            document.getElementById('qr-icon-type').value = 'none';
            document.getElementById('emoji-custom-area').classList.add('hidden');
            document.getElementById('upload-custom-area').classList.add('hidden');
            uploadedLogoBase64 = "";
        }

        document.getElementById('save-btn-text').innerText = "আপডেট করুন";
    } else {
        resetCreatorForm();
    }
    updateLiveQRPreview();
}

function resetCreatorForm() {
    document.getElementById('creator-title').innerText = "নতুন ডাইনামিক কিউআর কাস্টমাইজেশন";
    document.getElementById('edit-qr-id').value = '';
    document.getElementById('qr-input-title').value = '';
    document.getElementById('qr-input-content').value = '';
    document.getElementById('qr-color-foreground').value = '#00ffff';
    document.getElementById('qr-color-foreground-hex').value = '#00ffff';
    document.getElementById('qr-color-background').value = '#ffffff';
    document.getElementById('qr-color-background-hex').value = '#ffffff';
    document.getElementById('qr-style-dots').value = 'dots';
    document.getElementById('qr-style-corners').value = 'extra-rounded';
    document.getElementById('qr-padding').value = '15';
    document.getElementById('qr-icon-type').value = 'none';
    document.getElementById('qr-custom-emoji-input').value = '';
    document.getElementById('emoji-custom-area').classList.add('hidden');
    document.getElementById('upload-custom-area').classList.add('hidden');
    document.getElementById('upload-preview-meta').classList.add('hidden');
    document.getElementById('qr-logo-upload-file').value = "";
    uploadedLogoBase64 = "";
    document.getElementById('save-btn-text').innerText = "পাবলিশ করুন";
    updateLiveQRPreview();
}

// Handle Custom Logo Upload File reader base64 conversion
function handleLogoUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedLogoBase64 = e.target.result;
        document.getElementById('upload-preview-meta').classList.remove('hidden');
        document.getElementById('upload-file-name').innerText = file.name;
        updateLiveQRPreview();
        showNotification('কাস্টম ইমেজ লোগো সফলভাবে লোড হয়েছে!', 'success');
    };
    reader.readAsDataURL(file);
}

// UI Event Listeners Binder
function initAppEvents() {
    document.getElementById('search-qr').addEventListener('input', renderQRCodesList);

    // Dynamic icon switcher layout logic
    document.getElementById('qr-icon-type').addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'emoji') {
            document.getElementById('emoji-custom-area').classList.remove('hidden');
            document.getElementById('upload-custom-area').classList.add('hidden');
        } else if (val === 'upload') {
            document.getElementById('upload-custom-area').classList.remove('hidden');
            document.getElementById('emoji-custom-area').classList.add('hidden');
        } else {
            document.getElementById('emoji-custom-area').classList.add('hidden');
            document.getElementById('upload-custom-area').classList.add('hidden');
        }
        updateLiveQRPreview();
    });

    // Preset Emojis trigger
    document.querySelectorAll('.btn-emoji-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-val');
            document.getElementById('qr-custom-emoji-input').value = val;
            updateLiveQRPreview();
        });
    });

    // Custom emoji typed input trigger
    document.getElementById('qr-custom-emoji-input').addEventListener('input', () => {
        updateLiveQRPreview();
    });

    // Custom Image Logo Upload file listener
    document.getElementById('qr-logo-upload-file').addEventListener('change', (e) => {
        handleLogoUpload(e.target.files[0]);
    });

    // Remove uploaded logo icon
    document.getElementById('btn-remove-uploaded-logo').addEventListener('click', () => {
        uploadedLogoBase64 = "";
        document.getElementById('qr-logo-upload-file').value = "";
        document.getElementById('upload-preview-meta').classList.add('hidden');
        updateLiveQRPreview();
        showNotification('কাস্টম ইমেজ রিমুভ করা হয়েছে।');
    });

    // Configuration live state changes observer
    const configFields = ['qr-color-foreground', 'qr-color-background', 'qr-style-dots', 'qr-style-corners', 'qr-padding'];
    configFields.forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            if (id === 'qr-color-foreground') document.getElementById('qr-color-foreground-hex').value = document.getElementById(id).value;
            if (id === 'qr-color-background') document.getElementById('qr-color-background-hex').value = document.getElementById(id).value;
            updateLiveQRPreview();
        });
    });

    // Hex Manual adjustments
    document.getElementById('qr-color-foreground-hex').addEventListener('input', (e) => {
        const val = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            document.getElementById('qr-color-foreground').value = val;
            updateLiveQRPreview();
        }
    });
    document.getElementById('qr-color-background-hex').addEventListener('input', (e) => {
        const val = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            document.getElementById('qr-color-background').value = val;
            updateLiveQRPreview();
        }
    });

    document.getElementById('btn-open-creator').addEventListener('click', () => openQREditor(null));
    document.getElementById('btn-close-creator').addEventListener('click', () => {
        document.getElementById('creator-panel').classList.add('hidden');
        document.getElementById('welcome-panel').classList.remove('hidden');
    });

    // Auth Login vs Signup
    document.getElementById('tab-login').addEventListener('click', () => {
        authMode = 'login';
        document.getElementById('tab-login').className = "w-1/2 py-2 text-xs font-bold rounded text-white bg-indigo-600/90 shadow transition-all";
        document.getElementById('tab-register').className = "w-1/2 py-2 text-xs font-bold rounded text-slate-400 hover:text-white transition-all";
        document.getElementById('name-field-group').classList.add('hidden');
    });

    document.getElementById('tab-register').addEventListener('click', () => {
        authMode = 'register';
        document.getElementById('tab-register').className = "w-1/2 py-2 text-xs font-bold rounded text-white bg-indigo-600/90 shadow transition-all";
        document.getElementById('tab-login').className = "w-1/2 py-2 text-xs font-bold rounded text-slate-400 hover:text-white transition-all";
        document.getElementById('name-field-group').classList.remove('hidden');
    });

    // Email/Password entries signin trigger
    document.getElementById('auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const name = document.getElementById('auth-name').value;

        switchView('loading');
        try {
            if (authMode === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
                showNotification('সাফল্যজনক লগইন সম্পন্ন হয়েছে!', 'success');
            } else {
                const creds = await createUserWithEmailAndPassword(auth, email, password);
                if (name) {
                    creds.user.displayName = name;
                }
                showNotification('রেজিস্ট্রেশন সম্পূর্ণ হয়েছে!', 'success');
            }
        } catch (error) {
            switchView('auth');
            showNotification('অথেন্টিকেশন ব্যর্থ: ' + error.message, 'error');
        }
    });

    // Google SignIn trigger button
    document.getElementById('btn-google-login').addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        switchView('loading');
        try {
            await signInWithPopup(auth, provider);
            showNotification('গুগল লগইন সফল হয়েছে!', 'success');
        } catch (error) {
            switchView('auth');
            showNotification('গুগল লগইন ব্যর্থ: ' + error.message, 'error');
        }
    });

    // Save/Publish dynamic payload trigger
    document.getElementById('btn-save-qr').addEventListener('click', async () => {
        const title = document.getElementById('qr-input-title').value.trim();
        const content = document.getElementById('qr-input-content').value.trim();
        
        if (!title || !content) {
            showNotification('দয়া করে টাইটেল এবং কিউআর কনটেন্ট পূরণ করুন!', 'error');
            return;
        }

        const fgColor = document.getElementById('qr-color-foreground').value;
        const bgColor = document.getElementById('qr-color-background').value;
        const dotType = document.getElementById('qr-style-dots').value;
        const cornerType = document.getElementById('qr-style-corners').value;
        const paddingVal = document.getElementById('qr-padding').value;
        const iconType = document.getElementById('qr-icon-type').value;
        const existingId = document.getElementById('edit-qr-id').value;

        if (!currentUser) return;

        const qrId = existingId || crypto.randomUUID();
        const payload = {
            userId: currentUser.uid,
            title: title,
            content: content,
            color: fgColor,
            bgColor: bgColor,
            dotType: dotType,
            cornerType: cornerType,
            padding: paddingVal,
            logoType: iconType,
            updatedAt: Date.now()
        };

        // Conditional additions for custom central icon logic
        if (iconType === 'upload' && uploadedLogoBase64) {
            payload.uploadedLogo = uploadedLogoBase64;
        } else if (iconType === 'emoji') {
            payload.emojiVal = document.getElementById('qr-custom-emoji-input').value.trim() || "⭐";
        }

        if (!existingId) {
            payload.createdAt = Date.now();
        }

        try {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PUBLIC_COLL, qrId);
            await setDoc(docRef, payload, { merge: true });
            
            showNotification('কিউআর ফাইলটি সুরক্ষিতভাবে ডেটাবেজে সেভ হয়েছে!', 'success');
            document.getElementById('creator-panel').classList.add('hidden');
            document.getElementById('welcome-panel').classList.remove('hidden');
        } catch (err) {
            showNotification('সেভ করতে সমস্যা হয়েছে: ' + err.message, 'error');
        }
    });

    // Image PNG Downloader trigger
    document.getElementById('btn-download-qr').addEventListener('click', () => {
        if (currentQRStylingInstance) {
            const title = document.getElementById('qr-input-title').value || 'dynamic-qr';
            const cleanTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            
            // To guarantee that background options are preserved and NO transparency issue occurs,
            // we configure the exact same specifications inside the download wrapper.
            currentQRStylingInstance.download({ 
                name: `${cleanTitle}-scanflow-pro`, 
                extension: "png"
            });
            showNotification('হাই-কোয়ালিটি PNG ডাউনলোড শুরু হয়েছে!', 'success');
        }
    });

    // Copy public page data clipboard handler
    document.getElementById('btn-copy-public-text').addEventListener('click', () => {
        const text = document.getElementById('public-text-content').innerText;
        const temp = document.createElement('textarea');
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        showNotification('টেক্সট কপি করা হয়েছে!', 'success');
    });
}

// Start
window.addEventListener('DOMContentLoaded', () => {
    initAppEvents();
    setupAuthSystem();
});
