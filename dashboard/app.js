/* ============================================
   RAYMELLS DASHBOARD — app.js
   ============================================ */

const API = 'https://breezy-api-r7jg.onrender.com';
const CLOUDINARY_CLOUD   = 'don9ua5xz';       // ← replace
const CLOUDINARY_PRESET  = 'arrive_units';
const CLOUDINARY_FOLDER  = 'raymells';

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let authToken      = localStorage.getItem('rml_token') || null;
let currentUser    = JSON.parse(localStorage.getItem('rml_user') || 'null');
let allCars        = [];
let allBookings    = [];
let allCategories  = [];
let uploadedImages = []; // { url, public_id } — ordered, [0] = hero
let editingCarId   = null;
let selectionMode  = false;
let selectedCar    = null;

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  if (authToken) {
    showApp();
  }

  // Login on Enter
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });
  document.getElementById('login-username').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });

  // Image drag-drop on upload area
  const uploadArea = document.getElementById('image-upload-area');
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleImageFiles(e.dataTransfer.files);
  });
});

/* ══════════════════════════════════════════
   AUTH
══════════════════════════════════════════ */
async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  if (!username || !password) {
    errEl.textContent = 'Please enter your username and password.';
    errEl.classList.add('show');
    return;
  }

  btn.disabled  = true;
  btn.textContent = 'Signing in…';
  errEl.classList.remove('show');

  try {
    const res  = await fetch(`${API}/raymells/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Login failed');

    authToken   = data.token;
    currentUser = { username: data.username || username };
    localStorage.setItem('rml_token', authToken);
    localStorage.setItem('rml_user', JSON.stringify(currentUser));

    showApp();
  } catch (err) {
    errEl.textContent = err.message || 'Invalid credentials.';
    errEl.classList.add('show');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Sign in';
  }
}

function logout() {
  authToken   = null;
  currentUser = null;
  localStorage.removeItem('rml_token');
  localStorage.removeItem('rml_user');
  document.getElementById('app').classList.add('hidden');
  const gate = document.getElementById('login-gate');
  gate.classList.remove('hidden');
  gate.style.opacity = '1';
  gate.style.pointerEvents = 'all';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').classList.remove('show');
}

function showApp() {
  const gate = document.getElementById('login-gate');
  gate.classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  if (currentUser) {
    const initials = (currentUser.username || 'A')[0].toUpperCase();
    document.getElementById('sidebar-avatar').textContent   = initials;
    document.getElementById('sidebar-username').textContent = currentUser.username || 'Admin';
    document.getElementById('settings-username').textContent = currentUser.username || 'Admin';
  }

  loadCategories();
  loadCars();
  loadBookings();
}

/* ══════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════ */
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');
  closeSidebar();
}

function toggleSidebar() {
  const sidebar   = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  const overlay   = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  hamburger.classList.toggle('open');
  overlay.classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

/* ══════════════════════════════════════════
   MODALS
══════════════════════════════════════════ */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open');
  }
});

function showConfirm(title, message, onConfirm, danger = true) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  const btn = document.getElementById('confirm-action-btn');
  btn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
  btn.textContent = 'Confirm';
  btn.onclick = () => { closeModal('modal-confirm'); onConfirm(); };
  openModal('modal-confirm');
}

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */
function toast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, duration);
}

/* ══════════════════════════════════════════
   API HELPERS
══════════════════════════════════════════ */
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res  = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (res.status === 401) { logout(); throw new Error('Session expired'); }
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

/* ══════════════════════════════════════════
   CATEGORIES
══════════════════════════════════════════ */
async function loadCategories() {
  try {
    const data = await apiFetch('/raymells/categories/list');
    allCategories = data.categories || [];
    populateCategorySelects();
  } catch (e) {
    console.warn('Categories load failed:', e.message);
  }
}

function populateCategorySelects() {
  const filterSel = document.getElementById('cars-category-filter');
  const formSel   = document.getElementById('car-category');

  // Keep default options
  filterSel.innerHTML = '<option value="">All categories</option>';
  formSel.innerHTML   = '<option value="">Select category…</option>';

  allCategories.forEach(cat => {
    const name = cat.name || cat;
    filterSel.innerHTML += `<option value="${name}">${name}</option>`;
    formSel.innerHTML   += `<option value="${name}">${name}</option>`;
  });
}

/* ══════════════════════════════════════════
   CARS — LOAD & RENDER
══════════════════════════════════════════ */
async function loadCars() {
  try {
    const data = await apiFetch('/raymells/cars/list?all=true');
    allCars = data.cars || [];
    document.getElementById('cars-count').textContent = `${allCars.length} cars`;
    renderCars(allCars);
  } catch (e) {
    toast('Failed to load cars: ' + e.message, 'error');
    document.getElementById('cars-grid').innerHTML = `<div class="empty-state"><p>Could not load cars.</p></div>`;
  }
}

function renderCars(cars) {
  const grid = document.getElementById('cars-grid');
  if (!cars.length) {
    grid.innerHTML = `<div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>
      <p>No cars found</p>
      <small>Add your first car using the button above.</small>
    </div>`;
    return;
  }

  grid.innerHTML = cars.map(car => {
    const heroImg  = car.images && car.images[0] ? car.images[0] : null;
    const imgHtml  = heroImg
      ? `<img src="${heroImg}" alt="${car.name}" loading="lazy" />`
      : `<div class="car-image-placeholder"><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18M3.75 6h16.5"/></svg></div>`;

    const activeLabel = car.active
      ? `<span class="badge badge-confirmed car-active-badge">Active</span>`
      : `<span class="badge badge-cancelled car-active-badge">Inactive</span>`;

    const selClass = selectionMode ? 'selection-mode' : '';
    const inactiveClass = !car.active ? 'inactive' : '';
    const clickHandler = selectionMode ? `onclick="selectCarForBooking('${car._id}')"` : '';

    return `
    <div class="car-card ${selClass} ${inactiveClass}" id="car-card-${car._id}" ${clickHandler}>
      <div class="car-image-wrap">
        ${imgHtml}
        <span class="car-code-badge">${car.car_code || '—'}</span>
        ${activeLabel}
      </div>
      <div class="car-body">
        <div class="car-name">${car.name}</div>
        <div class="car-category">${car.category || 'Uncategorised'}</div>
        <div class="car-meta">
          <div class="car-meta-item">
            <span class="car-meta-label">Per Day</span>
            <span class="car-meta-value amber">KES ${formatNum(car.price_per_day)}</span>
          </div>
          <div class="car-meta-item">
            <span class="car-meta-label">Insurance</span>
            <span class="car-meta-value">KES ${formatNum(car.insurance_fee)}</span>
          </div>
          <div class="car-meta-item">
            <span class="car-meta-label">Seats</span>
            <span class="car-meta-value">${car.seats}</span>
          </div>
          <div class="car-meta-item">
            <span class="car-meta-label">Transmission</span>
            <span class="car-meta-value">${car.transmission || '—'}</span>
          </div>
        </div>
      </div>
      ${!selectionMode ? `
      <div class="car-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditCar('${car._id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg>
          Edit
        </button>
        <button class="btn btn-secondary btn-sm" onclick="toggleCarActive('${car._id}', ${car.active})">
          ${car.active ? 'Deactivate' : 'Activate'}
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteCar('${car._id}', '${car.name}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
          Delete
        </button>
      </div>` : ''}
    </div>`;
  }).join('');
}

