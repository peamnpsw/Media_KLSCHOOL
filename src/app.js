/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Import necessary Firestore and Storage functions from standard Firebase package
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { db, storage, auth } from './firebase.js';

// --- State Management ---
let allMedia = [];          // Stores all real-time media items fetched from Firestore
let filteredMedia = [];     // Stores media items after applying search keywords & filters
let currentCategoryFilter = ''; // Active Category filter ('', 'เอกสาร', 'วิดีโอ', etc.)
let currentPage = 1;        // Current page for pagination
const itemsPerPage = 6;     // Show 6 cards per page for a beautifully balanced grid
let currentUser = null;     // Managed teacher auth state
let authModalInstance = null; // Authentication modal instance

// Selected image file for custom cover upload
let selectedImageFile = null;

// --- Bootstrap Instances ---
let deleteModalInstance = null;
let toastInstance = null;

// --- DOM Element References ---
const mediaForm = document.getElementById('media-form');
const mediaIdInput = document.getElementById('media-id');
const mediaTitleInput = document.getElementById('media-title');
const mediaSubjectSelect = document.getElementById('media-subject');
const mediaCategorySelect = document.getElementById('media-category');
const mediaGradeSelect = document.getElementById('media-grade');
const mediaAuthorInput = document.getElementById('media-author');
const mediaUrlInput = document.getElementById('media-url');
const mediaDescriptionInput = document.getElementById('media-description');
const mediaImageUrlInput = document.getElementById('media-image-url');

// Cover Image Elements
const dropZone = document.getElementById('drop-zone');
const mediaImageFileInput = document.getElementById('media-image-file');
const previewPlaceholder = document.getElementById('preview-placeholder');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');
const btnRemoveImage = document.getElementById('btn-remove-image');

// Submit Buttons
const btnSubmit = document.getElementById('btn-submit');
const submitBtnText = document.getElementById('submit-btn-text');
const submitSpinner = document.getElementById('submit-spinner');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const formCardTitle = document.getElementById('form-card-title');

// Search & Filter Inputs
const searchKeywordInput = document.getElementById('search-keyword');
const btnClearSearch = document.getElementById('btn-clear-search');
const filterSubjectSelect = document.getElementById('filter-subject');
const filterGradeSelect = document.getElementById('filter-grade');
const sortOrderSelect = document.getElementById('sort-order');
const btnClearAllFilters = document.getElementById('btn-clear-all-filters');

// Main Containers & Elements
const mediaContainer = document.getElementById('media-container');
const loadingSpinner = document.getElementById('loading-spinner');
const emptyState = document.getElementById('empty-state');
const paginationNav = document.getElementById('pagination-nav');
const paginationInfo = document.getElementById('pagination-info');
const pagePrev = document.getElementById('page-prev');
const pageNext = document.getElementById('page-next');

// Statistics Widgets
const statTotal = document.getElementById('stat-total');
const statVideoPpt = document.getElementById('stat-video-ppt');
const statCloud = document.getElementById('stat-cloud');
const statAiDocs = document.getElementById('stat-ai-docs');

// Back to top
const btnBackToTop = document.getElementById('btn-back-to-top');

// Dark Mode Elements
const darkModeToggle = document.getElementById('dark-mode-toggle');
const darkModeIcon = document.getElementById('dark-mode-icon');
const darkModeText = document.getElementById('dark-mode-text');

// --- Category Default Cover Photos (Polished Unsplash URLs) ---
const CATEGORY_COVERS = {
  'เอกสาร': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=400&q=80',
  'วิดีโอ': 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=400&q=80',
  'PowerPoint': 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=400&q=80',
  'Google Drive': 'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?auto=format&fit=crop&w=400&q=80',
  'เว็บไซต์': 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=400&q=80',
  'AI Prompt': 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=400&q=80',
  'อื่น ๆ': 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=400&q=80'
};

// Returns default image based on media category
function getDefaultImageForCategory(category) {
  return CATEGORY_COVERS[category] || CATEGORY_COVERS['อื่น ๆ'];
}

// --- Notification Toasts (Toast Notification Feature) ---
function showToast(message, type = 'success') {
  const toastEl = document.getElementById('liveToast');
  const toastMessage = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');
  
  toastMessage.textContent = message;
  
  // Style according to notification types
  toastEl.className = 'toast border-0 shadow-lg rounded-3';
  if (type === 'success') {
    toastEl.classList.add('bg-success', 'text-white');
    toastIcon.className = 'bi bi-check-circle-fill text-white fs-5';
  } else if (type === 'error') {
    toastEl.classList.add('bg-danger', 'text-white');
    toastIcon.className = 'bi bi-exclamation-octagon-fill text-white fs-5';
  } else {
    toastEl.classList.add('bg-warning', 'text-dark');
    toastIcon.className = 'bi bi-info-circle-fill text-dark fs-5';
  }
  
  if (toastInstance) {
    toastInstance.show();
  }
}

