
// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCustomToken, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase App Config
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
        toastIcon.innerHTML = '<i class="fas fa-check-circle text-emerald-500"></i>';
        toast.firstElementChild.className = "bg-white text-slate-800 px-5 py-4 rounded-xl shadow-2xl flex items-center space-x-3.5 border-l-4 border-emerald-500 premium-border";
    } else if (type === 'error') {
        toastIcon.innerHTML = '<i class="fas fa-exclamation-triangle text-rose-500"></i>';
        toast.firstElementChild.className = "bg-white text-slate-800 px-5 py-4 rounded-xl shadow-2xl flex items-center space-x-3.5 border-l-4 border-rose-500 premium-border";
    } else {
        toastIcon.innerHTML = '<i class="fas fa-info-circle text-indigo-600"></i>';
        toast.firstElementChild.className = "bg-white text-slate-800 px-5 py-4 rounded-xl shadow-2xl flex items-center space-x-3.5 border-l-4 border-indigo-600 premium-border";
    }

    toast.classList.remove('opacity-0', 'translate-y-[-100px]');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-[-100px]');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, 4000);
}

// Router View State Changer
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
        console.warn("Standard auth flow starting.");
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
            <div class="flex items-center space-x-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                <img src="${avatar}" class="w-6.5 h-6.5 rounded-full border border-indigo-500/20" alt="profile">
                <div class="hidden md:block text-left">
                    <h4 class="text-xs font-bold text-slate-800">${displayName}</h4>
                    <p class="text-[8px] text-indigo-600 font-mono tracking-wider font-extrabold">PREMIUM</p>
                </div>
                <button id="btn-logout" class="text-slate-400 hover:text-rose-500 p-1 transition-colors">
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
            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <i class="fas fa-shield-alt text-[9px] text-indigo-600"></i> SECURED PORTAL
            </span>
        `;
    }
}

// Public scanning target visualizer with INSTANT AUTO-REDIRECT BYPASS
async function loadPublicQRDetails(id) {
    switchView('loading');
    try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PUBLIC_COLL, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const content = data.content || "";
            
            // Check if content inside QR is a valid Web URL
            const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
            const isUrl = urlPattern.test(content.trim());

            if (isUrl) {
                let finalUrl = content.trim();
                if (!/^https?:\/\//i.test(finalUrl)) {
                    finalUrl = 'https://' + finalUrl;
                }
                window.location.replace(finalUrl);
                return; 
            } else {
                switchView('scan');
                const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                document.getElementById('public-scan-time').innerText = new Date(data.updatedAt || data.createdAt).toLocaleDateString('bn-BD', options);
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

// Render lists
function renderQRCodesList() {
    const listContainer = document.getElementById('qr-list-container');
    const searchVal = document.getElementById('search-qr').value.toLowerCase();
    const filtered = myQrCodesList.filter(item => 
        (item.title && item.title.toLowerCase().includes(searchVal)) || 
        (item.content && item.content.toLowerCase().includes(searchVal))
    );

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-10 text-slate-400">
                <i class="fas fa-qrcode text-xl mb-2 block opacity-30"></i>
                <p class="text-[10px] uppercase font-extrabold tracking-wider">Empty Collection</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = '';
    filtered.forEach(item => {
        const card = document.createElement('div');
        const activeId = document.getElementById('edit-qr-id').value;
        const isActive = activeId === item.id;
        card.className = `sidebar-card p-4 rounded-xl cursor-pointer flex justify-between items-center group relative overflow-hidden ${isActive ? 'active-card' : ''}`;
        card.setAttribute('data-id', item.id);
        
        const scanLink = `${window.location.origin}${window.location.pathname}?id=${item.id}`;

        card.innerHTML = `
            <div class="space-y-1 pr-4 flex-grow truncate">
                <div class="flex items-center space-x-2">
                    <span class="w-2 h-2 rounded-full" style="background-color: ${item.color || '#4f46e5'}"></span>
                    <h4 class="text-xs font-bold text-slate-800 truncate">${item.title || 'Untitled'}</h4>
                </div>
                <p class="text-[10px] text-slate-500 truncate">${item.content}</p>
                <span class="text-[8px] px-1.5 py-0.5 rounded bg-slate-100 text-indigo-600 font-mono font-bold tracking-wider uppercase">${item.qrType || 'dynamic'}</span>
            </div>
            <div class="flex items-center space-x-1.5 z-10">
                <button class="btn-copy-link p-1 text-slate-400 hover:text-indigo-600 transition-colors" data-link="${scanLink}">
                    <i class="fas fa-link text-[10px]"></i>
                </button>
                <button class="btn-delete-qr p-1 text-slate-400 hover:text-rose-600 transition-colors" data-id="${item.id}">
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
            const confirmDel = confirm('আপনি কি এই কিউআর কোডটি চিরতরে ডিলিট করতে চান?');
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