function filterCars() {
  const q        = document.getElementById('cars-search').value.toLowerCase().trim();
  const category = document.getElementById('cars-category-filter').value;
  const status   = document.getElementById('cars-status-filter').value;

  const filtered = allCars.filter(car => {
    const matchQ = !q || car.name.toLowerCase().includes(q) || (car.car_code || '').toLowerCase().includes(q);
    const matchCat = !category || car.category === category;
    const matchStatus = !status || (status === 'active' ? car.active : !car.active);
    return matchQ && matchCat && matchStatus;
  });
  renderCars(filtered);
}

/* ── Add / Edit Car ── */
function openAddCar() {
  editingCarId    = null;
  uploadedImages  = [];
  document.getElementById('car-modal-title').textContent = 'Add New Car';
  document.getElementById('car-edit-id').value           = '';
  document.getElementById('car-name').value              = '';
  document.getElementById('car-category').value          = '';
  document.getElementById('car-description').value       = '';
  document.getElementById('car-price').value             = '';
  document.getElementById('car-insurance').value         = '';
  document.getElementById('car-seats').value             = '';
  document.getElementById('car-transmission').value      = '';
  document.getElementById('car-pickup').value            = '';
  document.getElementById('car-active').checked          = true;
  renderImagePreviews();
  openModal('modal-add-car');
}