// --- Dark Mode Manager ---
function initDarkMode() {
  const savedTheme = localStorage.getItem('school-theme') || 'light';
  setTheme(savedTheme);

  darkModeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme);
  localStorage.setItem('school-theme', theme);

  if (theme === 'dark') {
    darkModeIcon.className = 'bi bi-sun-fill';
    darkModeText.textContent = 'โหมดกลางวัน';
    darkModeToggle.classList.remove('btn-outline-light');
    darkModeToggle.classList.add('btn-outline-warning');
  } else {
    darkModeIcon.className = 'bi bi-moon-stars-fill';
    darkModeText.textContent = 'โหมดกลางคืน';
    darkModeToggle.classList.remove('btn-outline-warning');
    darkModeToggle.classList.add('btn-outline-light');
  }
}

// --- File Drag & Drop & Upload Preview Handlers ---
function initCoverImageUpload() {
  // Click to upload
  dropZone.addEventListener('click', () => {
    mediaImageFileInput.click();
  });

  // Change input
  mediaImageFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  // Drag over effects
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary-color)';
    dropZone.style.backgroundColor = 'rgba(13, 110, 253, 0.05)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#dee2e6';
    dropZone.style.backgroundColor = 'rgba(0,0,0,0.01)';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#dee2e6';
    dropZone.style.backgroundColor = 'rgba(0,0,0,0.01)';
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  // Remove image
  btnRemoveImage.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering dropZone click event
    clearImageSelection();
  });
}

function handleFileSelected(file) {
  if (!file.type.startsWith('image/')) {
    showToast('กรุณาอัปโหลดเฉพาะไฟล์รูปภาพหลักเท่านั้น', 'error');
    return;
  }
  
  selectedImageFile = file;
  
  // Show Preview
  const reader = new FileReader();
  reader.onload = function(e) {
    imagePreview.src = e.target.result;
    previewPlaceholder.classList.add('d-none');
    previewContainer.classList.remove('d-none');
  };
  reader.readAsDataURL(file);
}

function clearImageSelection() {
  selectedImageFile = null;
  mediaImageFileInput.value = '';
  mediaImageUrlInput.value = '';
  imagePreview.src = '';
  previewPlaceholder.classList.remove('d-none');
  previewContainer.classList.add('d-none');
}

// --- Firebase Cloud Database Sync (Real-time onSnapshot) ---
function initRealtimeSync() {
  // Collection "media" reference
  const mediaColRef = collection(db, 'media');
  
  // Query to sort by createdAt descending by default
  const mediaQuery = query(mediaColRef, orderBy('createdAt', 'desc'));
  
  // Listening to Realtime Updates
  onSnapshot(mediaQuery, (snapshot) => {
    allMedia = [];
    snapshot.forEach((docSnap) => {
      allMedia.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    
    // Hide initial loading spinner once loaded
    loadingSpinner.classList.add('d-none');
    
    // Compute dynamic dashboard statistics
    computeStats();
    
    // Apply search and filter constraints to the new dataset, then render
    applyFiltersAndRender();
  }, (error) => {
    console.error("Firestore Real-time snapshot failed:", error);
    loadingSpinner.classList.add('d-none');
    showToast("ไม่สามารถเชื่อมต่อคลังข้อมูลได้แบบ Real-time", "error");
  });
}

// --- Dynamic Stats Engine (Extra Feature) ---
function computeStats() {
  const total = allMedia.length;
  
  // Count by video & PowerPoint
  const videoPpt = allMedia.filter(m => m.category === 'วิดีโอ' || m.category === 'PowerPoint').length;
  
  // Count Google Drive & Website
  const cloud = allMedia.filter(m => m.category === 'Google Drive' || m.category === 'เว็บไซต์').length;
  
  // Count AI prompt & Documents
  const aiDocs = allMedia.filter(m => m.category === 'AI Prompt' || m.category === 'เอกสาร').length;
  
  // Update UI Elements
  statTotal.textContent = total;
  statVideoPpt.textContent = videoPpt;
  statCloud.textContent = cloud;
  statAiDocs.textContent = aiDocs;
}

// --- Search, Filtering & Sorting System ---
function applyFiltersAndRender() {
  const keyword = searchKeywordInput.value.toLowerCase().trim();
  const selectedSubject = filterSubjectSelect.value;
  const selectedGrade = filterGradeSelect.value;
  const activeSort = sortOrderSelect.value;

  // Show/Hide Clear button on search field
  if (keyword.length > 0) {
    btnClearSearch.classList.remove('d-none');
  } else {
    btnClearSearch.classList.add('d-none');
  }

  // 1. Filtering Logic
  filteredMedia = allMedia.filter(media => {
    // Search keyword search matches: title, subject, category, or author
    const matchesKeyword = !keyword || 
      (media.title && media.title.toLowerCase().includes(keyword)) ||
      (media.subject && media.subject.toLowerCase().includes(keyword)) ||
      (media.category && media.category.toLowerCase().includes(keyword)) ||
      (media.author && media.author.toLowerCase().includes(keyword));

    // Filter matching Subject
    const matchesSubject = !selectedSubject || media.subject === selectedSubject;
    
    // Filter matching Grade
    const matchesGrade = !selectedGrade || media.grade === selectedGrade;

    // Filter matching Category (Horizontal Badges)
    const matchesCategory = !currentCategoryFilter || media.category === currentCategoryFilter;

    return matchesKeyword && matchesSubject && matchesGrade && matchesCategory;
  });

  // 2. Sorting Logic
  if (activeSort === 'newest') {
    // Newest first - by createdAt. Fallback to title order if createdAt is pending serverTimestamp
    filteredMedia.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.seconds : Date.now() / 1000;
      const timeB = b.createdAt ? b.createdAt.seconds : Date.now() / 1000;
      return timeB - timeA;
    });
  } else if (activeSort === 'oldest') {
    // Oldest first
    filteredMedia.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.seconds : Date.now() / 1000;
      const timeB = b.createdAt ? b.createdAt.seconds : Date.now() / 1000;
      return timeA - timeB;
    });
  } else if (activeSort === 'title-asc') {
    // Alphabetical A-Z
    filteredMedia.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'th'));
  } else if (activeSort === 'title-desc') {
    // Alphabetical Z-A
    filteredMedia.sort((a, b) => (b.title || '').localeCompare(a.title || '', 'th'));
  }

  // Reset page index if pages exceed current length
  const totalPages = Math.ceil(filteredMedia.length / itemsPerPage);
  if (currentPage > totalPages && totalPages > 0) {
    currentPage = totalPages;
  } else if (filteredMedia.length === 0) {
    currentPage = 1;
  }

  // Render list based on pagination
  renderMediaGallery();
  renderPagination(totalPages);
}