// Live Interactive 3:4 QR Preview Engine 
function updateLiveQRPreview() {
    const container = document.getElementById('qr-preview-container');
    container.innerHTML = '';

    const qrType = document.getElementById('qr-input-type').value;
    const fgColor = document.getElementById('qr-color-foreground').value;
    const bgColor = document.getElementById('qr-color-background').value;
    const dotType = document.getElementById('qr-style-dots').value;
    const cornerType = document.getElementById('qr-style-corners').value;
    const paddingVal = parseInt(document.getElementById('qr-padding').value, 10);
    const iconType = document.getElementById('qr-icon-type').value;
    const content = document.getElementById('qr-input-content').value || 'ScanFlow Pro';
    
    // Dynamic QR size from slider inside 3:4 canvas view
    const sliderVal = parseInt(document.getElementById('qr-canvas-size').value, 10);
    document.getElementById('qr-size-val').innerText = `${sliderVal}px`;

    // Apply styles to the outer container
    container.style.width = `${sliderVal}px`;
    container.style.height = `${sliderVal}px`;

    let qrData = '';
    if (qrType === 'static') {
        qrData = content;
    } else {
        const activeId = document.getElementById('edit-qr-id').value || 'placeholder';
        qrData = `${window.location.origin}${window.location.pathname}?id=${activeId}`;
    }

    // Live Config
    const qrConfig = {
        width: sliderVal,
        height: sliderVal,
        type: "svg", 
        data: qrData,
        margin: paddingVal,
        dotsOptions: { color: fgColor, type: dotType },
        backgroundOptions: { color: bgColor }, 
        cornersSquareOptions: { color: fgColor, type: cornerType },
        cornersDotOptions: { color: fgColor, type: dotType },
        imageOptions: { crossOrigin: "anonymous", margin: 2, imageSize: 0.4 }
    };

    currentQRStylingInstance = new QRCodeStyling(qrConfig);

    // Apply custom emoji center logo
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

    // Apply Live 3:4 Custom Canvas styles
    const liveCanvas = document.getElementById('live-card-canvas');
    const canvasBg = document.getElementById('canvas-color-bg').value;
    const canvasText = document.getElementById('canvas-color-text').value;
    
    liveCanvas.style.backgroundColor = canvasBg;
    liveCanvas.style.color = canvasText;

    // Apply Text Live inputs
    const titleVal = document.getElementById('canvas-title-input').value.trim() || "SCAN ME";
    const subTitleVal = document.getElementById('canvas-subtitle-input').value.trim() || "To view dynamic content";
    
    document.getElementById('card-dynamic-title').innerText = titleVal;
    document.getElementById('card-dynamic-title').style.color = canvasText;
    document.getElementById('card-dynamic-subtitle').innerText = subTitleVal;
    document.getElementById('card-dynamic-subtitle').style.color = canvasText;
}