function openEditCar(carId) {
  const car = allCars.find(c => c._id === carId);
  if (!car) return;
  editingCarId   = carId;
  uploadedImages = (car.images || []).map(url => ({ url }));

  document.getElementById('car-modal-title').textContent = 'Edit Car';
  document.getElementById('car-edit-id').value           = carId;
  document.getElementById('car-name').value              = car.name || '';
  document.getElementById('car-category').value          = car.category || '';
  document.getElementById('car-description').value       = car.description || '';
  document.getElementById('car-price').value             = car.price_per_day || '';
  document.getElementById('car-insurance').value         = car.insurance_fee || '';
  document.getElementById('car-seats').value             = car.seats || '';
  document.getElementById('car-transmission').value      = car.transmission || '';
  document.getElementById('car-pickup').value            = car.pickup_location || '';
  document.getElementById('car-active').checked          = car.active !== false;

  renderImagePreviews();
  openModal('modal-add-car');
}

async function saveCar() {
  const name         = document.getElementById('car-name').value.trim();
  const category     = document.getElementById('car-category').value;
  const description  = document.getElementById('car-description').value.trim();
  const price_per_day   = parseFloat(document.getElementById('car-price').value);
  const insurance_fee   = parseFloat(document.getElementById('car-insurance').value);
  const seats           = parseInt(document.getElementById('car-seats').value);
  const transmission    = document.getElementById('car-transmission').value;
  const pickup_location = document.getElementById('car-pickup').value.trim();
  const active          = document.getElementById('car-active').checked;

  if (!name || !category || isNaN(price_per_day) || isNaN(insurance_fee) || isNaN(seats) || !transmission) {
    toast('Please fill in all required fields.', 'error');
    return;
  }

  const images = uploadedImages.map(img => img.url);
  const payload = { name, category, description, price_per_day, insurance_fee, seats, transmission, pickup_location, active, images };

  const btn = document.getElementById('car-save-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  try {
    if (editingCarId) {
      await apiFetch(`/raymells/cars/update`, {
        method: 'POST',
        body: JSON.stringify({ car_id: editingCarId, ...payload }),
      });
      toast('Car updated successfully.', 'success');
    } else {
      await apiFetch('/raymells/cars/add', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast('Car added successfully.', 'success');
    }
    closeModal('modal-add-car');
    loadCars();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Save Car';
  }
}

async function toggleCarActive(carId, currentActive) {
  const car = allCars.find(c => c._id === carId);
  if (!car) return;
  const action = currentActive ? 'deactivate' : 'activate';
  showConfirm(
    `${currentActive ? 'Deactivate' : 'Activate'} ${car.name}?`,
    currentActive ? 'This car will no longer appear in uChat or the booking flow.' : 'This car will become visible in uChat and available for booking.',
    async () => {
      try {
        await apiFetch('/raymells/cars/update', {
          method: 'POST',
          body: JSON.stringify({ car_id: carId, active: !currentActive }),
        });
        toast(`Car ${action}d.`, 'success');
        loadCars();
      } catch (e) {
        toast('Error: ' + e.message, 'error');
      }
    }
  );
}

async function deleteCar(carId, carName) {
  showConfirm(
    `Delete ${carName}?`,
    'This car and all its data will be permanently removed. This cannot be undone.',
    async () => {
      try {
        await apiFetch('/raymells/cars/delete', {
          method: 'POST',
          body: JSON.stringify({ car_id: carId }),
        });
        toast('Car deleted.', 'success');
        loadCars();
      } catch (e) {
        toast('Error: ' + e.message, 'error');
      }
    }
  );
}

/* ── Image Upload ── */
async function handleImageFiles(files) {
  const remaining = 20 - uploadedImages.length;
  if (remaining <= 0) { toast('Maximum 20 images per car.', 'error'); return; }

  const toUpload = Array.from(files).slice(0, remaining);
  const prog     = document.getElementById('upload-progress');
  prog.style.display = 'block';
  prog.textContent   = `Uploading 0 / ${toUpload.length}…`;

  for (let i = 0; i < toUpload.length; i++) {
    const file = toUpload[i];
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_PRESET);
      formData.append('folder', CLOUDINARY_FOLDER);

      const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: 'POST', body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        uploadedImages.push({ url: data.secure_url, public_id: data.public_id });
        renderImagePreviews();
      }
    } catch (e) {
      toast(`Failed to upload image ${i + 1}.`, 'error');
    }
    prog.textContent = `Uploading ${i + 1} / ${toUpload.length}…`;
  }

  prog.textContent = `${uploadedImages.length} image${uploadedImages.length !== 1 ? 's' : ''} ready.`;
  setTimeout(() => { prog.style.display = 'none'; }, 2000);
}