// --- Render Media Cards (Material / Drive Design Accent) ---
function renderMediaGallery() {
  mediaContainer.innerHTML = '';

  if (filteredMedia.length === 0) {
    emptyState.classList.remove('d-none');
    paginationNav.classList.add('d-none');
    return;
  }

  emptyState.classList.add('d-none');
  paginationNav.classList.remove('d-none');

  // Slice list based on current page
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredMedia.length);
  const pageItems = filteredMedia.slice(startIndex, endIndex);

  pageItems.forEach((media) => {
    // Formatting date neatly
    let formattedDate = 'เพิ่งเพิ่มเมื่อสักครู่';
    if (media.createdAt && media.createdAt.toDate) {
      const d = media.createdAt.toDate();
      formattedDate = d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    // Assigning Category Badges classes
    let catClass = 'bg-secondary text-white';
    if (media.category === 'เอกสาร') catClass = 'cat-document';
    else if (media.category === 'วิดีโอ') catClass = 'cat-video';
    else if (media.category === 'PowerPoint') catClass = 'cat-powerpoint';
    else if (media.category === 'Google Drive') catClass = 'cat-drive';
    else if (media.category === 'เว็บไซต์') catClass = 'cat-website';
    else if (media.category === 'AI Prompt') catClass = 'cat-prompt';

    const card = document.createElement('div');
    card.className = 'media-card-wrapper animate-fade-in';
    
    // Create card element structure
    card.innerHTML = `
      <div class="card media-card h-100 shadow-sm">
        <div class="card-img-container">
          <!-- Category overlay badge -->
          <span class="badge-category ${catClass}">${media.category}</span>
          <img src="${media.imageURL || getDefaultImageForCategory(media.category)}" alt="Cover ${media.title}" onerror="this.onerror=null;this.src='${getDefaultImageForCategory(media.category)}';" referrerpolicy="no-referrer" />
        </div>
        <div class="card-body d-flex flex-column p-3">
          <div class="mb-2">
            <span class="badge bg-primary bg-opacity-10 text-primary small rounded-pill px-2 py-1" style="font-size: 0.72rem;">${media.subject}</span>
            <span class="badge bg-success bg-opacity-10 text-success small rounded-pill px-2 py-1" style="font-size: 0.72rem;">${media.grade}</span>
          </div>
          <h5 class="card-title fw-bold text-truncate-2 fs-6 mb-1" title="${media.title}">${media.title}</h5>
          
          ${media.description ? `<p class="card-text text-muted small text-truncate-2 mb-3" style="font-size: 0.8rem;">${media.description}</p>` : `<p class="card-text text-muted small mb-3 italic" style="font-size: 0.8rem; font-style: italic;">ไม่มีคำอธิบายเพิ่มเติม</p>`}
          
          <div class="mt-auto pt-2 border-top">
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-muted text-truncate" style="font-size: 0.75rem;" title="ผู้จัดทำ: ${media.author}">
                <i class="bi bi-person text-secondary me-1"></i>${media.author}
              </span>
              <span class="text-muted text-nowrap" style="font-size: 0.72rem;">
                <i class="bi bi-calendar3 text-secondary me-1"></i>${formattedDate}
              </span>
            </div>
            
            <div class="d-flex gap-1 mt-3">
              <!-- Open Media Button -->
              <a href="${media.mediaURL}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary flex-grow-1 rounded-pill shadow-sm d-flex align-items-center justify-content-center gap-1" id="open-btn-${media.id}">
                <i class="bi bi-box-arrow-up-right"></i>เปิดสื่อการสอน
              </a>
              
              ${currentUser ? `
              <!-- Edit Action Button -->
              <button class="btn btn-sm btn-outline-secondary rounded-circle px-2" id="edit-btn-${media.id}" title="แก้ไขข้อมูล">
                <i class="bi bi-pencil-square"></i>
              </button>
              
              <!-- Delete Action Button -->
              <button class="btn btn-sm btn-outline-danger rounded-circle px-2" id="delete-btn-${media.id}" title="ลบข้อมูล">
                <i class="bi bi-trash"></i>
              </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    mediaContainer.appendChild(card);

    // Bind edit and delete listeners directly (clean JS events) if authenticated
    if (currentUser) {
      document.getElementById(`edit-btn-${media.id}`).addEventListener('click', () => {
        startEditMode(media);
      });
      document.getElementById(`delete-btn-${media.id}`).addEventListener('click', () => {
        triggerDeleteModal(media);
      });
    }
  });

  // Update showing info
  paginationInfo.textContent = `แสดง ${startIndex + 1} ถึง ${endIndex} จากทั้งหมด ${filteredMedia.length} รายการ`;
}