// Open Editor Window
function openQREditor(item = null) {
    document.getElementById('welcome-panel').classList.add('hidden');
    document.getElementById('creator-panel').classList.remove('hidden');

    if (item) {
        document.getElementById('creator-title').innerText = `সম্পাদনা: ${item.title}`;
        document.getElementById('edit-qr-id').value = item.id;
        document.getElementById('qr-input-title').value = item.title || "";
        document.getElementById('qr-input-content').value = item.content || "";
        document.getElementById('qr-color-foreground').value = item.color || "#030712";
        document.getElementById('qr-color-foreground-hex').value = item.color || "#030712";
        document.getElementById('qr-color-background').value = item.bgColor || "#ffffff";
        document.getElementById('qr-color-background-hex').value = item.bgColor || "#ffffff";
        document.getElementById('qr-style-dots').value = item.dotType || "square";
        document.getElementById('qr-style-corners').value = item.cornerType || "square";
        document.getElementById('qr-padding').value = item.padding || "15";
        
        // Load custom 3:4 Canvas elements
        document.getElementById('canvas-color-bg').value = item.canvasBg || "#ffffff";
        document.getElementById('canvas-color-bg-hex').value = item.canvasBg || "#ffffff";
        document.getElementById('canvas-color-text').value = item.canvasText || "#1e293b";
        document.getElementById('canvas-color-text-hex').value = item.canvasText || "#1e293b";
        document.getElementById('qr-canvas-size').value = item.canvasQrSize || "180";
        document.getElementById('canvas-title-input').value = item.canvasTitle || "SCAN ME";
        document.getElementById('canvas-subtitle-input').value = item.canvasSubtitle || "To view dynamic content";

        const type = item.qrType || 'dynamic';
        setQRType(type);

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
    document.getElementById('creator-title').innerText = "নতুন কিউআর কোড কাস্টমাইজেশন";
    document.getElementById('edit-qr-id').value = '';
    document.getElementById('qr-input-title').value = '';
    document.getElementById('qr-input-content').value = '';
    document.getElementById('qr-color-foreground').value = '#030712';
    document.getElementById('qr-color-foreground-hex').value = '#030712';
    document.getElementById('qr-color-background').value = '#ffffff';
    document.getElementById('qr-color-background-hex').value = '#ffffff';
    document.getElementById('qr-style-dots').value = 'square';
    document.getElementById('qr-style-corners').value = 'square';
    document.getElementById('qr-padding').value = '15';
    document.getElementById('qr-icon-type').value = 'none';
    document.getElementById('qr-custom-emoji-input').value = '⭐';
    document.getElementById('emoji-custom-area').classList.add('hidden');
    document.getElementById('upload-custom-area').classList.add('hidden');
    document.getElementById('upload-preview-meta').classList.add('hidden');
    document.getElementById('qr-logo-upload-file').value = "";
    uploadedLogoBase64 = "";

    // Reset Canvas to default
    document.getElementById('canvas-color-bg').value = '#ffffff';
    document.getElementById('canvas-color-bg-hex').value = '#ffffff';
    document.getElementById('canvas-color-text').value = '#1e293b';
    document.getElementById('canvas-color-text-hex').value = '#1e293b';
    document.getElementById('qr-canvas-size').value = '180';
    document.getElementById('canvas-title-input').value = 'SCAN ME';
    document.getElementById('canvas-subtitle-input').value = 'To view dynamic content';

    setQRType('dynamic');
    document.getElementById('save-btn-text').innerText = "পাবলিশ করুন";
    updateLiveQRPreview();
}

function setQRType(type) {
    document.getElementById('qr-input-type').value = type;
    const btnDynamic = document.getElementById('btn-type-dynamic');
    const btnStatic = document.getElementById('btn-type-static');
    
    if (type === 'dynamic') {
        btnDynamic.className = "py-2.5 rounded-xl border-2 border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold text-xs flex flex-col items-center justify-center transition-all";
        btnStatic.className = "py-2.5 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-500 font-bold text-xs flex flex-col items-center justify-center transition-all";
        document.getElementById('btn-save-qr').classList.remove('hidden');
    } else {
        btnStatic.className = "py-2.5 rounded-xl border-2 border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold text-xs flex flex-col items-center justify-center transition-all";
        btnDynamic.className = "py-2.5 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-500 font-bold text-xs flex flex-col items-center justify-center transition-all";
        document.getElementById('btn-save-qr').classList.add('hidden');
        showNotification('স্ট্যাটিক কিউআর কোড সরাসরি গ্যালারি ডাউনলোড বাটনে ক্লিক করে ডাউনলোড করুন।', 'info');
    }
}

// Handle Custom Logo Upload File
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

// UI Event Listeners
function initAppEvents() {
    document.getElementById('search-qr').addEventListener('input', renderQRCodesList);

    // Dynamic type switches
    document.getElementById('btn-type-dynamic').addEventListener('click', () => {
        setQRType('dynamic');
        updateLiveQRPreview();
    });
    document.getElementById('btn-type-static').addEventListener('click', () => {
        setQRType('static');
        updateLiveQRPreview();
    });

    // Dynamic icon switcher logic
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

    // Content live rendering update
    document.getElementById('qr-input-content').addEventListener('input', () => {
        updateLiveQRPreview();
    });

    // Live Inputs for Canvas Texts
    document.getElementById('canvas-title-input').addEventListener('input', updateLiveQRPreview);
    document.getElementById('canvas-subtitle-input').addEventListener('input', updateLiveQRPreview);

    // Configuration live state changes observer
    const configFields = [
        'qr-color-foreground', 'qr-color-background', 'qr-style-dots', 
        'qr-style-corners', 'qr-padding', 'canvas-color-bg', 'canvas-color-text', 'qr-canvas-size'
    ];
    configFields.forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            if (id === 'qr-color-foreground') document.getElementById('qr-color-foreground-hex').value = document.getElementById(id).value;
            if (id === 'qr-color-background') document.getElementById('qr-color-background-hex').value = document.getElementById(id).value;
            if (id === 'canvas-color-bg') document.getElementById('canvas-color-bg-hex').value = document.getElementById(id).value;
            if (id === 'canvas-color-text') document.getElementById('canvas-color-text-hex').value = document.getElementById(id).value;
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
    document.getElementById('canvas-color-bg-hex').addEventListener('input', (e) => {
        const val = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            document.getElementById('canvas-color-bg').value = val;
            updateLiveQRPreview();
        }
    });
    document.getElementById('canvas-color-text-hex').addEventListener('input', (e) => {
        const val = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            document.getElementById('canvas-color-text').value = val;
            updateLiveQRPreview();
        }
    });

    // Preset theme color loader
    document.querySelectorAll('.btn-theme-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const bg = btn.getAttribute('data-canvas-bg');
            const text = btn.getAttribute('data-canvas-text');
            document.getElementById('canvas-color-bg').value = bg;
            document.getElementById('canvas-color-bg-hex').value = bg;
            document.getElementById('canvas-color-text').value = text;
            document.getElementById('canvas-color-text-hex').value = text;
            updateLiveQRPreview();
            showNotification('কাস্টম থিম কম্বিনেশন লোড হয়েছে!');
        });
    });

    document.getElementById('btn-open-creator').addEventListener('click', () => openQREditor(null));
    document.getElementById('btn-close-creator').addEventListener('click', () => {
        document.getElementById('creator-panel').classList.add('hidden');
        document.getElementById('welcome-panel').classList.remove('hidden');
    });

    // Auth Login vs Signup
    document.getElementById('tab-login').addEventListener('click', () => {
        authMode = 'login';
        document.getElementById('tab-login').className = "w-1/2 py-2 text-xs font-bold rounded-lg text-slate-800 bg-white shadow-sm transition-all";
        document.getElementById('tab-register').className = "w-1/2 py-2 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-800 transition-all";
        document.getElementById('name-field-group').classList.add('hidden');
    });

    document.getElementById('tab-register').addEventListener('click', () => {
        authMode = 'register';
        document.getElementById('tab-register').className = "w-1/2 py-2 text-xs font-bold rounded-lg text-slate-800 bg-white shadow-sm transition-all";
        document.getElementById('tab-login').className = "w-1/2 py-2 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-800 transition-all";
        document.getElementById('name-field-group').classList.remove('hidden');
    });

    // Email/Password entries signin
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

    // Save/Publish dynamic payload
    document.getElementById('btn-save-qr').addEventListener('click', async () => {
        const title = document.getElementById('qr-input-title').value.trim();
        const content = document.getElementById('qr-input-content').value.trim();
        const qrType = document.getElementById('qr-input-type').value;
        
        if (!title || !content) {
            showNotification('দয়া করে টাইটেল এবং কিউআর কনটেন্ট পূরণ করুন!', 'error');
            return;
        }

        if (qrType === 'static') {
            showNotification('স্ট্যাটিক কিউআর কোড সেভ করার প্রয়োজন নেই, সরাসরি ডাউনলোড করুন!', 'info');
            return;
        }

        const fgColor = document.getElementById('qr-color-foreground').value;
        const bgColor = document.getElementById('qr-color-background').value;
        const dotType = document.getElementById('qr-style-dots').value;
        const cornerType = document.getElementById('qr-style-corners').value;
        const paddingVal = document.getElementById('qr-padding').value;
        const iconType = document.getElementById('qr-icon-type').value;
        const existingId = document.getElementById('edit-qr-id').value;

        // Custom 3:4 canvas values
        const canvasBg = document.getElementById('canvas-color-bg').value;
        const canvasText = document.getElementById('canvas-color-text').value;
        const canvasQrSize = document.getElementById('qr-canvas-size').value;
        const canvasTitle = document.getElementById('canvas-title-input').value.trim();
        const canvasSubtitle = document.getElementById('canvas-subtitle-input').value.trim();

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
            qrType: qrType,
            canvasBg: canvasBg,
            canvasText: canvasText,
            canvasQrSize: canvasQrSize,
            canvasTitle: canvasTitle,
            canvasSubtitle: canvasSubtitle,
            updatedAt: Date.now()
        };

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

    // 3:4 ASPECT ULTRA-HIGH-RESOLUTION CARD GENERATOR AND DOWNLOADER
    document.getElementById('btn-download-qr').addEventListener('click', async () => {
        if (!currentQRStylingInstance) {
            showNotification('কোনো কিউআর ইনস্ট্যান্স পাওয়া যায়নি!', 'error');
            return;
        }

        const title = document.getElementById('qr-input-title').value || 'dynamic-qr';
        const cleanTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();

        showNotification('৩:৪ আল্ট্রা-রেজোলিউশন প্রফেশনাল কিউআর ক্যানভাস তৈরি হচ্ছে...', 'info');

        // Target Canvas High Resolution Specs (Standard 3:4 Print Aspect Ratio)
        const targetWidth = 1500;
        const targetHeight = 2000;

        // Grab values dynamically
        const canvasBg = document.getElementById('canvas-color-bg').value;
        const canvasText = document.getElementById('canvas-color-text').value;
        const titleText = document.getElementById('canvas-title-input').value.trim() || "SCAN ME";
        const subtitleText = document.getElementById('canvas-subtitle-input').value.trim() || "To view dynamic content";
        const customSizeValue = parseInt(document.getElementById('qr-canvas-size').value, 10);

        // Dynamically scaled QR code size on the downloadable 1500px wide image
        const scaledQRWidth = Math.round((customSizeValue / 260) * targetWidth); 

        // Create an off-screen HTML canvas to render the final print card
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = targetWidth;
        finalCanvas.height = targetHeight;
        const ctx = finalCanvas.getContext('2d');

        // Fill background color
        ctx.fillStyle = canvasBg;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Top brand logo sub-header
        ctx.fillStyle = "#6366f1"; // Accent brand color
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("SCANFLOW PREMIUM", targetWidth / 2, 100);

        // Card Title Text
        ctx.fillStyle = canvasText;
        ctx.font = "extrabold 75px sans-serif";
        ctx.fillText(titleText.toUpperCase(), targetWidth / 2, 160);

        // Generate the SVG of the QR Code at high resolution for maximum crispness
        const tempContainer = document.createElement('div');
        tempContainer.style.display = 'none';
        document.body.appendChild(tempContainer);

        const qrType = document.getElementById('qr-input-type').value;
        const fgColor = document.getElementById('qr-color-foreground').value;
        const bgColor = document.getElementById('qr-color-background').value;
        const dotType = document.getElementById('qr-style-dots').value;
        const cornerType = document.getElementById('qr-style-corners').value;
        const paddingVal = parseInt(document.getElementById('qr-padding').value, 10);
        const iconType = document.getElementById('qr-icon-type').value;
        const content = document.getElementById('qr-input-content').value || 'ScanFlow Pro';

        let qrData = '';
        if (qrType === 'static') {
            qrData = content;
        } else {
            const activeId = document.getElementById('edit-qr-id').value || 'placeholder';
            qrData = `${window.location.origin}${window.location.pathname}?id=${activeId}`;
        }

        // Initialize high resolution QR engine dynamically
        const hiResQREngine = new QRCodeStyling({
            width: scaledQRWidth,
            height: scaledQRWidth,
            type: "svg",
            data: qrData,
            margin: paddingVal,
            dotsOptions: { color: fgColor, type: dotType },
            backgroundOptions: { color: bgColor },
            cornersSquareOptions: { color: fgColor, type: cornerType },
            cornersDotOptions: { color: fgColor, type: dotType },
            imageOptions: { crossOrigin: "anonymous", margin: 2, imageSize: 0.4 }
        });

        // Add custom logo/emoji
        if (iconType === 'emoji') {
            const logoEmoji = document.getElementById('qr-custom-emoji-input').value.trim() || "⭐";
            const emojiCanvas = document.createElement('canvas');
            emojiCanvas.width = 128;
            emojiCanvas.height = 128;
            const emojiCtx = emojiCanvas.getContext('2d');
            emojiCtx.font = '84px Arial';
            emojiCtx.textAlign = 'center';
            emojiCtx.textBaseline = 'middle';
            emojiCtx.fillText(logoEmoji, 64, 64);
            hiResQREngine.update({ image: emojiCanvas.toDataURL() });
        } else if (iconType === 'upload' && uploadedLogoBase64) {
            hiResQREngine.update({ image: uploadedLogoBase64 });
        }

        hiResQREngine.append(tempContainer);

        // Wait for the SVG image rendering pipeline
        setTimeout(() => {
            const svgElement = tempContainer.querySelector('svg');
            const svgString = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const URL = window.URL || window.webkitURL || window;
            const blobURL = URL.createObjectURL(svgBlob);

            const qrImageElement = new Image();
            qrImageElement.onload = function() {
                // Draw QR Code centered vertically inside the 3:4 canvas
                const qrX = (targetWidth - scaledQRWidth) / 2;
                const qrY = (targetHeight - scaledQRWidth) / 2 - 40; // centered and adjusted for texts
                
                // Draw nice subtle background card behind QR
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = 'rgba(0,0,0,0.06)';
                ctx.shadowBlur = 30;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 10;
                
                // Rounded corner box for high quality QR background
                const rBoxSize = scaledQRWidth + 40;
                const rBoxX = qrX - 20;
                const rBoxY = qrY - 20;
                const radius = 32;
                
                ctx.beginPath();
                ctx.moveTo(rBoxX + radius, rBoxY);
                ctx.lineTo(rBoxX + rBoxSize - radius, rBoxY);
                ctx.quadraticCurveTo(rBoxX + rBoxSize, rBoxY, rBoxX + rBoxSize, rBoxY + radius);
                ctx.lineTo(rBoxX + rBoxSize, rBoxY + rBoxSize - radius);
                ctx.quadraticCurveTo(rBoxX + rBoxSize, rBoxY + rBoxSize, rBoxX + rBoxSize - radius, rBoxY + rBoxSize);
                ctx.lineTo(rBoxX + radius, rBoxY + rBoxSize);
                ctx.quadraticCurveTo(rBoxX, rBoxY + rBoxSize, rBoxX, rBoxY + rBoxSize - radius);
                ctx.lineTo(rBoxX, rBoxY + radius);
                ctx.quadraticCurveTo(rBoxX, rBoxY, rBoxX + radius, rBoxY);
                ctx.closePath();
                ctx.fill();

                // Draw QR Code
                ctx.shadowBlur = 0; // Reset shadows
                ctx.drawImage(qrImageElement, qrX, qrY, scaledQRWidth, scaledQRWidth);

                // Draw bottom text title
                ctx.fillStyle = canvasText;
                ctx.font = "bold 55px sans-serif";
                ctx.fillText(subtitleText, targetWidth / 2, qrY + scaledQRWidth + 120);

                // Draw bottom security footer
                ctx.fillStyle = "#94a3b8";
                ctx.font = "bold 26px monospace";
                ctx.fillText("🔒 SECURED BY SCANFLOW PRO", targetWidth / 2, targetHeight - 120);

                // Trigger download sequence
                const dlLink = document.createElement('a');
                dlLink.download = `${cleanTitle}-canvas-3to4.png`;
                dlLink.href = finalCanvas.toDataURL('image/png', 1.0);
                document.body.appendChild(dlLink);
                dlLink.click();
                document.body.removeChild(dlLink);
                document.body.removeChild(tempContainer);

                showNotification('৩:৪ প্রিমিয়াম ক্যানভাস ইমেজ ডাউনলোড সম্পন্ন হয়েছে!', 'success');
            };
            qrImageElement.src = blobURL;
        }, 300);
    });

    // Copy public page data
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