function renderImagePreviews() {
  const grid = document.getElementById('image-preview-grid');
  grid.innerHTML = uploadedImages.map((img, i) => `
    <div class="image-preview-item ${i === 0 ? 'hero-img' : ''}"
         draggable="true"
         data-index="${i}"
         ondragstart="dragStart(event, ${i})"
         ondragover="dragOver(event)"
         ondrop="dragDrop(event, ${i})"
         ondragend="dragEnd(event)">
      <img src="${img.url}" alt="Car image ${i + 1}" />
      ${i === 0 ? '<div class="hero-label">Cover</div>' : ''}
      <button class="remove-img" onclick="removeImage(${i})" title="Remove">✕</button>
    </div>
  `).join('');

  // Show/hide upload area
  document.getElementById('image-upload-area').style.display = uploadedImages.length >= 20 ? 'none' : '';
}

function removeImage(index) {
  uploadedImages.splice(index, 1);
  renderImagePreviews();
}

// Drag-to-reorder
let dragSrcIndex = null;
function dragStart(e, index) {
  dragSrcIndex = index;
  e.currentTarget.classList.add('dragging');
}
function dragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-target');
}
function dragDrop(e, targetIndex) {
  e.preventDefault();
  if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;
  const moved = uploadedImages.splice(dragSrcIndex, 1)[0];
  uploadedImages.splice(targetIndex, 0, moved);
  renderImagePreviews();
}
function dragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.image-preview-item').forEach(el => el.classList.remove('drag-target'));
  dragSrcIndex = null;
}