// --- Pagination Controls (Extra Feature) ---
function renderPagination(totalPages) {
  // Clear previous dynamic numbers
  const pageNumbers = document.querySelectorAll('.dynamic-page-item');
  pageNumbers.forEach(el => el.remove());

  if (totalPages <= 1) {
    paginationNav.classList.add('d-none');
    return;
  }
  
  paginationNav.classList.remove('d-none');

  // Configure Prev Button
  if (currentPage === 1) {
    pagePrev.classList.add('disabled');
  } else {
    pagePrev.classList.remove('disabled');
  }

  // Configure Next Button
  if (currentPage === totalPages) {
    pageNext.classList.add('disabled');
  } else {
    pageNext.classList.remove('disabled');
  }

  // Create Page Number Links
  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement('li');
    li.className = `page-item dynamic-page-item ${i === currentPage ? 'active' : ''}`;
    
    const a = document.createElement('a');
    a.className = 'page-link';
    a.href = '#';
    a.textContent = i;
    
    li.appendChild(a);
    
    // Insert page number before the "Next" button
    pageNext.parentNode.insertBefore(li, pageNext);

    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentPage !== i) {
        currentPage = i;
        applyFiltersAndRender();
        scrollToGallery();
      }
    });
  }
}

function scrollToGallery() {
  document.getElementById('search-keyword').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- Form Reset / Clear State ---
function resetForm() {
  mediaForm.reset();
  mediaIdInput.value = '';
  clearImageSelection();
  
  // Reset buttons status
  submitBtnText.textContent = 'บันทึกข้อมูลสื่อ';
  formCardTitle.innerHTML = '<i class="bi bi-plus-circle-fill me-2"></i>เพิ่มข้อมูลสื่อใหม่';
  btnCancelEdit.classList.add('d-none');
  
  // Remove submit loading state
  btnSubmit.disabled = false;
  submitSpinner.classList.add('d-none');
}

// --- CRUD: Enter Edit Mode ---
function startEditMode(media) {
  mediaIdInput.value = media.id;
  mediaTitleInput.value = media.title || '';
  mediaSubjectSelect.value = media.subject || '';
  mediaCategorySelect.value = media.category || '';
  mediaGradeSelect.value = media.grade || '';
  mediaAuthorInput.value = media.author || '';
  mediaUrlInput.value = media.mediaURL || '';
  mediaDescriptionInput.value = media.description || '';
  mediaImageUrlInput.value = media.imageURL || '';

  // Render Image Preview
  if (media.imageURL) {
    imagePreview.src = media.imageURL;
    previewPlaceholder.classList.add('d-none');
    previewContainer.classList.remove('d-none');
  } else {
    clearImageSelection();
  }

  // Adjust Form Headers
  submitBtnText.textContent = 'บันทึกการแก้ไขสื่อ';
  formCardTitle.innerHTML = '<i class="bi bi-pencil-square me-2"></i>แก้ไขข้อมูลสื่อ';
  btnCancelEdit.classList.remove('d-none');

  // Scroll smoothly to Form to grab user's attention
  mediaForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- CRUD: Create & Update Handler ---
async function handleFormSubmit(e) {
  e.preventDefault();

  // Basic HTML5 validation trigger
  if (!mediaForm.checkValidity()) {
    e.stopPropagation();
    mediaForm.classList.add('was-validated');
    showToast('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน', 'error');
    return;
  }

  // Loading State
  btnSubmit.disabled = true;
  submitSpinner.classList.remove('d-none');

  const editingId = mediaIdInput.value;
  const title = mediaTitleInput.value.trim();
  const subject = mediaSubjectSelect.value;
  const category = mediaCategorySelect.value;
  const grade = mediaGradeSelect.value;
  const author = mediaAuthorInput.value.trim();
  const mediaURL = mediaUrlInput.value.trim();
  const description = mediaDescriptionInput.value.trim();

  try {
    let finalImageURL = mediaImageUrlInput.value;

    // A. Handles Image Upload to Firebase Storage
    if (selectedImageFile) {
      try {
        const fileExtension = selectedImageFile.name.split('.').pop();
        const fileName = `covers/${Date.now()}_STUMEDIAKL.${fileExtension}`;
        const coverStorageRef = ref(storage, fileName);
        
        // Upload bytes
        const uploadSnapshot = await uploadBytes(coverStorageRef, selectedImageFile);
        // Get Remote URL
        finalImageURL = await getDownloadURL(uploadSnapshot.ref);
      } catch (storageErr) {
        console.error("Firebase Storage Upload failed, fallback to defaults:", storageErr);
        showToast('ไม่สามารถอัปโหลดไปยัง Firebase Storage ได้: กำลังใช้รูปภาพเริ่มต้นหมวดหมู่แทน', 'warning');
        // If it's a new post, use category preset. If editing, preserve the old URL.
        if (!finalImageURL) {
          finalImageURL = getDefaultImageForCategory(category);
        }
      }
    } else if (!finalImageURL) {
      // B. Fallback to category standard preset if no image loaded
      finalImageURL = getDefaultImageForCategory(category);
    }

    const payload = {
      title,
      subject,
      category,
      grade,
      author,
      mediaURL,
      description,
      imageURL: finalImageURL,
      // Keeps original timestamp on edit or inserts fresh timestamp on create
      createdAt: editingId ? (allMedia.find(m => m.id === editingId)?.createdAt || serverTimestamp()) : serverTimestamp()
    };

    if (editingId) {
      // --- UPDATE OPERATION ---
      const docRef = doc(db, 'media', editingId);
      await updateDoc(docRef, payload);
      showToast(`แก้ไขข้อมูลสื่อ "${title}" เรียบร้อยแล้ว`);
    } else {
      // --- CREATE OPERATION ---
      const collectionRef = collection(db, 'media');
      await addDoc(collectionRef, payload);
      showToast(`บันทึกสื่อการสอน "${title}" ลงคลังสำเร็จ`);
    }

    // Clear form state
    resetForm();
    mediaForm.classList.remove('was-validated');

  } catch (err) {
    console.error("Save Document Error:", err);
    showToast('ระบบขัดข้องไม่สามารถบันทึกข้อมูลสื่อการสอนได้', 'error');
  } finally {
    btnSubmit.disabled = false;
    submitSpinner.classList.add('d-none');
  }
}

// --- CRUD: Delete Confirmation and Handler (Modal Confirmation Feature) ---
function triggerDeleteModal(media) {
  document.getElementById('delete-media-title').textContent = media.title;
  document.getElementById('delete-media-id').value = media.id;
  
  if (deleteModalInstance) {
    deleteModalInstance.show();
  }
}

async function handleConfirmDelete() {
  const deleteId = document.getElementById('delete-media-id').value;
  const deleteBtn = document.getElementById('btn-confirm-delete');
  const deleteSpinner = document.getElementById('delete-spinner');
  const deleteBtnText = document.getElementById('confirm-delete-text');

  if (!deleteId) return;

  // Loading
  deleteBtn.disabled = true;
  deleteSpinner.classList.remove('d-none');
  deleteBtnText.textContent = 'กำลังลบ...';

  try {
    const docRef = doc(db, 'media', deleteId);
    await deleteDoc(docRef);
    
    showToast('ลบสื่อการเรียนการสอนเรียบร้อยแล้ว', 'success');
    
    // Hide Modal
    if (deleteModalInstance) {
      deleteModalInstance.hide();
    }
  } catch (err) {
    console.error("Firestore Delete failed:", err);
    showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
  } finally {
    deleteBtn.disabled = false;
    deleteSpinner.classList.add('d-none');
    deleteBtnText.textContent = 'ยืนยันการลบ';
  }
}

// --- Authentication & Role-Based Access Control (RBAC) ---
function initAuth() {
  authModalInstance = new bootstrap.Modal(document.getElementById('authModal'));

  // Elements
  const btnAuthTabLogin = document.getElementById('btn-auth-tab-login');
  const btnAuthTabRegister = document.getElementById('btn-auth-tab-register');
  
  // Forms
  const authLoginForm = document.getElementById('auth-login-form');
  const authRegisterForm = document.getElementById('auth-register-form');
  const authResetForm = document.getElementById('auth-reset-form');
  
  // Navigation Links
  const linkForgotPassword = document.getElementById('link-forgot-password');
  const btnResetCancel = document.getElementById('btn-reset-cancel');
  
  // Tab Switching Logic
  btnAuthTabLogin.addEventListener('click', () => {
    btnAuthTabLogin.classList.add('active', 'btn-white', 'shadow-sm');
    btnAuthTabLogin.classList.remove('btn-outline-secondary');
    
    btnAuthTabRegister.classList.remove('active', 'btn-white', 'shadow-sm');
    btnAuthTabRegister.classList.add('btn-outline-secondary');
    
    authLoginForm.classList.remove('d-none');
    authRegisterForm.classList.add('d-none');
    authResetForm.classList.add('d-none');
  });

  btnAuthTabRegister.addEventListener('click', () => {
    btnAuthTabRegister.classList.add('active', 'btn-white', 'shadow-sm');
    btnAuthTabRegister.classList.remove('btn-outline-secondary');
    
    btnAuthTabLogin.classList.remove('active', 'btn-white', 'shadow-sm');
    btnAuthTabLogin.classList.add('btn-outline-secondary');
    
    authRegisterForm.classList.remove('d-none');
    authLoginForm.classList.add('d-none');
    authResetForm.classList.add('d-none');
  });

  linkForgotPassword.addEventListener('click', (e) => {
    e.preventDefault();
    authLoginForm.classList.add('d-none');
    authRegisterForm.classList.add('d-none');
    authResetForm.classList.remove('d-none');
  });

  btnResetCancel.addEventListener('click', () => {
    authResetForm.classList.add('d-none');
    authLoginForm.classList.remove('d-none');
  });

  // Submit Sign-In Form
  authLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    const submitBtn = document.getElementById('btn-login-submit');
    const spinner = document.getElementById('login-spinner');
    
    submitBtn.disabled = true;
    spinner.classList.remove('d-none');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('เข้าสู่ระบบสิทธิ์คุณครูสำเร็จ ยินดีต้อนรับครับ', 'success');
      authModalInstance.hide();
    } catch (err) {
      console.error(err);
      let errMsg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') errMsg = 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ หรือ รหัสผ่านผิดพลาด';
      else if (err.code === 'auth/wrong-password') errMsg = 'รหัสผ่านคุณครูไม่ถูกต้อง';
      showToast(errMsg, 'error');
    } finally {
      submitBtn.disabled = false;
      spinner.classList.add('d-none');
    }
  });

  // Submit Register Form
  authRegisterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    
    const submitBtn = document.getElementById('btn-register-submit');
    const spinner = document.getElementById('register-spinner');
    
    submitBtn.disabled = true;
    spinner.classList.remove('d-none');
    
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      showToast('สมัครสมาชิกคุณครูสำเร็จ ยินดีต้อนรับสู่ระบบคลังสื่อโรงเรียน', 'success');
      authModalInstance.hide();
    } catch (err) {
      console.error(err);
      let errMsg = 'เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง';
      if (err.code === 'auth/email-already-in-use') errMsg = 'อีเมลนี้ถูกลงทะเบียนคุณครูไว้ในระบบแล้ว';
      else if (err.code === 'auth/weak-password') errMsg = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรเพื่อความปลอดภัย';
      else if (err.code === 'auth/invalid-email') errMsg = 'รูปแบบที่อยู่อีเมลไม่ถูกต้อง';
      showToast(errMsg, 'error');
    } finally {
      submitBtn.disabled = false;
      spinner.classList.add('d-none');
    }
  });

  // Submit Password Reset Form
  authResetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value.trim();
    
    const submitBtn = document.getElementById('btn-reset-submit');
    const spinner = document.getElementById('reset-spinner');
    
    submitBtn.disabled = true;
    spinner.classList.remove('d-none');
    
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบในกล่องข้อความ', 'success');
      btnResetCancel.click();
    } catch (err) {
      console.error(err);
      let errMsg = 'เกิดข้อผิดพลาดในการส่งลิงก์รีเซ็ต';
      if (err.code === 'auth/user-not-found') errMsg = 'ไม่พบบัญชีผู้ใช้อีเมลนี้ในระบบ';
      showToast(errMsg, 'error');
    } finally {
      submitBtn.disabled = false;
      spinner.classList.add('d-none');
    }
  });

  // Listen to Auth State changes in real time
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAuthUI(user);
    applyFiltersAndRender();
    if (user) {
      renderAdminPanel();
    }
  });
}

function updateAuthUI(user) {
  const authHeaderContainer = document.getElementById('auth-header-container');
  const mainViewSwitcher = document.getElementById('main-view-switcher');
  const mediaGuestPromo = document.getElementById('media-guest-promo');
  const mediaTeacherFormCard = document.getElementById('media-teacher-form-card');

  if (user) {
    // Logged in: Render user badge with dropdown settings menu
    authHeaderContainer.innerHTML = `
      <div class="dropdown">
        <button class="btn btn-outline-light dropdown-toggle d-flex align-items-center gap-2 px-3 py-2 rounded-pill shadow-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="bi bi-person-check-fill text-warning"></i>
          <span class="text-truncate" style="max-width: 140px;">${user.email}</span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2" style="border-radius: 12px; z-index: 1050;">
          <li><a class="dropdown-item fw-semibold py-2" href="#" id="menu-view-library"><i class="bi bi-grid-fill me-2 text-primary"></i>คลังสื่อการสอนหลัก</a></li>
          <li><a class="dropdown-item fw-semibold py-2" href="#" id="menu-view-admin"><i class="bi bi-shield-lock-fill me-2 text-danger"></i>แผงจัดการระบบ Admin</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger fw-semibold py-2" href="#" id="menu-logout"><i class="bi bi-box-arrow-left me-2"></i>ออกจากระบบ</a></li>
        </ul>
      </div>
    `;

    // Dropdown listeners
    document.getElementById('menu-view-library').addEventListener('click', (e) => {
      e.preventDefault();
      switchView('library');
    });
    document.getElementById('menu-view-admin').addEventListener('click', (e) => {
      e.preventDefault();
      switchView('admin');
    });
    document.getElementById('menu-logout').addEventListener('click', (e) => {
      e.preventDefault();
      triggerLogout();
    });

    // Display Teacher controls & Hide guest notifications
    mainViewSwitcher.classList.remove('d-none');
    mediaGuestPromo.classList.add('d-none');
    mediaTeacherFormCard.classList.remove('d-none');

  } else {
    // Guest: Render generic Login button
    authHeaderContainer.innerHTML = `
      <button class="btn btn-outline-light d-flex align-items-center gap-2 px-3 py-2 rounded-pill shadow-sm" id="btn-show-auth-modal">
        <i class="bi bi-person-circle"></i>
        <span>เข้าสู่ระบบคุณครู</span>
      </button>
    `;

    document.getElementById('btn-show-auth-modal').addEventListener('click', () => {
      const btnTab = document.getElementById('btn-auth-tab-login');
      if (btnTab) btnTab.click();
      if (authModalInstance) authModalInstance.show();
    });

    // Display guest promo & Hide teacher features
    mainViewSwitcher.classList.add('d-none');
    mediaTeacherFormCard.classList.add('d-none');
    mediaGuestPromo.classList.remove('d-none');
    
    // Fallback view state to public library
    switchView('library');
  }
}