/* ══════════════════════════════════════════
   BOOKINGS — LOAD & RENDER
══════════════════════════════════════════ */
async function loadBookings() {
  try {
    const data = await apiFetch('/raymells/bookings/list');
    allBookings = (data.bookings || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    document.getElementById('bookings-count').textContent = `${allBookings.length} bookings`;
    renderBookings(allBookings);
  } catch (e) {
    toast('Failed to load bookings: ' + e.message, 'error');
  }
}

function renderBookings(bookings) {
  const tbody = document.getElementById('bookings-tbody');
  if (!bookings.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="40" height="40"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
      <p>No bookings yet</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    const visitNum  = b.visit_number || 1;
    const isRepeat  = visitNum > 1;
    const isMilestone = [3, 5, 10].includes(visitNum) || visitNum >= 10;
    const rowClass  = isMilestone ? 'milestone-guest' : isRepeat ? 'repeat-guest' : '';

    const visitClass = visitNum >= 10 ? 'visit-vip' : visitNum >= 5 ? 'visit-5' : visitNum >= 3 ? 'visit-3' : visitNum >= 2 ? 'visit-2' : 'visit-1';
    const visitBadge = isRepeat ? `<span class="visit-badge ${visitClass}" title="Visit #${visitNum}">${visitNum}</span>` : '';

    const guestName = b.guest_name || '—';
    const guestPhone = b.guest_phone || '';

    const startDate = b.start_date ? formatDate(b.start_date) : '—';
    const endDate   = b.end_date   ? formatDate(b.end_date)   : '—';

    return `
    <tr class="${rowClass}" onclick="openBookingDetail('${b._id}')" style="cursor:pointer;">
      <td>
        <div class="guest-name-cell">
          ${visitBadge}
          <div>
            <div style="font-weight:500;">${guestName}</div>
            <div style="font-size:11px;color:var(--text-muted);">${guestPhone}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="booking-ref">${b.reference || '—'}</div>
        <div class="booking-car">${b.car_name || '—'}</div>
      </td>
      <td><span style="font-size:12px;color:var(--text-muted);">${b.car_code || '—'}</span></td>
      <td>
        <div class="booking-dates">${startDate}</div>
        <div class="booking-dates" style="color:var(--text-faint);">→ ${endDate}</div>
      </td>
      <td>
        <div class="booking-amount">KES ${formatNum(b.total || 0)}</div>
        <div style="font-size:11px;color:var(--text-muted);">Dep: ${formatNum(b.deposit || 0)}</div>
      </td>
      <td><span class="badge badge-${b.status}">${statusLabel(b.status)}</span></td>
      <td onclick="event.stopPropagation()">
        <div class="action-buttons">
          ${getActionButtons(b)}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterBookings() {
  const q      = document.getElementById('bookings-search').value.toLowerCase().trim();
  const status = document.getElementById('bookings-status-filter').value;

  const filtered = allBookings.filter(b => {
    const matchQ = !q ||
      (b.reference || '').toLowerCase().includes(q) ||
      (b.guest_name || '').toLowerCase().includes(q) ||
      (b.guest_phone || '').toLowerCase().includes(q);
    const matchStatus = !status || b.status === status;
    return matchQ && matchStatus;
  });
  renderBookings(filtered);
}

function getActionButtons(b) {
  const id = b._id;
  switch (b.status) {
    case 'pending':
      return `
        <button class="btn btn-secondary btn-xs" onclick="bookingAction('confirm','${id}')">Confirm</button>
        <button class="btn btn-danger btn-xs" onclick="bookingAction('cancel','${id}')">Cancel</button>`;
    case 'confirmed':
      return `
        <button class="btn btn-primary btn-xs" onclick="bookingAction('checkout','${id}')">Check Out</button>
        <button class="btn btn-danger btn-xs" onclick="bookingAction('cancel','${id}')">Cancel</button>`;
    case 'checked_out':
      return `<button class="btn btn-secondary btn-xs" onclick="bookingAction('returned','${id}')">Mark Returned</button>`;
    case 'returned':
    case 'cancelled':
      return `<button class="btn btn-ghost btn-xs" onclick="bookingAction('delete','${id}')">Delete</button>`;
    default:
      return '—';
  }
}

async function bookingAction(action, bookingId) {
  const booking = allBookings.find(b => b._id === bookingId);
  if (!booking) return;

  const actionMap = {
    confirm:   { label: 'Confirm',       path: '/raymells/bookings/confirm',   danger: false },
    cancel:    { label: 'Cancel',         path: '/raymells/bookings/cancel',    danger: true  },
    checkout:  { label: 'Check Out',      path: '/raymells/bookings/checkout',  danger: false },
    returned:  { label: 'Mark Returned',  path: '/raymells/bookings/returned',  danger: false },
    delete:    { label: 'Delete',         path: '/raymells/bookings/delete',    danger: true  },
  };
  const cfg = actionMap[action];
  if (!cfg) return;

  const confirmMsg = action === 'delete'
    ? `Permanently delete booking ${booking.reference}?`
    : `${cfg.label} booking ${booking.reference}?`;

  showConfirm(`${cfg.label} Booking`, confirmMsg, async () => {
    try {
      const body = action === 'returned'
        ? { booking_id: bookingId, opted_in: true, review_skipped: false }
        : { booking_id: bookingId };

      await apiFetch(cfg.path, { method: 'POST', body: JSON.stringify(body) });
      toast(`Booking ${cfg.label.toLowerCase()}ed.`, 'success');
      loadBookings();
      closeModal('modal-booking-detail');
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
  }, cfg.danger);
}

/* ── Booking Detail Modal ── */
function openBookingDetail(bookingId) {
  const b = allBookings.find(x => x._id === bookingId);
  if (!b) return;

  const body = document.getElementById('booking-detail-body');
  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
      <span class="badge badge-${b.status}" style="font-size:12px;padding:5px 12px;">${statusLabel(b.status)}</span>
      <span class="booking-ref" style="font-size:14px;">${b.reference || '—'}</span>
    </div>
    <div class="booking-detail-grid">
      <div class="detail-field"><label>Guest</label><p>${b.guest_name || '—'}</p></div>
      <div class="detail-field"><label>Phone</label><p>${b.guest_phone || '—'}</p></div>
      <div class="detail-field"><label>Email</label><p>${b.guest_email || '—'}</p></div>
      <div class="detail-field"><label>Visit #</label><p>${b.visit_number || 1}</p></div>
      <div class="detail-field"><label>Car</label><p>${b.car_name || '—'} ${b.car_code ? `<span style="color:var(--amber);font-family:var(--font-display);font-size:11px;">(${b.car_code})</span>` : ''}</p></div>
      <div class="detail-field"><label>Pickup Date</label><p>${b.start_date ? formatDate(b.start_date) : '—'}</p></div>
      <div class="detail-field"><label>Return Date</label><p>${b.end_date ? formatDate(b.end_date) : '—'}</p></div>
      <div class="detail-field"><label>Delivery</label><p>${b.delivery ? 'Yes (+KES 1,500)' : 'No'}</p></div>
    </div>
    <div class="booking-calc">
      <div class="booking-calc-row"><span>Total</span><span>KES ${formatNum(b.total || 0)}</span></div>
      <div class="booking-calc-row deposit"><span>Deposit (50%)</span><span>KES ${formatNum(b.deposit || 0)}</span></div>
      <div class="booking-calc-row"><span>Balance</span><span>KES ${formatNum(b.balance || 0)}</span></div>
    </div>
    ${b.discount_code_applied ? `<div style="margin-top:12px;font-size:13px;color:var(--text-muted);">Discount code applied: <span style="color:var(--amber);font-family:var(--font-display);">${b.discount_code_applied}</span></div>` : ''}
    ${b.notes ? `<div style="margin-top:12px;font-size:13px;color:var(--text-muted);">Notes: ${b.notes}</div>` : ''}
  `;

  const footer = document.getElementById('booking-detail-actions');
  footer.innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('modal-booking-detail')">Close</button>
    ${getActionButtons(b).replace(/bookingAction/g, "bookingAction")}
  `;
  openModal('modal-booking-detail');
}

/* ══════════════════════════════════════════
   MANUAL BOOKING FLOW
══════════════════════════════════════════ */
function startManualBooking() {
  // Switch to cars tab in selection mode
  selectionMode = true;
  selectedCar   = null;
  switchTab('cars');
  renderCars(allCars);
  document.getElementById('selection-banner').classList.add('show');
}

function cancelSelectionMode() {
  selectionMode = false;
  selectedCar   = null;
  document.getElementById('selection-banner').classList.remove('show');
  renderCars(allCars);
}

function selectCarForBooking(carId) {
  if (!selectionMode) return;
  selectedCar = allCars.find(c => c._id === carId);
  if (!selectedCar) return;

  // Exit selection mode
  selectionMode = false;
  document.getElementById('selection-banner').classList.remove('show');
  renderCars(allCars);

  // Populate and open manual booking modal
  populateManualBookingModal(selectedCar);
  switchTab('bookings');
  openModal('modal-manual-booking');
}

function populateManualBookingModal(car) {
  document.getElementById('manual-car-name').textContent = car.name;
  document.getElementById('manual-car-code').textContent = car.car_code || '—';
  document.getElementById('manual-car-meta').textContent =
    `${car.category || ''} · KES ${formatNum(car.price_per_day)}/day · ${car.seats} seats`;

  const thumb = document.getElementById('manual-car-thumb');
  if (car.images && car.images[0]) {
    thumb.src           = car.images[0];
    thumb.style.display = 'block';
  } else {
    thumb.style.display = 'none';
  }

  // Reset form fields
  ['mb-name','mb-phone','mb-email','mb-instagram','mb-discount','mb-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('mb-start').value    = '';
  document.getElementById('mb-end').value      = '';
  document.getElementById('mb-delivery').checked = false;
  document.getElementById('booking-calc').style.display = 'none';
}

function calcManualTotal() {
  if (!selectedCar) return;
  const start    = document.getElementById('mb-start').value;
  const end      = document.getElementById('mb-end').value;
  const delivery = document.getElementById('mb-delivery').checked;

  if (!start || !end) return;

  const days = Math.ceil((new Date(end) - new Date(start)) / 86400000);
  if (days <= 0) { toast('Return date must be after pickup date.', 'error'); return; }

  const rate      = selectedCar.price_per_day || 0;
  const insurance = selectedCar.insurance_fee  || 0;
  const delFee    = delivery ? 1500 : 0;
  const total     = (rate * days) + insurance + delFee;
  const deposit   = Math.round(total * 0.5);
  const balance   = total - deposit;

  document.getElementById('calc-days').textContent          = days;
  document.getElementById('calc-rate-label').textContent    = `KES ${formatNum(rate)} × ${days} day${days !== 1 ? 's' : ''}`;
  document.getElementById('calc-rate').textContent          = `KES ${formatNum(rate * days)}`;
  document.getElementById('calc-insurance').textContent     = `KES ${formatNum(insurance)}`;
  document.getElementById('calc-delivery-row').style.display = delivery ? '' : 'none';
  document.getElementById('calc-total').textContent         = `KES ${formatNum(total)}`;
  document.getElementById('calc-deposit').textContent       = `KES ${formatNum(deposit)}`;
  document.getElementById('calc-balance').textContent       = `KES ${formatNum(balance)}`;
  document.getElementById('booking-calc').style.display     = '';
}

async function submitManualBooking() {
  if (!selectedCar) { toast('No car selected.', 'error'); return; }

  const name     = document.getElementById('mb-name').value.trim();
  const phone    = document.getElementById('mb-phone').value.trim();
  const email    = document.getElementById('mb-email').value.trim();
  const instagram = document.getElementById('mb-instagram').value.trim();
  const start    = document.getElementById('mb-start').value;
  const end      = document.getElementById('mb-end').value;
  const delivery = document.getElementById('mb-delivery').checked;
  const discount = document.getElementById('mb-discount').value.trim().toUpperCase();
  const notes    = document.getElementById('mb-notes').value.trim();

  if (!name || !phone || !start || !end) {
    toast('Please fill in all required fields.', 'error');
    return;
  }

  const days = Math.ceil((new Date(end) - new Date(start)) / 86400000);
  if (days <= 0) { toast('Invalid date range.', 'error'); return; }

  const btn = document.getElementById('manual-booking-btn');
  btn.disabled    = true;
  btn.textContent = 'Creating…';

  try {
    await apiFetch('/raymells/bookings/manual', {
      method: 'POST',
      body: JSON.stringify({
        car_id:               selectedCar._id,
        guest_name:           name,
        guest_phone:          phone,
        guest_email:          email,
        instagram_username:   instagram,
        start_date:           start,
        end_date:             end,
        delivery,
        discount_code_applied: discount || undefined,
        notes,
      }),
    });
    toast('Manual booking created and confirmed.', 'success');
    closeModal('modal-manual-booking');
    selectedCar = null;
    loadBookings();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Confirm Booking';
  }
}

/* ══════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════ */
async function changePassword() {
  const current = document.getElementById('pw-current').value;
  const newPw   = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;

  if (!current || !newPw || !confirm) { toast('Please fill in all password fields.', 'error'); return; }
  if (newPw !== confirm) { toast('New passwords do not match.', 'error'); return; }
  if (newPw.length < 8)  { toast('Password must be at least 8 characters.', 'error'); return; }

  try {
    await apiFetch('/raymells/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: current, new_password: newPw }),
    });
    toast('Password updated successfully.', 'success');
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value     = '';
    document.getElementById('pw-confirm').value = '';
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */
function formatNum(n) {
  return Number(n || 0).toLocaleString('en-KE');
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusLabel(s) {
  const map = {
    pending:     'Pending',
    confirmed:   'Confirmed',
    checked_out: 'Checked Out',
    returned:    'Returned',
    cancelled:   'Cancelled',
  };
  return map[s] || s;
}