function switchView(view) {
  const tabLibraryView = document.getElementById('tab-library-view');
  const tabAdminView = document.getElementById('tab-admin-view');
  const libraryViewContainer = document.getElementById('library-view-container');
  const adminPanelSection = document.getElementById('admin-panel-section');

  if (view === 'library') {
    tabLibraryView.classList.add('active');
    tabAdminView.classList.remove('active');
    libraryViewContainer.classList.remove('d-none');
    adminPanelSection.classList.add('d-none');
  } else if (view === 'admin') {
    tabLibraryView.classList.remove('active');
    tabAdminView.classList.add('active');
    libraryViewContainer.classList.add('d-none');
    adminPanelSection.classList.remove('d-none');
    renderAdminPanel();
  }
}

function initViewSwitcher() {
  const tabLibraryView = document.getElementById('tab-library-view');
  const tabAdminView = document.getElementById('tab-admin-view');

  tabLibraryView.addEventListener('click', () => switchView('library'));
  tabAdminView.addEventListener('click', () => switchView('admin'));

  // Promo card login trigger
  const btnPromoLogin = document.getElementById('btn-promo-login');
  if (btnPromoLogin) {
    btnPromoLogin.addEventListener('click', () => {
      const btnTab = document.getElementById('btn-auth-tab-login');
      if (btnTab) btnTab.click();
      if (authModalInstance) authModalInstance.show();
    });
  }
}

async function triggerLogout() {
  try {
    await signOut(auth);
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  } catch (err) {
    console.error(err);
    showToast('ระบบขัดข้องในการออกจากระบบ', 'error');
  }
}

// --- Admin Dashboard Rendering ---
function renderAdminPanel() {
  if (!currentUser) return;

  const adminUserEmail = document.getElementById('admin-user-email');
  const adminUserUid = document.getElementById('admin-user-uid');
  if (adminUserEmail) adminUserEmail.textContent = currentUser.email;
  if (adminUserUid) adminUserUid.textContent = currentUser.uid;

  const adminTotalBadge = document.getElementById('admin-total-badge');
  if (adminTotalBadge) adminTotalBadge.textContent = `${allMedia.length} รายการ`;

  renderAdminTable();
}

function renderAdminTable() {
  const adminTableBody = document.getElementById('admin-table-body');
  const adminTableEmpty = document.getElementById('admin-table-empty');
  const adminSearchInput = document.getElementById('admin-search-input');
  
  if (!adminTableBody) return;

  const keyword = adminSearchInput ? adminSearchInput.value.toLowerCase().trim() : '';

  const adminFiltered = allMedia.filter(media => {
    return !keyword || 
      (media.title && media.title.toLowerCase().includes(keyword)) ||
      (media.subject && media.subject.toLowerCase().includes(keyword)) ||
      (media.category && media.category.toLowerCase().includes(keyword)) ||
      (media.author && media.author.toLowerCase().includes(keyword));
  });

  adminTableBody.innerHTML = '';

  if (adminFiltered.length === 0) {
    adminTableEmpty.classList.remove('d-none');
    return;
  }

  adminTableEmpty.classList.add('d-none');

  adminFiltered.forEach(media => {
    let catBadgeClass = 'bg-secondary';
    if (media.category === 'เอกสาร') catBadgeClass = 'cat-document';
    else if (media.category === 'วิดีโอ') catBadgeClass = 'cat-video';
    else if (media.category === 'PowerPoint') catBadgeClass = 'cat-powerpoint';
    else if (media.category === 'Google Drive') catBadgeClass = 'cat-drive';
    else if (media.category === 'เว็บไซต์') catBadgeClass = 'cat-website';
    else if (media.category === 'AI Prompt') catBadgeClass = 'cat-prompt';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <a href="${media.mediaURL}" target="_blank" rel="noopener noreferrer" class="text-decoration-none fw-semibold text-dark text-truncate-2">
          ${media.title} <i class="bi bi-box-arrow-up-right xsmall text-muted ms-1" style="font-size: 0.7rem;"></i>
        </a>
      </td>
      <td><span class="badge ${catBadgeClass} px-2 py-1 rounded-pill" style="font-size: 0.72rem;">${media.category}</span></td>
      <td><span class="text-muted small">${media.subject}</span></td>
      <td><span class="fw-medium text-secondary" style="font-size: 0.8rem;"><i class="bi bi-person me-1"></i>${media.author}</span></td>
      <td class="text-center">
        <div class="d-flex justify-content-center gap-1">
          <button class="btn btn-sm btn-outline-secondary rounded-circle px-2" id="admin-edit-${media.id}" title="แก้ไขข้อมูล">
            <i class="bi bi-pencil-square" style="font-size: 0.8rem;"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger rounded-circle px-2" id="admin-delete-${media.id}" title="ลบข้อมูล">
            <i class="bi bi-trash" style="font-size: 0.8rem;"></i>
          </button>
        </div>
      </td>
    `;

    adminTableBody.appendChild(tr);

    // Bind Edit and Delete events directly for the Admin list
    document.getElementById(`admin-edit-${media.id}`).addEventListener('click', () => {
      switchView('library');
      startEditMode(media);
    });

    document.getElementById(`admin-delete-${media.id}`).addEventListener('click', () => {
      triggerDeleteModal(media);
    });
  });
}

// --- Initialize Event Listeners on Page Load ---
document.addEventListener('DOMContentLoaded', () => {
  // Create bootstrap components
  deleteModalInstance = new bootstrap.Modal(document.getElementById('deleteModal'));
  toastInstance = new bootstrap.Toast(document.getElementById('liveToast'), { delay: 4000 });

  // Dark Mode init
  initDarkMode();

  // Cover Photo Init
  initCoverImageUpload();

  // Authentication Setup & Observables
  initAuth();
  initViewSwitcher();

  // Realtime Database Link
  initRealtimeSync();

  // Bind Submit Event
  mediaForm.addEventListener('submit', handleFormSubmit);

  // Bind Cancel Edit Event
  btnCancelEdit.addEventListener('click', (e) => {
    e.preventDefault();
    resetForm();
    showToast('ยกเลิกการแก้ไข', 'info');
  });

  // Bind Realtime Search input (keyups)
  searchKeywordInput.addEventListener('input', () => {
    currentPage = 1;
    applyFiltersAndRender();
  });

  // Bind Clear Search Button
  btnClearSearch.addEventListener('click', () => {
    searchKeywordInput.value = '';
    currentPage = 1;
    applyFiltersAndRender();
  });

  // Bind Subject filter dropdown changes
  filterSubjectSelect.addEventListener('change', () => {
    currentPage = 1;
    applyFiltersAndRender();
  });

  // Bind Grade filter dropdown changes
  filterGradeSelect.addEventListener('change', () => {
    currentPage = 1;
    applyFiltersAndRender();
  });

  // Bind Sorting select changes
  sortOrderSelect.addEventListener('change', () => {
    currentPage = 1;
    applyFiltersAndRender();
  });

  // Bind Category Sub-Filter Badges (Category Buttons)
  const categoryButtons = document.querySelectorAll('.btn-category-filter');
  categoryButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Toggle Active classes
      categoryButtons.forEach(b => {
        b.classList.remove('active', 'btn-dark');
        b.classList.add('btn-outline-secondary');
      });
      
      btn.classList.remove('btn-outline-secondary');
      btn.classList.add('active', 'btn-dark');

      currentCategoryFilter = btn.getAttribute('data-category');
      currentPage = 1;
      applyFiltersAndRender();
    });
  });

  // Reset Filters button (Empty state action)
  btnClearAllFilters.addEventListener('click', () => {
    searchKeywordInput.value = '';
    filterSubjectSelect.value = '';
    filterGradeSelect.value = '';
    currentCategoryFilter = '';
    
    // Reset category buttons
    categoryButtons.forEach(b => {
      b.classList.remove('active', 'btn-dark');
      b.classList.add('btn-outline-secondary');
    });
    categoryButtons[0].classList.remove('btn-outline-secondary');
    categoryButtons[0].classList.add('active', 'btn-dark');

    currentPage = 1;
    applyFiltersAndRender();
  });

  // Confirm delete click listener
  document.getElementById('btn-confirm-delete').addEventListener('click', handleConfirmDelete);

  // Admin Fast Management Table keypresses
  const adminSearchInput = document.getElementById('admin-search-input');
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', () => {
      renderAdminTable();
    });
  }

  // Admin Profile Password reset triggers
  const btnAdminResetPwd = document.getElementById('btn-admin-reset-pwd');
  if (btnAdminResetPwd) {
    btnAdminResetPwd.addEventListener('click', async () => {
      if (!currentUser) return;
      try {
        await sendPasswordResetEmail(auth, currentUser.email);
        showToast(`ระบบได้ส่งลิงก์ตั้งค่ารหัสผ่านใหม่ไปยังอีเมล "${currentUser.email}" เรียบร้อยแล้ว`, 'success');
      } catch (err) {
        console.error(err);
        showToast('ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง', 'error');
      }
    });
  }

  const btnAdminLogout = document.getElementById('btn-admin-logout');
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      triggerLogout();
    });
  }

  // Back to Top functionality
  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      btnBackToTop.classList.add('show');
    } else {
      btnBackToTop.classList.remove('show');
    }
  });

  btnBackToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Pagination Prev Click listener
  pagePrev.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentPage > 1) {
      currentPage--;
      applyFiltersAndRender();
      scrollToGallery();
    }
  });

  // Pagination Next Click listener
  pageNext.addEventListener('click', (e) => {
    e.preventDefault();
    const totalPages = Math.ceil(filteredMedia.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      applyFiltersAndRender();
      scrollToGallery();
    }
  });
});
