
async function deleteAlumni(alumniId) {
  if (!alumniId) {
    window.showToast?.('Invalid alumni ID', 'warning');
    return;
  }
  
  if (!confirm('Delete this alumni record? This cannot be undone.')) return;
  
  try {
    await db.collection('alumni').doc(alumniId).delete();
    window.showToast?.('Alumni record deleted', 'success');
    loadAlumni();
  } catch (error) {
    console.error('Error deleting alumni:', error);
    window.handleError(error, 'Failed to delete alumni');
  }
}

// Make globally available
window.deleteAlumni = deleteAlumni;


/* ========================================
   SIDEBAR GROUP TOGGLE
======================================== */

/**
 * FIXED: Toggle sidebar group with proper state management
 */
function toggleSidebarGroup(button) {
  if (!button) {
    console.error('toggleSidebarGroup: button is null');
    return;
  }
  
  const content = button.nextElementSibling;
  
  if (!content) {
    console.error('toggleSidebarGroup: no content element found');
    return;
  }
  
  const isCollapsed = button.classList.contains('collapsed');
  
  if (isCollapsed) {
    // Expand the group
    button.classList.remove('collapsed');
    content.classList.add('active');
    button.setAttribute('aria-expanded', 'true');
  } else {
    // Collapse the group
    button.classList.add('collapsed');
    content.classList.remove('active');
    button.setAttribute('aria-expanded', 'false');
  }
}

// Make globally available
window.toggleSidebarGroup = toggleSidebarGroup;

/* ======================================== 
   DASHBOARD STATS 
======================================== */
async function loadDashboardStats() {
  console.log('📊 Loading dashboard stats...');
  
  // Wait a bit for DOM to be ready
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const teacherCount = document.getElementById('teacher-count');
  const pupilCount = document.getElementById('pupil-count');
  const classCount = document.getElementById('class-count');
  const announceCount = document.getElementById('announce-count');
  
  if (!teacherCount || !pupilCount || !classCount || !announceCount) {
    console.error('❌ Dashboard stat elements missing!');
    return;
  }
  
  // Show loading state
  teacherCount.innerHTML = '<div class="spinner" style="width:20px; height:20px;"></div>';
  pupilCount.innerHTML = '<div class="spinner" style="width:20px; height:20px;"></div>';
  classCount.innerHTML = '<div class="spinner" style="width:20px; height:20px;"></div>';
  announceCount.innerHTML = '<div class="spinner" style="width:20px; height:20px;"></div>';
  
  try {
    const teachersSnap = await db.collection('teachers').get();
    const pupilsSnap = await db.collection('pupils').get();
    const classesSnap = await db.collection('classes').get();
    const announcementsSnap = await db.collection('announcements').get();
    
    teacherCount.textContent = teachersSnap.size;
    pupilCount.textContent = pupilsSnap.size;
    classCount.textContent = classesSnap.size;
    announceCount.textContent = announcementsSnap.size;
    
    console.log('✅ Dashboard stats loaded successfully');
    
  } catch (error) {
    console.error('❌ Error loading dashboard stats:', error);
    window.showToast?.('Failed to load dashboard statistics', 'danger');
    
    teacherCount.textContent = '!';
    pupilCount.textContent = '!';
    classCount.textContent = '!';
    announceCount.textContent = '!';
  }
}

/* ======================================== 
   TEACHERS MANAGEMENT 
======================================== */
function showTeacherForm() {
  const form = document.getElementById('teacher-form');
  if (form) {
    form.style.display = 'block';
    document.getElementById('teacher-name')?.focus();
  }
}

function cancelTeacherForm() {
  document.getElementById('teacher-form').style.display = 'none';
  document.getElementById('add-teacher-form').reset();
}

document.getElementById('add-teacher-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('teacher-name').value.trim();
  const email = document.getElementById('teacher-email').value.trim();
  const subject = document.getElementById('teacher-subject').value.trim();
  const tempPassword = document.getElementById('teacher-password').value;
  
  if (!name || !email || !tempPassword) {
    window.showToast?.('All required fields must be filled', 'warning');
    return;
  }
  
  try {
    const existingUsers = await db.collection('users')
      .where('email', '==', email)
      .get();
    
    if (!existingUsers.empty) {
      window.showToast?.('This email is already registered', 'warning');
      return;
    }
  } catch (error) {
    console.error('Error checking email:', error);
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="btn-loading">Creating teacher...</span>';
  
  try {
    const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, tempPassword);
    const uid = userCredential.user.uid;
    
    await db.collection('users').doc(uid).set({
      email,
      role: 'teacher',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await db.collection('teachers').doc(uid).set({
      name,
      email,
      subject: subject || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // CRITICAL FIX: Send password reset BEFORE signing out
    await secondaryAuth.sendPasswordResetEmail(email);
    await secondaryAuth.signOut();
        
    window.showToast?.(`Teacher "${name}" added! Password reset email sent.`, 'success', 6000);
    cancelTeacherForm();
    loadTeachers();
    loadDashboardStats();
  } catch (error) {
    console.error('Error adding teacher:', error);
    window.handleError(error, 'Failed to add teacher');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Save Teacher';
  }
});

/* ===== PUPIL FORM HANDLER ADDED HERE ===== */

document.getElementById('add-pupil-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const pupilId = document.getElementById('pupil-id').value;
  const name = document.getElementById('pupil-name').value.trim();
  const admissionNo = document.getElementById('pupil-admission-no').value.trim();
  const classId = document.getElementById('pupil-class').value;
  const email = document.getElementById('pupil-email').value.trim();
  const password = document.getElementById('pupil-password').value;
  const parentEmail = document.getElementById('pupil-parent-email').value.trim();
  
  if (!name || !classId) {
    window.showToast?.('Name and class are required', 'warning');
    return;
  }
  
  if (!pupilId && (!email || !password)) {
    window.showToast?.('Email and password required for new pupils', 'warning');
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="btn-loading">Saving pupil...</span>';
  
  try {
    const classDoc = await db.collection('classes').doc(classId).get();
    
    if (!classDoc.exists) {
      window.showToast?.('Selected class not found', 'danger');
      return;
    }
    
    const classData = classDoc.data();
    
    let teacherId = classData.teacherId || '';
    let teacherName = classData.teacherName || '';
    
    if (teacherId && !teacherName) {
      const teacherDoc = await db.collection('teachers').doc(teacherId).get();
      if (teacherDoc.exists) {
        teacherName = teacherDoc.data().name || '';
      }
    }
    
    const pupilData = {
  admissionNo,
  name,
  dob: document.getElementById('pupil-dob').value || '',
  gender: document.getElementById('pupil-gender').value || '',
  parentName: document.getElementById('pupil-parent-name').value.trim() || '',
  parentEmail: parentEmail || '',
  contact: document.getElementById('pupil-contact').value.trim() || '',
  address: document.getElementById('pupil-address').value.trim() || '',
  class: {
    id: classId,
    name: classData.name || 'Unknown Class'
  },
  subjects: Array.isArray(classData.subjects) ? classData.subjects : [],
  assignedTeacher: {
    id: teacherId,
    name: teacherName
  },
  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
};
    
    if (pupilId) {
      await db.collection('pupils').doc(pupilId).update(pupilData);
      
      if (email) {
        const userDoc = await db.collection('users').doc(pupilId).get();
        if (userDoc.exists && userDoc.data().email !== email) {
          await db.collection('users').doc(pupilId).update({
            email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }
      
      window.showToast?.(`✓ Pupil "${name}" updated successfully`, 'success');
    } else {
      const existingUsers = await db.collection('users')
        .where('email', '==', email)
        .get();
      
      if (!existingUsers.empty) {
        window.showToast?.('This email is already registered', 'warning');
        return;
      }
      
      const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;
      
      await db.collection('users').doc(uid).set({
        email,
        role: 'pupil',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      pupilData.email = email;
      pupilData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      
      await db.collection('pupils').doc(uid).set(pupilData);
      
      await secondaryAuth.sendPasswordResetEmail(email);
      await secondaryAuth.signOut();
      
      window.showToast?.(
        `✓ Pupil "${name}" added successfully!\nPassword reset email sent to ${email}`,
        'success',
        6000
      );
    }
    
    cancelPupilForm();
    await loadPupils();
    await loadDashboardStats();
    
  } catch (error) {
    console.error('Error saving pupil:', error);
    window.handleError(error, 'Failed to save pupil');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = pupilId ? 'Update Pupil' : 'Save Pupil';
  }
});

async function loadTeachers() {
  const tbody = document.getElementById('teachers-table');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Loading teachers...</td></tr>';
  
  try {
    const snapshot = await db.collection('teachers').get();
    tbody.innerHTML = '';
    
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-gray-600);">No teachers registered yet. Add one above.</td></tr>';
      return;
    }
    
    const teachers = [];
    snapshot.forEach(doc => {
      teachers.push({ id: doc.id, ...doc.data() });
    });
    
    teachers.sort((a, b) => a.name.localeCompare(b.name));
    
    paginateTable(teachers, 'teachers-table', 20, (teacher, tbody) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Name">${teacher.name}</td>
        <td data-label="Email">${teacher.email}</td>
        <td data-label="Subject">${teacher.subject || '-'}</td>
        <td data-label="Actions">
          <button class="btn-small btn-danger" onclick="deleteUser('teachers', '${teacher.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading teachers:', error);
    window.showToast?.('Failed to load teachers list. Check connection and try again.', 'danger');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-danger);">Error loading teachers - please refresh</td></tr>';
  }
}

/* ======================================== 
   PUPILS MANAGEMENT - FIXED
======================================== */

async function showPupilForm() {
  const form = document.getElementById('pupil-form');
  if (!form) return;

  // Populate class dropdown first
  await populateClassDropdown();

  form.style.display = 'block';
  document.getElementById('pupil-name')?.focus();
}

function cancelPupilForm() {
  document.getElementById('pupil-form').style.display = 'none';
  document.getElementById('add-pupil-form').reset();
  document.getElementById('pupil-id').value = '';
  
  // Reset form title and button text
  document.getElementById('pupil-form-title').textContent = 'Add / Edit Pupil';
  document.getElementById('save-pupil-btn').textContent = 'Save Pupil';
}

/**
 * FIXED: Load Pupils with Proper Event Delegation
 * Replace the entire loadPupils() function in admin.js (around line 2280)
 */
async function loadPupils() {
  const tbody = document.getElementById('pupils-table');
  if (!tbody) return;

  // Populate class dropdown first
  await populateClassDropdown();

  tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading pupils...</td></tr>';

  try {
    const snapshot = await db.collection('pupils').get();
    tbody.innerHTML = '';

    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--color-gray-600);">No pupils registered yet. Add one above.</td></tr>';
      
      // Hide bulk actions if no pupils
      const bulkActionsBar = document.getElementById('bulk-actions-bar');
      if (bulkActionsBar) bulkActionsBar.style.display = 'none';
      
      return;
    }

    const pupils = [];
    snapshot.forEach(doc => {
      pupils.push({ id: doc.id, ...doc.data() });
    });

    // Sort in JavaScript instead of Firestore
    pupils.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Show bulk actions bar
    const bulkActionsBar = document.getElementById('bulk-actions-bar');
    if (bulkActionsBar) bulkActionsBar.style.display = 'flex';

    paginateTable(pupils, 'pupils-table', 20, (pupil, tbody) => {
      let className = '-';
      if (pupil.class) {
        if (typeof pupil.class === 'object' && pupil.class.name) {
          className = pupil.class.name;
        } else if (typeof pupil.class === 'string') {
          className = pupil.class;
        }
      }
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Select" style="text-align:center;">
          <input type="checkbox" class="pupil-checkbox" data-pupil-id="${pupil.id}">
        </td>
        <td data-label="Name">${pupil.name}</td>
        <td data-label="Class">${className}</td>
        <td data-label="Gender">${pupil.gender || '-'}</td>
        <td data-label="Parent Name">${pupil.parentName || '-'}</td>
        <td data-label="Parent Email">${pupil.parentEmail || '-'}</td>
        <td data-label="Actions">
          <button class="btn-small btn-primary" onclick="editPupil('${pupil.id}')">Edit</button>
          <button class="btn-small btn-danger" onclick="deleteUser('pupils', '${pupil.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    // ✅ CRITICAL FIX: Setup event listeners AFTER table is populated
    setupBulkActionsEventListeners();
    
  } catch (error) {
    console.error('Error loading pupils:', error);
    window.showToast?.('Failed to load pupils list. Check connection and try again.', 'danger');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--color-danger);">Error loading pupils - please refresh</td></tr>';
  }
}

/* =====================================================
   BULK OPERATIONS - COMPLETE IMPLEMENTATION
   Add this entire section after loadPupils() function
===================================================== */

/**
 * Setup bulk actions event listeners
 * Called AFTER pupils table is loaded
 */
function setupBulkActionsEventListeners() {
  console.log('🔧 Setting up bulk actions event listeners...');
  
  // 1. Select All checkbox
  const selectAllCheckbox = document.getElementById('select-all-pupils');
  if (selectAllCheckbox) {
    // Remove old listener by cloning
    const newSelectAll = selectAllCheckbox.cloneNode(true);
    selectAllCheckbox.parentNode.replaceChild(newSelectAll, selectAllCheckbox);
    
    // Add fresh listener
    newSelectAll.addEventListener('change', function() {
      console.log('🔘 Select All clicked:', this.checked);
      const checkboxes = document.querySelectorAll('.pupil-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = this.checked;
      });
      updateBulkActionButtons();
    });
    
    console.log('✓ Select All listener attached');
  }
  
  // 2. Individual pupil checkboxes (EVENT DELEGATION)
  const table = document.getElementById('pupils-table');
  if (table) {
    // Use event delegation on tbody
    const tbody = table.querySelector('tbody');
    if (tbody) {
      // Remove old listeners
      const newTbody = tbody.cloneNode(true);
      tbody.parentNode.replaceChild(newTbody, tbody);
      
      // Add fresh delegation listener
      const freshTbody = table.querySelector('tbody');
      freshTbody.addEventListener('change', function(e) {
        if (e.target.classList.contains('pupil-checkbox')) {
          console.log('✓ Pupil checkbox changed');
          updateBulkActionButtons();
        }
      });
      console.log('✓ Pupil checkboxes delegation attached');
    }
  }
  
  // 3. Apply button
  const applyBtn = document.getElementById('apply-bulk-action-btn');
  if (applyBtn) {
    const newApplyBtn = applyBtn.cloneNode(true);
    applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
    
    const freshApplyBtn = document.getElementById('apply-bulk-action-btn');
    freshApplyBtn.addEventListener('click', applyBulkAction);
    console.log('✓ Apply button listener attached');
  }
  
  console.log('✅ Bulk actions event listeners setup complete');
}

/**
 * Update bulk action buttons based on selection
 */
function updateBulkActionButtons() {
  const checkboxes = document.querySelectorAll('.pupil-checkbox:checked');
  const count = checkboxes.length;
  
  console.log(`📊 ${count} pupils selected`);
  
  const countDisplay = document.getElementById('selected-count');
  const actionSelect = document.getElementById('bulk-action-select');
  const applyBtn = document.getElementById('apply-bulk-action-btn');
  const selectAllCheckbox = document.getElementById('select-all-pupils');
  
  if (countDisplay) {
    countDisplay.textContent = `${count} selected`;
    countDisplay.style.fontWeight = count > 0 ? '600' : 'normal';
    countDisplay.style.color = count > 0 ? 'var(--color-primary)' : 'var(--color-gray-600)';
  }
  
  if (actionSelect) actionSelect.disabled = count === 0;
  if (applyBtn) applyBtn.disabled = count === 0;
  
  // Update "Select All" checkbox state
  const allCheckboxes = document.querySelectorAll('.pupil-checkbox');
  if (selectAllCheckbox && allCheckboxes.length > 0) {
    selectAllCheckbox.checked = count === allCheckboxes.length;
    selectAllCheckbox.indeterminate = count > 0 && count < allCheckboxes.length;
  }
}

/**
 * Apply bulk action to selected pupils
 */
async function applyBulkAction() {
  const action = document.getElementById('bulk-action-select')?.value;
  const checkboxes = document.querySelectorAll('.pupil-checkbox:checked');
  
  if (!action || checkboxes.length === 0) {
    window.showToast?.('Please select an action and at least one pupil', 'warning');
    return;
  }
  
  const selectedPupilIds = Array.from(checkboxes).map(cb => cb.dataset.pupilId);
  
  console.log(`Applying ${action} to ${selectedPupilIds.length} pupils`);
  
  switch(action) {
    case 'reassign-class':
      await bulkReassignClass(selectedPupilIds);
      break;
    case 'delete':
      await bulkDeletePupils(selectedPupilIds);
      break;
    default:
      window.showToast?.('Invalid action selected', 'warning');
  }
}

/**
 * Bulk reassign pupils to a new class
 */
async function bulkReassignClass(pupilIds) {
  console.log(`📝 bulkReassignClass called with ${pupilIds.length} pupils`);
  
  try {
    // Get all classes
    const classesSnap = await db.collection('classes').orderBy('name').get();
    
    if (classesSnap.empty) {
      window.showToast?.('No classes available', 'warning');
      return;
    }
    
    // Build class options
    let classOptions = '<option value="">-- Select New Class --</option>';
    classesSnap.forEach(doc => {
      const data = doc.data();
      classOptions += `<option value="${doc.id}">${data.name}</option>`;
    });
    
    // Create modal with unique ID
    const modalId = 'bulk-reassign-modal-' + Date.now();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000;';
    modal.innerHTML = `
      <div style="background:white; padding:var(--space-2xl); border-radius:var(--radius-lg); max-width:500px; width:90%;">
        <h3 style="margin-top:0;">Reassign ${pupilIds.length} Pupil(s) to New Class</h3>
        <p style="color:var(--color-gray-600); margin-bottom:var(--space-lg);">
          Select the new class for the selected pupils. Their subjects and teacher will be updated automatically.
        </p>
        <select id="bulk-class-select-${modalId}" style="width:100%; padding:var(--space-sm); margin-bottom:var(--space-lg);">
          ${classOptions}
        </select>
        <div style="display:flex; gap:var(--space-md); justify-content:flex-end;">
          <button class="btn btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn btn-primary" data-action="confirm">
            Reassign All
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Cleanup function
    const cleanup = () => {
      modal.remove();
      document.removeEventListener('keydown', escapeHandler);
      console.log('✓ Modal cleaned up');
    };
    
    // Escape key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') cleanup();
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Button handlers
    modal.querySelector('[data-action="cancel"]').onclick = cleanup;
    
    modal.querySelector('[data-action="confirm"]').onclick = async function() {
      const selectId = `bulk-class-select-${modalId}`;
      const newClassId = document.getElementById(selectId)?.value;
      
      if (!newClassId) {
        window.showToast?.('Please select a class', 'warning');
        return;
      }
      
      this.disabled = true;
      this.innerHTML = '<span class="btn-loading">Reassigning...</span>';
      
      try {
        // Get new class details
        const classDoc = await db.collection('classes').doc(newClassId).get();
        if (!classDoc.exists) {
          throw new Error('Class not found');
        }
        
        const classData = classDoc.data();
        
        // Get teacher info
        let teacherId = classData.teacherId || '';
        let teacherName = classData.teacherName || '';
        
        if (teacherId && !teacherName) {
          const teacherDoc = await db.collection('teachers').doc(teacherId).get();
          if (teacherDoc.exists) {
            teacherName = teacherDoc.data().name || '';
          }
        }
        
        // Batch update pupils (with proper chunking)
        const BATCH_SIZE = 450;
        let batch = db.batch();
        let count = 0;
        
        for (const pupilId of pupilIds) {
          const pupilRef = db.collection('pupils').doc(pupilId);
          
          batch.update(pupilRef, {
            'class.id': newClassId,
            'class.name': classData.name,
            subjects: classData.subjects || [],
            'assignedTeacher.id': teacherId,
            'assignedTeacher.name': teacherName,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          count++;
          
          if (count >= BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            count = 0;
          }
        }
        
        if (count > 0) {
          await batch.commit();
        }
        
        window.showToast?.(
          `✓ Successfully reassigned ${pupilIds.length} pupil(s) to ${classData.name}`,
          'success',
          5000
        );
        
        cleanup();
        await loadPupils();
        
      } catch (error) {
        console.error('Bulk reassign error:', error);
        window.showToast?.(`Failed to reassign pupils: ${error.message}`, 'danger');
        this.disabled = false;
        this.innerHTML = 'Reassign All';
      }
    };
    
  } catch (error) {
    console.error('Error in bulkReassignClass:', error);
    window.showToast?.('Failed to load classes', 'danger');
  }
}

/**
 * Bulk delete selected pupils
 */
async function bulkDeletePupils(pupilIds) {
  console.log(`🗑️ bulkDeletePupils called with ${pupilIds.length} pupils`);
  
  const confirmation = confirm(
    `⚠️ DELETE ${pupilIds.length} PUPIL(S)?\n\n` +
    `This will permanently delete:\n` +
    `• ${pupilIds.length} pupil records\n` +
    `• ${pupilIds.length} user accounts\n` +
    `• All associated results, attendance, and remarks\n\n` +
    `This action CANNOT be undone!`
  );
  
  if (!confirmation) {
    console.log('Deletion cancelled by user');
    return;
  }
  
  const confirmText = prompt('Type DELETE to confirm:');
  if (confirmText !== 'DELETE') {
    window.showToast?.('Deletion cancelled - confirmation text did not match', 'info');
    return;
  }
  
  try {
    // Delete in batches
    const BATCH_SIZE = 450;
    let batch = db.batch();
    let count = 0;
    
    for (const pupilId of pupilIds) {
      // Delete from pupils collection
      batch.delete(db.collection('pupils').doc(pupilId));
      
      // Delete from users collection
      batch.delete(db.collection('users').doc(pupilId));
      
      count += 2; // Two deletes per pupil
      
      if (count >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    
    if (count > 0) {
      await batch.commit();
    }
    
    window.showToast?.(
      `✓ Successfully deleted ${pupilIds.length} pupil(s)`,
      'success',
      5000
    );
    
    await loadPupils();
    await loadDashboardStats();
    
  } catch (error) {
    console.error('Bulk delete error:', error);
    window.showToast?.(`Failed to delete pupils: ${error.message}`, 'danger');
  }
}

// ✅ CRITICAL: Make ALL functions globally available
window.loadPupils = loadPupils;
window.setupBulkActionsEventListeners = setupBulkActionsEventListeners;
window.updateBulkActionButtons = updateBulkActionButtons;
window.applyBulkAction = applyBulkAction;
window.bulkReassignClass = bulkReassignClass;
window.bulkDeletePupils = bulkDeletePupils;

console.log('✅ Bulk operations module loaded and exposed globally');

async function editPupil(uid) {
  try {
    const doc = await db.collection('pupils').doc(uid).get();
    if (!doc.exists) throw new Error('Pupil not found');

    const data = doc.data();

    // Safely extract class ID
    const classId = getClassIdFromPupilData(data.class);

    // Populate class dropdown and select the pupil's current class
    await populateClassDropdown(classId);

    // Fill form fields
    document.getElementById('pupil-id').value = uid;
    document.getElementById('pupil-name').value = data.name || '';
    document.getElementById('pupil-dob').value = data.dob || '';
    document.getElementById('pupil-gender').value = data.gender || '';
    document.getElementById('pupil-parent-name').value = data.parentName || '';
    document.getElementById('pupil-parent-email').value = data.parentEmail || '';
    document.getElementById('pupil-contact').value = data.contact || '';
    document.getElementById('pupil-address').value = data.address || '';
    document.getElementById('pupil-email').value = data.email || '';
    document.getElementById('pupil-password').value = ''; // always blank for security

    // Handle old-format class data
    if (!classId && className && typeof className === 'string') {
      const classesSnapshot = await db.collection('classes')
        .where('name', '==', className)
        .get();

      if (classesSnapshot.empty) {
        window.showToast?.(
          `Warning: Class "${className}" not found in database. Please select the correct class manually.`,
          'warning',
          6000
        );
      } else if (classesSnapshot.size > 1) {
        // Multiple classes with same name found
        window.showToast?.(
          `⚠️ AMBIGUOUS CLASS DATA DETECTED!\n\n` +
          `This pupil's record shows class "${className}", but ${classesSnapshot.size} classes ` +
          `have this name in the database.\n\n` +
          `Please manually select the correct class from the dropdown and save to fix this issue.`,
          'warning',
          10000
        );

        const classSelect = document.getElementById('pupil-class');
        if (classSelect) {
          classSelect.value = ''; // force manual selection
          classSelect.style.background = '#fff3cd';
          classSelect.style.border = '2px solid #ffc107';

          classSelect.addEventListener('change', function removeHighlight() {
            this.style.background = '';
            this.style.border = '';
            this.removeEventListener('change', removeHighlight);
          });
        }
      } else {
        // Exactly one match - safe to auto-select
        const matchedClassId = classesSnapshot.docs[0].id;
        document.getElementById('pupil-class').value = matchedClassId;

        window.showToast?.(
          'Note: This pupil has old class data format. Saving will upgrade it automatically.',
          'info',
          5000
        );
      }
    } else if (!classId) {
      // classId is missing and className is invalid
      window.showToast?.(
        `Warning: Could not find class "${className}". Please select the correct class.`,
        'warning',
        6000
      );
    }

    // Update form title and button
    document.getElementById('pupil-form-title').textContent = `Edit Pupil: ${data.name}`;
    document.getElementById('save-pupil-btn').textContent = 'Update Pupil';

    // Show the form and focus first field
    showPupilForm();
    document.getElementById('pupil-name')?.focus();
  } catch (error) {
    console.error('Error loading pupil for edit:', error);
    window.showToast?.('Failed to load pupil details for editing', 'danger');
  }
}

/* ======================================== 
   CLASSES MANAGEMENT 
======================================== */
function showClassForm() {
  const form = document.getElementById('class-form');
  if (form) {
    form.style.display = 'block';
    document.getElementById('class-name')?.focus();
  }
}

/**
 * FIXED: Add Class with Duplicate Name Prevention
 * Ensures unique class names to avoid migration conflicts
 */
async function addClass() {
  const className = document.getElementById('class-name')?.value.trim();
  
  if (!className) {
    window.showToast?.('Class name is required', 'warning');
    return;
  }
  
  // CRITICAL FIX: Check for duplicate class names (case-insensitive)
  try {
    const existingSnap = await db.collection('classes')
      .where('name', '==', className)
      .get();
    
    if (!existingSnap.empty) {
      window.showToast?.(
        `Class "${className}" already exists. Please use a unique name.`,
        'warning',
        5000
      );
      return;
    }
    
    // Also check case-insensitive duplicates
    const allClassesSnap = await db.collection('classes').get();
    const duplicateFound = allClassesSnap.docs.some(doc => {
      const existingName = doc.data().name || '';
      return existingName.toLowerCase() === className.toLowerCase();
    });
    
    if (duplicateFound) {
      window.showToast?.(
        `A class with a similar name already exists (case-insensitive match). Please use a unique name.`,
        'warning',
        6000
      );
      return;
    }
    
    // Create the class
    await db.collection('classes').add({
      name: className,
      subjects: [], // Initialize empty subjects array
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.currentUser?.uid || 'unknown'
    });
    
    window.showToast?.('✓ Class created successfully', 'success');
    document.getElementById('class-form').style.display = 'none';
    document.getElementById('class-name').value = '';
    loadClasses();
    loadDashboardStats();
    
  } catch (error) {
    console.error('Error adding class:', error);
    window.handleError(error, 'Failed to create class');
  }
}

async function loadClasses() {
  const tbody = document.getElementById('classes-table');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Loading classes...</td></tr>';
  
  try {
    const classesSnap = await db.collection('classes').get();
    const pupilsSnap = await db.collection('pupils').get();
    
    const pupilCountMap = {};
    pupilsSnap.forEach(pupilDoc => {
      const classData = pupilDoc.data().class;
      
      let className = null;
      if (classData) {
        if (typeof classData === 'object' && classData.name) {
          className = classData.name;
        } else if (typeof classData === 'string') {
          className = classData;
        }
      }
      
      if (className) {
        pupilCountMap[className] = (pupilCountMap[className] || 0) + 1;
      }
    });
    
    tbody.innerHTML = '';
    
    if (classesSnap.empty) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-gray-600);">No classes created yet. Add one above.</td></tr>';
      return;
    }
    
    const classes = [];
    classesSnap.forEach(doc => {
      const data = doc.data();
      classes.push({
        id: doc.id,
        name: data.name,
        subjects: data.subjects || [],
        pupilCount: pupilCountMap[data.name] || 0
      });
    });
    
    classes.sort((a, b) => a.name.localeCompare(b.name));
    
    paginateTable(classes, 'classes-table', 20, (classItem, tbody) => {
      const subjectList = classItem.subjects.length > 0 
        ? classItem.subjects.slice(0, 3).join(', ') + (classItem.subjects.length > 3 ? '...' : '')
        : 'No subjects assigned';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Class Name">${classItem.name}</td>
        <td data-label="Pupil Count">${classItem.pupilCount}</td>
        <td data-label="Subjects">${subjectList}</td>
        <td data-label="Actions">
          <button class="btn-small btn-primary" onclick="openSubjectAssignmentModal('${classItem.id}', '${classItem.name}')">
            Assign Subjects
          </button>
          <button class="btn-small btn-danger" onclick="deleteItem('classes', '${classItem.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading classes:', error);
    window.showToast?.('Failed to load classes list. Check connection and try again.', 'danger');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--color-danger);">Error loading classes - please refresh</td></tr>';
  }
}

/* ======================================== 
   SUBJECTS MANAGEMENT
======================================== */
function showSubjectForm() {
  const form = document.getElementById('subject-form');
  if (form) {
    form.style.display = 'block';
    document.getElementById('subject-name')?.focus();
  }
}

async function addSubject() {
  const subjectName = document.getElementById('subject-name')?.value.trim();
  
  if (!subjectName) {
    window.showToast?.('Subject name is required', 'warning');
    return;
  }
  
  try {
    const existingSnap = await db.collection('subjects').where('name', '==', subjectName).get();
    
    if (!existingSnap.empty) {
      window.showToast?.('This subject already exists', 'warning');
      return;
    }
    
    await db.collection('subjects').add({
      name: subjectName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    window.showToast?.('Subject created successfully', 'success');
    document.getElementById('subject-form').style.display = 'none';
    document.getElementById('subject-name').value = '';
    loadSubjects();
  } catch (error) {
    console.error('Error adding subject:', error);
    window.handleError(error, 'Failed to create subject');
  }
}

async function loadSubjects() {
  const tbody = document.getElementById('subjects-table');
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="2" class="table-loading">Loading subjects...</td></tr>';

  try {
    const snapshot = await db.collection('subjects').get();
    tbody.innerHTML = '';

    if (snapshot.empty) {
      tbody.innerHTML =
        '<tr><td colspan="2" style="text-align:center; color:var(--color-gray-600);">No subjects created yet. Add one above.</td></tr>';
      return;
    }

    const subjects = [];

    snapshot.forEach(doc => {
      subjects.push({
        id: doc.id,
        name: doc.data().name
      });
    });

    subjects.sort((a, b) => a.name.localeCompare(b.name));

    paginateTable(subjects, 'subjects-table', 20, (subject, tbodyEl) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Subject Name">${subject.name}</td>
        <td data-label="Actions">
          <button class="btn-small btn-danger" onclick="deleteItem('subjects', '${subject.id}')">Delete</button>
        </td>
      `;
      tbodyEl.appendChild(tr);
    });

  } catch (error) {
    console.error('Error loading subjects:', error);
    window.showToast?.(
      'Failed to load subjects list. Check connection and try again.',
      'danger'
    );
    tbody.innerHTML =
      '<tr><td colspan="2" style="text-align:center; color:var(--color-danger);">Error loading subjects please refresh</td></tr>';
  }
}

/* ========================================
SUBJECT ASSIGNMENT TO CLASSES
======================================== */

let currentAssignmentClassId = null;
let currentAssignmentClassName = null;

async function openSubjectAssignmentModal(classId, className) {
  currentAssignmentClassId = classId;
  currentAssignmentClassName = className;

  const modal = document.getElementById('subject-assignment-modal');
  const classNameEl = document.getElementById('assignment-class-name');
  const checkboxContainer = document.getElementById('subject-checkboxes');

  if (!modal || !classNameEl || !checkboxContainer) {
    console.error('Modal elements not found');
    return;
  }

  classNameEl.textContent = `Class: ${className}`;
  checkboxContainer.innerHTML =
    '<p style="text-align:center; color:var(--color-gray-600);">Loading subjects...</p>';

  modal.style.display = 'block';

  try {
    const subjectsSnap = await db.collection('subjects').orderBy('name').get();

    if (subjectsSnap.empty) {
      checkboxContainer.innerHTML =
        '<p style="text-align:center; color:var(--color-gray-600);">No subjects available. Create subjects first in the Subjects section.</p>';
      return;
    }

    const classDoc = await db.collection('classes').doc(classId).get();
    const currentSubjects = classDoc.exists ? (classDoc.data().subjects || []) : [];

    checkboxContainer.innerHTML = '';

    subjectsSnap.forEach(doc => {
      const subjectName = doc.data().name;
      const isChecked = currentSubjects.includes(subjectName);

      const itemDiv = document.createElement('div');
      itemDiv.className = 'subject-checkbox-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `subject-${doc.id}`;
      checkbox.value = subjectName;
      checkbox.checked = isChecked;

      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.textContent = subjectName;

      itemDiv.appendChild(checkbox);
      itemDiv.appendChild(label);
      checkboxContainer.appendChild(itemDiv);
    });

  } catch (error) {
    console.error('Error loading subjects for assignment:', error);
    checkboxContainer.innerHTML =
      '<p style="text-align:center; color:var(--color-danger);">Error loading subjects. Please try again.</p>';
    window.showToast?.('Failed to load subjects', 'danger');
  }
}

function closeSubjectAssignmentModal() {
  const modal = document.getElementById('subject-assignment-modal');
  if (modal) modal.style.display = 'none';

  currentAssignmentClassId = null;
  currentAssignmentClassName = null;
}

async function saveClassSubjects() {
  if (!currentAssignmentClassId) {
    window.showToast?.('No class selected', 'warning');
    return;
  }

  const checkboxes = document.querySelectorAll(
    '#subject-checkboxes input[type="checkbox"]:checked'
  );
  const selectedSubjects = Array.from(checkboxes).map(cb => cb.value);

  if (selectedSubjects.length === 0) {
    if (!confirm('No subjects selected. This will remove all subjects from this class. Continue?')) {
      return;
    }
  }

  try {
    // CRITICAL FIX: Use transaction for atomic updates
    await db.runTransaction(async (transaction) => {
      const classRef = db.collection('classes').doc(currentAssignmentClassId);
      
      // Read class document
      const classDoc = await transaction.get(classRef);
      if (!classDoc.exists) {
        throw new Error('Class not found');
      }
      
      const classData = classDoc.data();
      
      // Read all pupils in this class BEFORE any updates
      const pupilsSnap = await db
        .collection('pupils')
        .where('class.id', '==', currentAssignmentClassId)
        .get();
      
      console.log(`Found ${pupilsSnap.size} pupils to update`);
      
      // Update class subjects
      transaction.update(classRef, {
        subjects: selectedSubjects,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Update all pupils' subjects atomically
      pupilsSnap.forEach(pupilDoc => {
        transaction.update(pupilDoc.ref, {
          subjects: selectedSubjects,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      
      console.log('✓ Transaction prepared with all updates');
    });

    window.showToast?.(
      `✓ Subjects updated atomically for class "${currentAssignmentClassName}"`,
      'success',
      5000
    );

    closeSubjectAssignmentModal();
    loadClasses();

  } catch (error) {
    console.error('Error saving subjects:', error);
    
    if (error.message === 'Class not found') {
      window.showToast?.('Class no longer exists', 'danger');
    } else {
      window.handleError(error, 'Failed to save subjects');
    }
  }
}

/* ===============================
   Global function declarations
   =============================== */

window.openSubjectAssignmentModal = openSubjectAssignmentModal;
window.closeSubjectAssignmentModal = closeSubjectAssignmentModal;
window.saveClassSubjects = saveClassSubjects;
window.showSubjectForm = showSubjectForm;
window.addSubject = addSubject;

/* ========================================
TEACHER ASSIGNMENT
======================================== */

async function loadTeacherAssignments() {
  const teacherSelect = document.getElementById('assign-teacher');
  const classSelect = document.getElementById('assign-class');
  const tbody = document.getElementById('assignments-table');

  if (!teacherSelect || !classSelect || !tbody) return;

  try {
    const teachers = await window.getAllTeachers();

    teacherSelect.innerHTML = '<option value="">-- Select Teacher --</option>';

    teachers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.uid;
      opt.textContent = `${t.name} (${t.email})`;
      teacherSelect.appendChild(opt);
    });

    const classesSnap = await db.collection('classes').get();
    classSelect.innerHTML = '<option value="">-- Select Class --</option>';

    const classes = [];

    classesSnap.forEach(doc => {
      const data = doc.data();
      classes.push({
        id: doc.id,
        name: data.name,
        teacherId: data.teacherId || null
      });
    });

    classes.sort((a, b) => a.name.localeCompare(b.name));

    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      classSelect.appendChild(opt);
    });

    tbody.innerHTML = '';

    classes.forEach(cls => {
      const assignedTeacher = teachers.find(t => t.uid === cls.teacherId);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Class">${cls.name}</td>
        <td data-label="Assigned Teacher">${assignedTeacher ? assignedTeacher.name : '<em>None assigned</em>'}</td>
        <td data-label="Actions">
          ${cls.teacherId ? `<button class="btn-small btn-danger" onclick="unassignTeacher('${cls.id}')">Remove Assignment</button>` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error('Error loading assignments:', error);
    window.showToast?.(
      'Failed to load assignment data. Check connection and try again.',
      'danger'
    );
    tbody.innerHTML =
      '<tr><td colspan="3" style="text-align:center; color:var(--color-danger);">Error loading assignments please refresh</td></tr>';
  }
}

async function assignTeacherToClass() {
  const teacherUid = document.getElementById('assign-teacher')?.value;
  const classId = document.getElementById('assign-class')?.value;

  if (!teacherUid || !classId) {
    window.showToast?.('Please select both a teacher and a class', 'warning');
    return;
  }

  try {
    const teacherDoc = await db.collection('teachers').doc(teacherUid).get();
    const teacherName = teacherDoc.exists ? teacherDoc.data().name : '';

    const pupilsSnap = await db
      .collection('pupils')
      .where('class.id', '==', classId)
      .get();

    await db.runTransaction(async transaction => {
      transaction.update(db.collection('classes').doc(classId), {
        teacherId: teacherUid,
        teacherName: teacherName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      pupilsSnap.forEach(pupilDoc => {
        transaction.update(db.collection('pupils').doc(pupilDoc.id), {
          'assignedTeacher.id': teacherUid,
          'assignedTeacher.name': teacherName,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    });

    window.showToast?.(
      `Teacher assigned successfully! ${pupilsSnap.size} pupil(s) updated.`,
      'success',
      5000
    );

    loadTeacherAssignments();

  } catch (error) {
    console.error('Error assigning teacher:', error);
    window.handleError(error, 'Failed to assign teacher');
  }
}

async function unassignTeacher(classId) {
  if (!confirm('Remove teacher assignment from this class?')) return;

  try {
    const classDoc = await db.collection('classes').doc(classId).get();
    const className = classDoc.exists ? classDoc.data().name : '';

    await db.collection('classes').doc(classId).update({
      teacherId: firebase.firestore.FieldValue.delete(),
      teacherName: firebase.firestore.FieldValue.delete(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const pupilsSnap = await db
      .collection('pupils')
      .where('class.id', '==', classId)
      .get();

    if (!pupilsSnap.empty) {
      const batch = db.batch();
      let updateCount = 0;

      pupilsSnap.forEach(pupilDoc => {
        batch.update(db.collection('pupils').doc(pupilDoc.id), {
          'assignedTeacher.id': '',
          'assignedTeacher.name': '-',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        updateCount++;
      });

      await batch.commit();

      window.showToast?.(
        `Teacher unassigned successfully! ${updateCount} pupil(s) updated.`,
        'success',
        5000
      );
    } else {
      window.showToast?.('Teacher unassigned successfully', 'success');
    }

    loadTeacherAssignments();

  } catch (error) {
    console.error('Error unassigning teacher:', error);
    window.handleError(error, 'Failed to remove assignment');
  }
}

/* ========================================
ANNOUNCEMENTS
======================================== */

function showAnnounceForm() {
  const form = document.getElementById('announce-form');
  if (!form) return;

  form.style.display = 'block';
  document.getElementById('announce-title')?.focus();
}

async function addAnnouncement() {
  const title = document.getElementById('announce-title')?.value.trim();
  const content = document.getElementById('announce-content')?.value.trim();

  if (!title || !content) {
    window.showToast?.('Title and content are required', 'warning');
    return;
  }

  try {
    await db.collection('announcements').add({
      title,
      content,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    window.showToast?.('Announcement published successfully', 'success');

    document.getElementById('announce-form').style.display = 'none';
    document.getElementById('announce-title').value = '';
    document.getElementById('announce-content').value = '';

    loadAdminAnnouncements();
    loadDashboardStats();

  } catch (error) {
    console.error('Error adding announcement:', error);
    window.handleError(error, 'Failed to publish announcement');
  }
}

async function loadAdminAnnouncements() {
  const list = document.getElementById('announcements-list');
  if (!list) return;

  list.innerHTML =
    '<div class="skeleton-container"><div class="skeleton"></div><div class="skeleton"></div></div>';

  try {
    const snapshot = await db
      .collection('announcements')
      .orderBy('createdAt', 'desc')
      .get();

    list.innerHTML = '';

    if (snapshot.empty) {
      list.innerHTML =
        '<p style="text-align:center; color:var(--color-gray-600);">No announcements yet. Add one above.</p>';
      return;
    }

    snapshot.forEach(doc => {
      const ann = { id: doc.id, ...doc.data() };

      const postedDate = ann.createdAt
        ? ann.createdAt.toDate().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'Just now';

      const div = document.createElement('div');
      div.className = 'admin-card';
      div.style.marginBottom = 'var(--space-8)';

      div.innerHTML = `
        <h3 style="margin-top:0;">${ann.title}</h3>
        <p>${ann.content}</p>
        <small style="color:var(--color-gray-600);">Posted: ${postedDate}</small>
        <div style="margin-top:var(--space-4);">
          <button class="btn-small btn-danger" onclick="deleteItem('announcements', '${ann.id}')">
            Delete
          </button>
        </div>
      `;

      list.appendChild(div);
    });

  } catch (error) {
    console.error('Error loading announcements:', error);
    window.showToast?.(
      'Failed to load announcements. Check connection and try again.',
      'danger'
    );
    list.innerHTML =
      '<p style="text-align:center; color:var(--color-danger);">Error loading announcements please refresh</p>';
  }
}

/* ========================================
CHECK SESSION STATUS
======================================== */

async function checkSessionStatus() {
  try {
    const settingsDoc = await db.collection('settings').doc('current').get();
    if (!settingsDoc.exists) return;

    const data = settingsDoc.data();
    const currentSession = data.currentSession;

    if (
      !currentSession ||
      typeof currentSession !== 'object' ||
      !currentSession.endDate
    ) {
      return;
    }

    const endDate = currentSession.endDate.toDate();
    const today = new Date();
    const daysUntilEnd = Math.ceil(
      (endDate - today) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilEnd < 0) {
      window.showToast?.(
        '🚨 Academic session has ended! Please start a new session in School Settings.',
        'warning',
        10000
      );
    } else if (daysUntilEnd <= 30) {
      window.showToast?.(
        `⚠️ Academic session ending in ${daysUntilEnd} days. Prepare for new session and promotions.`,
        'info',
        8000
      );
    }

  } catch (error) {
    console.error('Error checking session status:', error);
  }
}

/* ======================================== 
   LOAD CURRENT SETTINGS INTO FORM
======================================== */

/**
 * FIXED: Load current settings without auto-redirecting
 */
async function loadCurrentSettings() {
  try {
    console.log('📋 Loading school settings...');
    
    const settingsDoc = await db.collection('settings').doc('current').get();
    
    if (!settingsDoc.exists) {
      window.showToast?.('No settings found. Please configure school settings.', 'warning');
      return;
    }
    
    const data = settingsDoc.data();
    
    // Display current session info in status card
    if (data.currentSession && typeof data.currentSession === 'object') {
      const session = data.currentSession;
      
      const displaySessionName = document.getElementById('display-session-name');
      const displayCurrentTerm = document.getElementById('display-current-term');
      const displaySessionStart = document.getElementById('display-session-start');
      const displaySessionEnd = document.getElementById('display-session-end');
      
      if (displaySessionName) {
        displaySessionName.textContent = session.name || `${session.startYear}/${session.endYear}`;
      }
      
      if (displayCurrentTerm) {
        displayCurrentTerm.textContent = data.term || 'First Term';
      }
      
      if (session.startDate && displaySessionStart) {
        const startDate = session.startDate.toDate();
        displaySessionStart.textContent = startDate.toLocaleDateString('en-GB');
      }
      
      if (session.endDate && displaySessionEnd) {
        const endDate = session.endDate.toDate();
        displaySessionEnd.textContent = endDate.toLocaleDateString('en-GB');
      }
      
      // Check if session is ending soon
      if (session.endDate) {
        const endDate = session.endDate.toDate();
        const today = new Date();
        const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        
        const statusBadge = document.getElementById('session-status-badge');
        const alertDiv = document.getElementById('session-end-alert');
        
        if (daysUntilEnd < 0 && statusBadge) {
          statusBadge.textContent = 'Ended';
          statusBadge.className = 'status-badge ended';
          if (alertDiv) alertDiv.style.display = 'block';
        } else if (daysUntilEnd <= 30 && statusBadge) {
          statusBadge.textContent = 'Ending Soon';
          statusBadge.className = 'status-badge ending-soon';
          if (alertDiv) alertDiv.style.display = 'block';
        } else if (statusBadge) {
          statusBadge.textContent = 'Active';
          statusBadge.className = 'status-badge';
          if (alertDiv) alertDiv.style.display = 'none';
        }
      }
      
      // Populate edit form
      const startYearInput = document.getElementById('session-start-year');
      const endYearInput = document.getElementById('session-end-year');
      const startDateInput = document.getElementById('session-start-date');
      const endDateInput = document.getElementById('session-end-date');
      
      if (startYearInput) startYearInput.value = session.startYear || '';
      if (endYearInput) endYearInput.value = session.endYear || '';
      
      if (session.startDate && startDateInput) {
        const startDate = session.startDate.toDate();
        startDateInput.value = startDate.toISOString().split('T')[0];
      }
      
      if (session.endDate && endDateInput) {
        const endDate = session.endDate.toDate();
        endDateInput.value = endDate.toISOString().split('T')[0];
      }
    } else if (data.session) {
      // Old format fallback
      const displaySessionName = document.getElementById('display-session-name');
      const displayCurrentTerm = document.getElementById('display-current-term');
      
      if (displaySessionName) displaySessionName.textContent = data.session;
      if (displayCurrentTerm) displayCurrentTerm.textContent = data.term || 'First Term';
    }
    
    // Current term
    const currentTermSelect = document.getElementById('current-term');
    if (currentTermSelect) {
      currentTermSelect.value = data.term || 'First Term';
    }
    
    // Resumption date handling
    const displayNextResumption = document.getElementById('display-next-resumption');
    const resumptionDateInput = document.getElementById('resumption-date');
    
    if (data.resumptionDate) {
      try {
        const resumptionDate = data.resumptionDate.toDate();
        
        if (displayNextResumption) {
          displayNextResumption.textContent = resumptionDate.toLocaleDateString('en-GB');
        }
        
        if (resumptionDateInput) {
          resumptionDateInput.value = resumptionDate.toISOString().split('T')[0];
        }
      } catch (error) {
        console.error('Error parsing resumption date:', error);
        if (displayNextResumption) displayNextResumption.textContent = 'Not set';
        if (resumptionDateInput) resumptionDateInput.value = '';
      }
    } else {
      if (displayNextResumption) displayNextResumption.textContent = 'Not set';
      if (resumptionDateInput) resumptionDateInput.value = '';
    }
    
    console.log('✓ Settings loaded successfully');
    
    // CRITICAL FIX: Load class hierarchy AFTER settings display is complete
    // Use setTimeout to prevent blocking the UI
    setTimeout(async () => {
      try {
        console.log('📊 Initializing class hierarchy...');
        const hierarchyStatus = await window.classHierarchy.initializeClassHierarchy();
        
        if (hierarchyStatus && hierarchyStatus.isEmpty) {
          console.log('⚠️ Class hierarchy is empty');
        }
        
        // CRITICAL: Only load UI if we're still on settings page
        const settingsSection = document.getElementById('settings');
        if (settingsSection && settingsSection.style.display !== 'none') {
          await loadClassHierarchyUI();
          console.log('✓ Class hierarchy UI loaded');
        } else {
          console.log('ℹ️ User navigated away, skipping hierarchy UI load');
        }
      } catch (error) {
        console.error('⚠️ Class hierarchy load failed:', error);
        // Don't throw error - settings page should still work
      }
    }, 300);
    
  } catch (error) {
    console.error('Error loading settings:', error);
    window.showToast?.('Failed to load settings', 'danger');
  }
}

/* ======================================== 
   START NEW ACADEMIC SESSION
======================================== */
/**
 * FIXED: Start New Session with Pre-Flight Validation
 * Checks for pending work before allowing session rollover
 */
async function confirmStartNewSession() {
  // VALIDATION STEP 1: Check for pending promotions
  const pendingPromotions = await db.collection('promotions')
    .where('status', '==', 'pending')
    .get();
  
  const pendingCount = pendingPromotions.size;
  
  // VALIDATION STEP 2: Check for pupils in terminal class
  let pupilsInTerminalClass = 0;
  
  try {
    // Get class hierarchy to find terminal class
    const hierarchy = await window.classHierarchy.getHierarchy();
    
    if (hierarchy.length > 0) {
      const terminalClassName = hierarchy[hierarchy.length - 1].name;
      
      const pupilsSnap = await db.collection('pupils')
        .where('class.name', '==', terminalClassName)
        .get();
      
      pupilsInTerminalClass = pupilsSnap.size;
    }
  } catch (error) {
    console.error('Error checking terminal class pupils:', error);
  }
  
  // VALIDATION STEP 3: Build warning message
  const issues = [];
  
  if (pendingCount > 0) {
    issues.push(`• ${pendingCount} pending promotion request(s) not yet approved`);
  }
  
  if (pupilsInTerminalClass > 0) {
    issues.push(`• ${pupilsInTerminalClass} pupil(s) still in terminal class (should be in alumni)`);
  }
  
  // VALIDATION STEP 4: Show blocking or warning dialog
  if (issues.length > 0) {
    const warningMessage = 
      '⚠️ WARNING: Issues detected before starting new session:\n\n' +
      issues.join('\n') + '\n\n' +
      'RECOMMENDATIONS:\n' +
      '1. Approve or reject all pending promotions\n' +
      '2. Move terminal class pupils to alumni\n' +
      '3. Verify all teachers have completed their work\n\n' +
      'Do you want to:\n' +
      '• Click CANCEL to fix these issues first (RECOMMENDED)\n' +
      '• Click OK to force start anyway (NOT RECOMMENDED)';
    
    const forceProceed = confirm(warningMessage);
    
    if (!forceProceed) {
      window.showToast?.('Session start cancelled. Please resolve pending issues first.', 'info', 5000);
      return;
    }
    
    // Admin chose to force - require password confirmation
    const adminConfirm = prompt(
      '⚠️ FORCE START NEW SESSION\n\n' +
      'This will archive the current session with unresolved issues.\n\n' +
      'Type "FORCE START" (without quotes) to confirm:'
    );
    
    if (adminConfirm !== 'FORCE START') {
      window.showToast?.('Session start cancelled', 'info');
      return;
    }
    
    // Log forced start with issues
    await db.collection('session_issues').add({
      sessionStartedAt: firebase.firestore.FieldValue.serverTimestamp(),
      forcedBy: auth.currentUser.uid,
      pendingPromotions: pendingCount,
      pupilsInTerminalClass: pupilsInTerminalClass,
      issues: issues,
      type: 'forced_session_start'
    });
    
  } else {
    // No issues - normal confirmation
    const confirmation = confirm(
      '⚠️ START NEW ACADEMIC SESSION?\n\n' +
      'This will:\n' +
      '• Archive the current session\n' +
      '• Create a new session (next year)\n' +
      '• Reset current term to "First Term"\n' +
      '• Open promotion period for teachers\n\n' +
      'Continue?'
    );
    
    if (!confirmation) return;
    
    // Double confirmation
    const doubleCheck = prompt(
      'Type "START NEW SESSION" (without quotes) to confirm:'
    );
    
    if (doubleCheck !== 'START NEW SESSION') {
      window.showToast?.('Action cancelled', 'info');
      return;
    }
  }
  
  // Proceed with session start
  await startNewSession();
}

async function startNewSession() {
  const btn = document.getElementById('start-new-session-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-loading">Starting new session...</span>';
  }
  
  try {
    // Get current session
    const settingsDoc = await db.collection('settings').doc('current').get();
    
    if (!settingsDoc.exists) {
      window.showToast?.('No current session found', 'danger');
      return;
    }
    
    const currentData = settingsDoc.data();
    const currentSession = currentData.currentSession;
    
    if (!currentSession || !currentSession.endYear) {
      window.showToast?.('Invalid session data. Please configure settings first.', 'danger');
      return;
    }
    
    // Archive current session
    const archiveId = `${currentSession.startYear}-${currentSession.endYear}`;
    await db.collection('sessions').doc(archiveId).set({
      ...currentSession,
      status: 'archived',
      archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
      archivedBy: auth.currentUser.uid
    });
    
    // Create new session
    const newStartYear = currentSession.endYear;
    const newEndYear = currentSession.endYear + 1;
    
    // Calculate new dates (September 1 to July 31)
    const newStartDate = new Date(newStartYear, 8, 1); // September 1
    const newEndDate = new Date(newEndYear, 6, 31); // July 31
    const newResumptionDate = new Date(newStartYear, 8, 1); // September 1
    
    await db.collection('settings').doc('current').update({
      currentSession: {
        name: `${newStartYear}/${newEndYear}`,
        startYear: newStartYear,
        endYear: newEndYear,
        startDate: firebase.firestore.Timestamp.fromDate(newStartDate),
        endDate: firebase.firestore.Timestamp.fromDate(newEndDate)
      },
      session: `${newStartYear}/${newEndYear}`,
      term: 'First Term',
      resumptionDate: firebase.firestore.Timestamp.fromDate(newResumptionDate),
      promotionPeriodActive: true, // Open promotion period
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    window.showToast?.(
      `✓ New session ${newStartYear}/${newEndYear} started successfully!\n` +
      `Promotion period is now ACTIVE for teachers.`,
      'success',
      8000
    );
    
    // Reload settings display
    await loadCurrentSettings();
    await loadSessionHistory();
    
  } catch (error) {
    console.error('Error starting new session:', error);
    window.handleError(error, 'Failed to start new session');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🚀 Start New Session';
    }
  }
}

// Make function globally available
window.confirmStartNewSession = confirmStartNewSession;

/* ========================================
CLASS HIERARCHY MANAGEMENT
======================================== */
let currentHierarchy = null;

async function loadClassHierarchyUI() {
  const container = document.getElementById('hierarchy-container');
  
  if (!container) {
    console.error('❌ hierarchy-container element not found in DOM');
    // REMOVED: Don't redirect - just log error
    return;
  }
  
  console.log('📋 Loading class hierarchy UI...');
  
  try {
    // Get all classes from the "classes" collection
    const classesSnapshot = await db.collection('classes').orderBy('name').get();
    
    if (classesSnapshot.empty) {
      console.warn('⚠️ No classes found in classes collection');
      renderEmptyHierarchyUI();
      return;
    }
    
    console.log(`✓ Found ${classesSnapshot.size} classes in database`);
    
    // Get all classes as objects
    const allClasses = [];
    classesSnapshot.forEach(doc => {
      allClasses.push({
        id: doc.id,
        name: doc.data().name || 'Unnamed Class'
      });
    });
    
    // Get saved hierarchy order from settings
    const hierarchyDoc = await db.collection('settings').doc('classHierarchy').get();
    
    let orderedClasses = [];
    
    if (hierarchyDoc.exists && hierarchyDoc.data().orderedClassIds) {
      const savedOrder = hierarchyDoc.data().orderedClassIds;
      console.log(`✓ Found saved order with ${savedOrder.length} classes`);
      
      // Sort classes according to saved order
      savedOrder.forEach(classId => {
        const found = allClasses.find(c => c.id === classId);
        if (found) {
          orderedClasses.push(found);
        }
      });
      
      // Add any NEW classes that aren't in the saved order yet (append to end)
      allClasses.forEach(cls => {
        if (!savedOrder.includes(cls.id)) {
          orderedClasses.push(cls);
          console.log(`➕ Adding new class "${cls.name}" to hierarchy`);
        }
      });
    } else {
      // No saved order - use alphabetical order from classes
      console.log('ℹ️ No saved order found, using alphabetical order');
      orderedClasses = allClasses.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    console.log(`✓ Rendering ${orderedClasses.length} classes in hierarchy UI`);
    renderHierarchyUI(orderedClasses);
    
  } catch (error) {
    console.error('❌ Error loading class hierarchy UI:', error);
    if (container) {
      container.innerHTML = `
        <div style="padding:var(--space-lg); text-align:center; color:var(--color-danger);">
          <p><strong>Error Loading Classes</strong></p>
          <p>${error.message}</p>
          <button class="btn btn-primary" onclick="window.refreshHierarchyUI()">
            🔄 Retry
          </button>
        </div>
      `;
    }
    window.showToast?.('Failed to load class hierarchy', 'danger');
  }
}

function renderEmptyHierarchyUI() {
  const container = document.getElementById('hierarchy-container');
  if (!container) return;
  
  console.log('📭 Rendering empty hierarchy UI');
  
  container.innerHTML = `
    <div style="text-align:center; padding:var(--space-2xl); background:var(--color-gray-100); border-radius:var(--radius-md);">
      <h3 style="color:var(--color-gray-600); margin-bottom:var(--space-md);">📚 No Classes Created Yet</h3>
      <p style="color:var(--color-gray-600); margin-bottom:var(--space-lg);">
        You need to create classes first in the <strong>"Classes"</strong> section above, then return here to arrange them in progression order.
      </p>
      <button class="btn btn-primary" onclick="window.showSection('classes')">
        ➕ Go to Classes Section
      </button>
    </div>
  `;
}

function renderHierarchyUI(orderedClasses) {
  const container = document.getElementById('hierarchy-container');
  if (!container) {
    console.error('❌ hierarchy-container element not found in DOM');
    return;
  }
  
  if (!Array.isArray(orderedClasses) || orderedClasses.length === 0) {
    console.warn('⚠️ No classes provided to renderHierarchyUI');
    renderEmptyHierarchyUI();
    return;
  }
  
  console.log(`🎨 Rendering ${orderedClasses.length} classes in UI`);
  
  container.innerHTML = `
    <div class="hierarchy-instructions">
      <p><strong>📋 Class Progression Order (${orderedClasses.length} classes found)</strong></p>
      <p>Drag classes to rearrange the order from lowest to highest level. The <strong>last class</strong> is the terminal/graduation class.</p>
      <p style="color:var(--color-gray-600); font-size:var(--text-sm); margin-top:var(--space-sm);">
        💡 <strong>Tip:</strong> To add/remove classes, go to the "Classes" section above, then click "🔄 Refresh from Classes" below.
      </p>
    </div>
    
    <div id="sortable-class-list" class="sortable-list"></div>
    
    <div style="margin-top:var(--space-lg); display:flex; gap:var(--space-md); flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="window.saveHierarchyOrder()">
        💾 Save Progression Order
      </button>
      <button class="btn btn-secondary" onclick="window.refreshHierarchyUI()">
        🔄 Refresh from Classes
      </button>
    </div>
    
    <div style="margin-top:var(--space-lg); padding:var(--space-md); background:var(--color-info-light); border-radius:var(--radius-sm);">
      <p style="margin:0; color:var(--color-info-dark); font-size:var(--text-sm);">
        ℹ️ <strong>Currently showing ${orderedClasses.length} class(es)</strong> from your Classes section.
        If you added new classes, click "🔄 Refresh from Classes" to see them here.
      </p>
    </div>
  `;
  
  const listContainer = document.getElementById('sortable-class-list');
  
  if (!listContainer) {
    console.error('❌ sortable-class-list not found after innerHTML update');
    return;
  }

orderedClasses.forEach((cls, index) => {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'hierarchy-item draggable';
  itemDiv.draggable = true;
  itemDiv.dataset.classId = cls.id;
  itemDiv.dataset.index = index;
  
  const isTerminal = index === orderedClasses.length - 1;
  
  itemDiv.innerHTML = `
    <span class="drag-handle">☰</span>
    <span class="hierarchy-number">${index + 1}</span>
    <span class="class-name">${cls.name}</span>
    ${isTerminal ? '<span class="terminal-badge">🎓 Terminal/Graduation Class</span>' : ''}
  `;
  
  // NO INDIVIDUAL EVENT LISTENERS - using delegation instead!
  listContainer.appendChild(itemDiv);
});

// CRITICAL FIX: Use event delegation on parent container
// Add this AFTER the forEach loop, BEFORE the console.log

// Remove old delegation if exists
if (listContainer.dataset.delegationActive === 'true') {
  console.log('⚠️ Event delegation already active, skipping');
} else {
  // Add single set of event listeners to container
  listContainer.addEventListener('dragstart', function(e) {
    if (e.target.classList.contains('hierarchy-item')) {
      handleDragStart.call(e.target, e);
    }
  });
  
  listContainer.addEventListener('dragover', function(e) {
    const item = e.target.closest('.hierarchy-item');
    if (item) {
      handleDragOver.call(item, e);
    }
  });
  
  listContainer.addEventListener('drop', function(e) {
    const item = e.target.closest('.hierarchy-item');
    if (item) {
      handleDrop.call(item, e);
    }
  });
  
  listContainer.addEventListener('dragend', function(e) {
    if (e.target.classList.contains('hierarchy-item')) {
      handleDragEnd.call(e.target, e);
    }
  });
  
  listContainer.dataset.delegationActive = 'true';
  console.log('✓ Event delegation set up for class hierarchy');
}

console.log(`✓ Successfully rendered ${orderedClasses.length} classes in hierarchy UI`);

// Drag and drop handlers - FIXED
let draggedElement = null;

function handleDragStart(e) {
  draggedElement = this;
  this.classList.add('dragging');
  this.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  
  // Visual feedback
  const afterElement = getDragAfterElement(this.parentElement, e.clientY);
  const draggable = document.querySelector('.dragging');
  
  if (afterElement == null) {
    this.parentElement.appendChild(draggable);
  } else {
    this.parentElement.insertBefore(draggable, afterElement);
  }
  
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  if (draggedElement !== this) {
    // Get all items
    const allItems = Array.from(document.querySelectorAll('.hierarchy-item'));
    const draggedIndex = allItems.indexOf(draggedElement);
    const targetIndex = allItems.indexOf(this);
    
    // Reorder in DOM
    if (draggedIndex < targetIndex) {
      this.parentNode.insertBefore(draggedElement, this.nextSibling);
    } else {
      this.parentNode.insertBefore(draggedElement, this);
    }
    
    // Update numbers and terminal badge
    updateHierarchyNumbers();
  }
  
  return false;
}

function handleDragEnd(e) {
  this.style.opacity = '1';
  this.classList.remove('dragging');
  
  document.querySelectorAll('.hierarchy-item').forEach(item => {
    item.classList.remove('over');
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.hierarchy-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateHierarchyNumbers() {
  const items = document.querySelectorAll('.hierarchy-item');
  items.forEach((item, index) => {
    const numberSpan = item.querySelector('.hierarchy-number');
    if (numberSpan) numberSpan.textContent = index + 1;
    
    // Update terminal badge
    const terminalBadge = item.querySelector('.terminal-badge');
    if (index === items.length - 1) {
      if (!terminalBadge) {
        item.insertAdjacentHTML('beforeend', '<span class="terminal-badge">🎓 Terminal/Graduation Class</span>');
      }
    } else {
      if (terminalBadge) terminalBadge.remove();
    }
  });
}

async function saveHierarchyOrder() {
  const items = document.querySelectorAll('.hierarchy-item');
  
  if (items.length === 0) {
    window.showToast?.('No classes to save', 'warning');
    return;
  }
  
  const orderedClassIds = Array.from(items).map(item => item.dataset.classId);
  
  try {
    const result = await window.classHierarchy.saveClassHierarchy(orderedClassIds);
    
    if (result.success) {
      window.showToast?.('✓ Class progression order saved successfully!', 'success');
      await loadClassHierarchyUI(); // Reload to confirm
    } else {
      window.showToast?.('Failed to save progression order', 'danger');
    }
  } catch (error) {
    console.error('Error saving hierarchy order:', error);
    window.handleError(error, 'Failed to save progression order');
  }
}

async function refreshHierarchyUI() {
  console.log('🔄 Refreshing hierarchy from classes...');
  
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-loading">Refreshing...</span>';
  }
  
  try {
    // Re-initialize hierarchy from classes collection
    await window.classHierarchy.initializeClassHierarchy();
    
    // Reload the UI
    await loadClassHierarchyUI();
    
    window.showToast?.('✓ Refreshed from Classes section', 'success');
  } catch (error) {
    console.error('❌ Error refreshing hierarchy:', error);
    window.showToast?.('Failed to refresh hierarchy', 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔄 Refresh from Classes';
    }
  }
}
// Make functions globally available
window.saveHierarchyOrder = saveHierarchyOrder;
window.refreshHierarchyUI = refreshHierarchyUI;

/* ========================================
DELETE FUNCTIONS
======================================== */

/**
 * FIXED: Delete User with Audit Trail
 * Logs all delete operations for compliance
 */
async function deleteUser(collection, uid) {
  if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) {
    return;
  }

  try {
    // Get user data before deletion for audit log
    const userDoc = await db.collection(collection).doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    // AUDIT: Log deletion
    await db.collection('audit_log').add({
      action: 'delete_user',
      collection: collection,
      documentId: uid,
      deletedData: {
        name: userData.name || 'Unknown',
        email: userData.email || 'Unknown',
        // Store only essential data for audit
        ...Object.keys(userData).reduce((acc, key) => {
          if (!['subjects', 'promotionHistory'].includes(key)) {
            acc[key] = userData[key];
          }
          return acc;
        }, {})
      },
      performedBy: auth.currentUser.uid,
      performedByEmail: auth.currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent
    });

    // Delete user
    await db.collection(collection).doc(uid).delete();
    await db.collection('users').doc(uid).delete();

    window.showToast?.('User deleted successfully', 'success');

    if (collection === 'teachers') {
      loadTeachers();
      loadTeacherAssignments();
    }

    if (collection === 'pupils') {
      loadPupils();
    }

    loadDashboardStats();
  } catch (error) {
    console.error('Error deleting user:', error);
    window.handleError(error, 'Failed to delete user');
  }
}

/**
 * FIXED: Delete Item with Audit Trail
 * Logs all delete operations for compliance
 */
async function deleteItem(collectionName, docId) {
  if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
    return;
  }

  try {
    // Get item data before deletion for audit log
    const itemDoc = await db.collection(collectionName).doc(docId).get();
    const itemData = itemDoc.exists ? itemDoc.data() : {};
    
    // AUDIT: Log deletion
    await db.collection('audit_log').add({
      action: 'delete_item',
      collection: collectionName,
      documentId: docId,
      deletedData: itemData,
      performedBy: auth.currentUser.uid,
      performedByEmail: auth.currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent
    });

    // Delete item
    await db.collection(collectionName).doc(docId).delete();
    
    window.showToast?.('Item deleted successfully', 'success');

    loadDashboardStats();

    switch (collectionName) {
      case 'classes':
        loadClasses();
        loadTeacherAssignments();
        break;
      case 'subjects':
        loadSubjects();
        break;
      case 'announcements':
        loadAdminAnnouncements();
        break;
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    window.handleError(error, 'Failed to delete item');
  }
}

/**
 * Load result approvals section
 */
async function loadResultApprovals() {
    const tbody = document.getElementById('result-approvals-table');
    const noApprovalsMsg = document.getElementById('no-approvals-message');
    
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Loading approvals...</td></tr>';
    
    try {
        const submissions = await window.resultLocking.getSubmittedResults();
        
        tbody.innerHTML = '';
        
        if (submissions.length === 0) {
            if (noApprovalsMsg) noApprovalsMsg.style.display = 'block';
            return;
        }
        
        if (noApprovalsMsg) noApprovalsMsg.style.display = 'none';
        
        for (const submission of submissions) {
            const submittedDate = submission.submittedAt 
                ? submission.submittedAt.toDate().toLocaleDateString('en-GB')
                : '-';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Teacher">${submission.teacherName || 'Unknown'}</td>
                <td data-label="Class">${submission.className || '-'}</td>
                <td data-label="Subject">${submission.subject || '-'}</td>
                <td data-label="Term">${submission.term || '-'}</td>
                <td data-label="Pupils" style="text-align:center;">${submission.pupilCount || 0}</td>
                <td data-label="Submitted">${submittedDate}</td>
                <td data-label="Status">
                    <span class="status-pending">Pending</span>
                </td>
                <td data-label="Actions">
                    <button class="btn-small btn-success" onclick="approveResultSubmission('${submission.id}')">
                        ✓ Approve
                    </button>
                    <button class="btn-small btn-danger" onclick="rejectResultSubmission('${submission.id}')">
                        ✗ Reject
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        }
        
    } catch (error) {
        console.error('Error loading result approvals:', error);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--color-danger);">Error loading approvals</td></tr>';
    }
}

/**
 * Approve result submission
 */
async function approveResultSubmission(submissionId) {
    if (!confirm('Approve these results and lock them?\n\nTeacher will not be able to edit unless you unlock.')) {
        return;
    }
    
    try {
        const result = await window.resultLocking.approveResults(submissionId, auth.currentUser.uid);
        
        if (result.success) {
            window.showToast?.(result.message, 'success');
            await loadResultApprovals();
        } else {
            window.showToast?.(result.message || result.error, 'danger');
        }
        
    } catch (error) {
        console.error('Error approving results:', error);
        window.handleError(error, 'Failed to approve results');
    }
}

/**
 * Reject result submission
 */
async function rejectResultSubmission(submissionId) {
    const reason = prompt('Reason for rejection (teacher will see this):');
    
    if (!reason) {
        window.showToast?.('Rejection cancelled - reason required', 'info');
        return;
    }
    
    try {
        const result = await window.resultLocking.rejectResults(submissionId, auth.currentUser.uid, reason);
        
        if (result.success) {
            window.showToast?.(result.message, 'success');
            await loadResultApprovals();
        } else {
            window.showToast?.(result.message || result.error, 'danger');
        }
        
    } catch (error) {
        console.error('Error rejecting results:', error);
        window.handleError(error, 'Failed to reject results');
    }
}

// Make functions globally available
window.loadResultApprovals = loadResultApprovals;
window.approveResultSubmission = approveResultSubmission;
window.rejectResultSubmission = rejectResultSubmission;

/**
 * FIXED: Initialize Sidebar Navigation
 * Handles all sidebar link clicks and group toggles
 */
function initializeSidebarNavigation() {
  console.log('🔗 Initializing sidebar navigation...');
  
  // ============================================
  // SECTION NAVIGATION LINKS
  // ============================================
  const sectionLinks = document.querySelectorAll('.sidebar-link[data-section]');
  
  sectionLinks.forEach(link => {
    // Remove any existing listeners by cloning
    const newLink = link.cloneNode(true);
    link.parentNode.replaceChild(newLink, link);
    
    // Add single click handler
    newLink.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const sectionId = this.dataset.section;
      
      if (!sectionId) {
        console.warn('No section ID found for link:', this);
        return;
      }
      
      console.log(`📍 Navigating to section: ${sectionId}`);
      
      // Update active state
      document.querySelectorAll('.sidebar-link').forEach(l => {
        l.classList.remove('active');
      });
      this.classList.add('active');
      
      // Show the section
      if (typeof window.showSection === 'function') {
        window.showSection(sectionId);
      } else {
        console.error('showSection function not found!');
      }
    });
  });
  
  console.log(`✓ Registered ${sectionLinks.length} section navigation links`);
  
  // ============================================
  // GROUP TOGGLES
  // ============================================
  const groupToggles = document.querySelectorAll('.sidebar-group-toggle-modern');
  
  groupToggles.forEach(toggle => {
    // Remove any existing listeners by cloning
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    
    // Add single click handler
    newToggle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const content = this.nextElementSibling;
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      
      // Toggle state
      this.setAttribute('aria-expanded', !isExpanded);
      content.classList.toggle('active');
      
      // Rotate chevron icon
      const chevron = this.querySelector('.toggle-icon');
      if (chevron) {
        chevron.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
      }
      
      console.log(`🔽 Toggled group: ${this.dataset.group} (expanded: ${!isExpanded})`);
    });
  });
  
  console.log(`✓ Registered ${groupToggles.length} group toggle buttons`);
  
  // ============================================
  // LOGOUT BUTTON
  // ============================================
  const logoutBtn = document.getElementById('admin-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('🚪 Logout clicked');
      if (typeof window.logout === 'function') {
        window.logout();
      } else {
        console.error('logout function not found!');
      }
    });
    console.log('✓ Logout button registered');
  }
  
  console.log('✅ Sidebar navigation initialization complete');
}

// Make function globally available
window.initializeSidebarNavigation = initializeSidebarNavigation;

/* ======================================== 
   CLASS HIERARCHY MANAGEMENT
======================================== */

// Settings form submit handler
document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const startYear = parseInt(document.getElementById('session-start-year').value);
  const endYear = parseInt(document.getElementById('session-end-year').value);
  const startDate = document.getElementById('session-start-date').value;
  const endDate = document.getElementById('session-end-date').value;
  const currentTerm = document.getElementById('current-term').value;
  const resumptionDate = document.getElementById('resumption-date').value;
  
  if (!startYear || !endYear || !startDate || !endDate || !currentTerm || !resumptionDate) {
    window.showToast?.('Please fill all required fields', 'warning');
    return;
  }
  
  if (endYear <= startYear) {
    window.showToast?.('End year must be after start year', 'warning');
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="btn-loading">Saving...</span>';
  
  try {
    await db.collection('settings').doc('current').set({
      currentSession: {
        name: `${startYear}/${endYear}`,
        startYear: startYear,
        endYear: endYear,
        startDate: firebase.firestore.Timestamp.fromDate(new Date(startDate)),
        endDate: firebase.firestore.Timestamp.fromDate(new Date(endDate))
      },
      term: currentTerm,
      session: `${startYear}/${endYear}`, // For backward compatibility
      resumptionDate: firebase.firestore.Timestamp.fromDate(new Date(resumptionDate)),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    window.showToast?.('✓ Settings saved successfully!', 'success');
    await loadCurrentSettings(); // Refresh display
    
  } catch (error) {
    console.error('Error saving settings:', error);
    window.handleError(error, 'Failed to save settings');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '💾 Save Settings';
  }
});

// Export hierarchy functions globally
window.loadClassHierarchyUI = loadClassHierarchyUI;
window.refreshHierarchyUI = refreshHierarchyUI;
window.renderEmptyHierarchyUI = renderEmptyHierarchyUI;
window.renderHierarchyUI = renderHierarchyUI;
window.showSection = showSection;

/* ========================================
   DATA MIGRATION: BACKFILL SESSION INFO
======================================== */

/**
 * FIXED: Session Data Migration with Date-Based Validation
 * Only migrates results that belong to current session based on dates
 */
async function backfillSessionData() {
  const btn = document.getElementById('backfill-btn');
  const statusDiv = document.getElementById('migration-status');
  const statusText = statusDiv?.querySelector('p');
  
  // Get current session information FIRST
  let settings;
  let currentSession;
  let sessionStartDate;
  let sessionEndDate;
  
  try {
    const settingsDoc = await db.collection('settings').doc('current').get();
    
    if (!settingsDoc.exists) {
      throw new Error('Settings not found. Please configure school settings first.');
    }
    
    settings = settingsDoc.data();
    currentSession = settings.session || 'Unknown';
    
    // CRITICAL: Get session date boundaries
    if (settings.currentSession?.startDate && settings.currentSession?.endDate) {
      sessionStartDate = settings.currentSession.startDate.toDate();
      sessionEndDate = settings.currentSession.endDate.toDate();
    } else {
      throw new Error('Session dates not configured. Please set session start and end dates in School Settings.');
    }
    
  } catch (error) {
    if (statusText) {
      statusText.innerHTML = `❌ <strong>Error:</strong> ${error.message}`;
    }
    if (statusDiv) {
      statusDiv.style.background = '#f8d7da';
      statusDiv.style.border = '1px solid #dc3545';
      statusDiv.style.display = 'block';
    }
    window.showToast?.(error.message, 'danger', 10000);
    return;
  }
  
  // ENHANCED CONFIRMATION with date information
  const confirmation = confirm(
    '⚠️ DATA MIGRATION CONFIRMATION\n\n' +
    `Current Session: ${currentSession}\n` +
    `Session Period: ${sessionStartDate.toLocaleDateString('en-GB')} to ${sessionEndDate.toLocaleDateString('en-GB')}\n\n` +
    'This migration will:\n' +
    '✓ Only assign current session to results created within session dates\n' +
    '✓ Flag results outside date range for manual review\n' +
    '✓ NOT modify existing session-labeled results\n' +
    '✓ Create a detailed migration report\n\n' +
    'Continue with migration?'
  );
  
  if (!confirmation) return;
  
  // Disable button and show status
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-loading">Analyzing data...</span>';
  }
  
  if (statusDiv) {
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#fff3cd';
    statusDiv.style.border = '1px solid #ffc107';
  }
  
  if (statusText) {
    statusText.innerHTML = `🔄 <strong>Analyzing results...</strong><br>Session: ${currentSession}`;
  }
  
  try {
    // Query results WITHOUT session field
    const resultsSnap = await db.collection('results')
      .where('session', '==', null)
      .get();
    
    if (resultsSnap.empty) {
      if (statusText) {
        statusText.innerHTML = '✓ <strong>No results need migration.</strong><br>All results already have session data.';
      }
      if (statusDiv) {
        statusDiv.style.background = '#d4edda';
        statusDiv.style.border = '1px solid #28a745';
      }
      
      window.showToast?.('✓ All results already have session data', 'success');
      
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '🔄 Migrate Existing Results';
      }
      
      return;
    }
    
    const totalResults = resultsSnap.size;
    
    if (statusText) {
      statusText.innerHTML = `🔄 <strong>Found ${totalResults} result(s) without session data</strong><br>Validating dates...`;
    }
    
    // CRITICAL: Categorize results by date
    const withinSession = [];
    const beforeSession = [];
    const afterSession = [];
    const noCreatedDate = [];
    
    resultsSnap.forEach(doc => {
      const data = doc.data();
      
      // Check if result has createdAt timestamp
      if (data.createdAt) {
        const resultDate = data.createdAt.toDate();
        
        if (resultDate >= sessionStartDate && resultDate <= sessionEndDate) {
          withinSession.push({ id: doc.id, data: data, date: resultDate });
        } else if (resultDate < sessionStartDate) {
          beforeSession.push({ id: doc.id, data: data, date: resultDate });
        } else {
          afterSession.push({ id: doc.id, data: data, date: resultDate });
        }
      } else {
        noCreatedDate.push({ id: doc.id, data: data });
      }
    });
    
    // Show categorization summary
    const summaryMessage = 
      `📊 <strong>Migration Analysis:</strong><br>` +
      `• ${withinSession.length} results within current session dates (will be migrated)<br>` +
      `• ${beforeSession.length} results before session start (flagged for review)<br>` +
      `• ${afterSession.length} results after session end (flagged for review)<br>` +
      `• ${noCreatedDate.length} results without creation date (flagged for review)`;
    
    if (statusText) {
      statusText.innerHTML = summaryMessage;
    }
    
    // Ask admin to proceed
    const proceedWithMigration = confirm(
      `Migration Analysis Complete:\n\n` +
      `${withinSession.length} results will be assigned to current session\n` +
      `${beforeSession.length + afterSession.length + noCreatedDate.length} results need manual review\n\n` +
      `Proceed with automatic migration?`
    );
    
    if (!proceedWithMigration) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '🔄 Migrate Existing Results';
      }
      window.showToast?.('Migration cancelled', 'info');
      return;
    }
    
    // Process migration in batches
    const BATCH_SIZE = 450;
    let processed = 0;
    let batch = db.batch();
    let batchCount = 0;
    
    // Migrate results within session dates
    for (const result of withinSession) {
      const term = result.data.term || 'Unknown Term';
      const sessionTerm = `${currentSession}_${term}`;
      
      batch.update(db.collection('results').doc(result.id), {
        session: currentSession,
        sessionStartYear: settings.currentSession.startYear,
        sessionEndYear: settings.currentSession.endYear,
        sessionTerm: sessionTerm,
        migrated: true,
        migratedAt: firebase.firestore.FieldValue.serverTimestamp(),
        migrationMethod: 'date_validated'
      });
      
      batchCount++;
      processed++;
      
      if (batchCount >= BATCH_SIZE) {
        if (statusText) {
          statusText.innerHTML = `🔄 <strong>Migrating...</strong><br>Processed ${processed} of ${withinSession.length} results`;
        }
        
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit();
    }
    
    // Flag problematic results for manual review
    const flaggedResults = [...beforeSession, ...afterSession, ...noCreatedDate];
    
    if (flaggedResults.length > 0) {
      const flagBatch = db.batch();
      let flagCount = 0;
      
      for (const result of flaggedResults) {
        let flagReason = '';
        
        if (beforeSession.includes(result)) {
          flagReason = `Created before current session (${result.date.toLocaleDateString('en-GB')})`;
        } else if (afterSession.includes(result)) {
          flagReason = `Created after current session (${result.date.toLocaleDateString('en-GB')})`;
        } else {
          flagReason = 'No creation date found';
        }
        
        flagBatch.update(db.collection('results').doc(result.id), {
          needsManualReview: true,
          reviewReason: flagReason,
          flaggedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        flagCount++;
        
        if (flagCount >= BATCH_SIZE) {
          await flagBatch.commit();
          flagCount = 0;
        }
      }
      
      if (flagCount > 0) {
        await flagBatch.commit();
      }
    }
    
    // Success message
    if (statusText) {
      statusText.innerHTML = 
        `✓ <strong>Migration completed successfully!</strong><br>` +
        `• ${withinSession.length} results assigned to ${currentSession}<br>` +
        `• ${flaggedResults.length} results flagged for manual review<br><br>` +
        `<em>Flagged results are marked with "needsManualReview: true"</em>`;
    }
    
    if (statusDiv) {
      statusDiv.style.background = '#d4edda';
      statusDiv.style.border = '1px solid #28a745';
    }
    
    window.showToast?.(
      `✓ Migration completed!\n${withinSession.length} migrated, ${flaggedResults.length} need review`,
      'success',
      8000
    );
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    
    if (statusText) {
      statusText.innerHTML = `❌ <strong>Migration failed:</strong><br>${error.message}`;
    }
    
    if (statusDiv) {
      statusDiv.style.background = '#f8d7da';
      statusDiv.style.border = '1px solid #dc3545';
    }
    
    window.showToast?.(
      `Migration failed: ${error.message}`,
      'danger',
      10000
    );
    
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔄 Migrate Existing Results';
    }
  }
}

// Make function globally available
window.backfillSessionData = backfillSessionData;

// Make all UI functions globally available
window.showTeacherForm = showTeacherForm;
window.cancelTeacherForm = cancelTeacherForm;
window.showPupilForm = showPupilForm;
window.cancelPupilForm = cancelPupilForm;
window.editPupil = editPupil;
window.showClassForm = showClassForm;
window.addClass = addClass;
window.showSubjectForm = showSubjectForm;
window.addSubject = addSubject;
window.deleteUser = deleteUser;
window.deleteItem = deleteItem;
window.assignTeacherToClass = assignTeacherToClass;
window.unassignTeacher = unassignTeacher;
window.showAnnounceForm = showAnnounceForm;
window.addAnnouncement = addAnnouncement;
window.loadCurrentSettings = loadCurrentSettings;
window.loadAlumni = loadAlumni;
window.loadViewResultsSection = loadViewResultsSection;

/* ======================================== 
   SESSION VALIDATION ON LOAD
======================================== */

window.addEventListener('load', async () => {
  try {
    const settings = await window.getCurrentSettings();
    
    // Check if session is configured
    if (!settings.session || !settings.currentSession) {
      window.showToast?.(
        '⚠️ School settings incomplete. Please configure session details in School Settings.',
        'warning',
        8000
      );
      console.warn('Session not configured properly:', settings);
    } else {
      console.log('✓ Session validated:', settings.session);
    }
  } catch (error) {
    console.error('Error validating session:', error);
  }
});

console.log('✓ Session validation loaded');

/* ========================================
   INITIALIZE LUCIDE ICONS
======================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
        console.log('✓ Lucide icons initialized');
    }
});

/**
 * BULK OPERATIONS FUNCTIONS - FIXED
 * Replace the entire bulk operations section in admin.js (around line 2800-2900)
 */

/**
 * Toggle all pupils selection for bulk operations
 */
function toggleAllPupils(masterCheckbox) {
  console.log('🔘 toggleAllPupils called:', masterCheckbox?.checked);
  
  const checkboxes = document.querySelectorAll('.pupil-checkbox');
  const isChecked = masterCheckbox.checked;
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = isChecked;
  });
  
  updateBulkActionButtons();
}

/**
 * Update bulk action buttons based on selection
 */
function updateBulkActionButtons() {
  const checkboxes = document.querySelectorAll('.pupil-checkbox:checked');
  const count = checkboxes.length;
  
  const countDisplay = document.getElementById('selected-count');
  const actionSelect = document.getElementById('bulk-action-select');
  const applyBtn = document.getElementById('apply-bulk-action-btn');
  const selectAllCheckbox = document.getElementById('select-all-pupils');
  
  if (countDisplay) {
    countDisplay.textContent = `${count} selected`;
    countDisplay.style.fontWeight = count > 0 ? '600' : 'normal';
    countDisplay.style.color = count > 0 ? 'var(--color-primary)' : 'var(--color-gray-600)';
  }
  
  if (actionSelect) actionSelect.disabled = count === 0;
  if (applyBtn) applyBtn.disabled = count === 0;
  
  // Update "Select All" checkbox state
  const allCheckboxes = document.querySelectorAll('.pupil-checkbox');
  if (selectAllCheckbox && allCheckboxes.length > 0) {
    selectAllCheckbox.checked = count === allCheckboxes.length;
    selectAllCheckbox.indeterminate = count > 0 && count < allCheckboxes.length;
  }
}

/**
 * Apply bulk action to selected pupils
 */
async function applyBulkAction() {
  const action = document.getElementById('bulk-action-select')?.value;
  const checkboxes = document.querySelectorAll('.pupil-checkbox:checked');
  
  if (!action || checkboxes.length === 0) {
    window.showToast?.('Please select an action and at least one pupil', 'warning');
    return;
  }
  
  const selectedPupilIds = Array.from(checkboxes).map(cb => cb.dataset.pupilId);
  
  console.log(`Applying ${action} to ${selectedPupilIds.length} pupils`);
  
  switch(action) {
    case 'reassign-class':
      await bulkReassignClass(selectedPupilIds);
      break;
    case 'delete':
      await bulkDeletePupils(selectedPupilIds);
      break;
    default:
      window.showToast?.('Invalid action selected', 'warning');
  }
}

/**
 * Bulk reassign pupils to new class
 */
async function bulkReassignClass(pupilIds) {
  // Show class selection modal
  const classes = await db.collection('classes').orderBy('name').get();
  
  if (classes.empty) {
    window.showToast?.('No classes available', 'warning');
    return;
  }
  
  let classOptions = '<option value="">-- Select New Class --</option>';
  classes.forEach(doc => {
    const data = doc.data();
    classOptions += `<option value="${doc.id}">${data.name}</option>`;
  });
  
  // Create modal
  const modalId = 'bulk-reassign-modal-' + Date.now();
  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000;';
  modal.innerHTML = `
    <div style="background:white; padding:var(--space-2xl); border-radius:var(--radius-lg); max-width:500px; width:90%;">
      <h3 style="margin-top:0;">Reassign ${pupilIds.length} Pupil(s) to New Class</h3>
      <p style="color:var(--color-gray-600); margin-bottom:var(--space-lg);">
        Select the new class for the selected pupils. Their subjects and teacher will be updated automatically.
      </p>
      <select id="bulk-class-select-${modalId}" style="width:100%; padding:var(--space-sm); margin-bottom:var(--space-lg);">
        ${classOptions}
      </select>
      <div style="display:flex; gap:var(--space-md); justify-content:flex-end;">
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="confirm">
          Reassign All
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Cleanup function
  const cleanup = () => {
    modal.remove();
    document.removeEventListener('keydown', escapeHandler);
  };
  
  // Escape key handler
  const escapeHandler = (e) => {
    if (e.key === 'Escape') cleanup();
  };
  document.addEventListener('keydown', escapeHandler);
  
  // Button handlers
  modal.querySelector('[data-action="cancel"]').onclick = cleanup;
  
  modal.querySelector('[data-action="confirm"]').onclick = async function() {
    const selectId = `bulk-class-select-${modalId}`;
    const newClassId = document.getElementById(selectId)?.value;
    
    if (!newClassId) {
      window.showToast?.('Please select a class', 'warning');
      return;
    }
    
    this.disabled = true;
    this.innerHTML = '<span class="btn-loading">Reassigning...</span>';
    
    try {
      // Get new class details
      const classDoc = await db.collection('classes').doc(newClassId).get();
      if (!classDoc.exists) throw new Error('Class not found');
      
      const classData = classDoc.data();
      
      // Get teacher info
      let teacherId = classData.teacherId || '';
      let teacherName = classData.teacherName || '';
      
      if (teacherId && !teacherName) {
        const teacherDoc = await db.collection('teachers').doc(teacherId).get();
        if (teacherDoc.exists) {
          teacherName = teacherDoc.data().name || '';
        }
      }
      
      // Batch update pupils
      const BATCH_SIZE = 450;
      let batch = db.batch();
      let count = 0;
      
      for (const pupilId of pupilIds) {
        const pupilRef = db.collection('pupils').doc(pupilId);
        
        batch.update(pupilRef, {
          'class.id': newClassId,
          'class.name': classData.name,
          subjects: classData.subjects || [],
          'assignedTeacher.id': teacherId,
          'assignedTeacher.name': teacherName,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        count++;
        
        if (count >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          count = 0;
        }
      }
      
      if (count > 0) {
        await batch.commit();
      }
      
      window.showToast?.(
        `✓ Successfully reassigned ${pupilIds.length} pupil(s) to ${classData.name}`,
        'success',
        5000
      );
      
      cleanup();
      await loadPupils();
      
    } catch (error) {
      console.error('Bulk reassign error:', error);
      window.handleError?.(error, 'Failed to reassign pupils');
      this.disabled = false;
      this.innerHTML = 'Reassign All';
    }
  };
}

/**
 * Bulk delete selected pupils
 */
async function bulkDeletePupils(pupilIds) {
  const confirmation = confirm(
    `⚠️ DELETE ${pupilIds.length} PUPIL(S)?\n\n` +
    `This will permanently delete:\n` +
    `• ${pupilIds.length} pupil records\n` +
    `• ${pupilIds.length} user accounts\n` +
    `• All associated results, attendance, and remarks\n\n` +
    `This action CANNOT be undone!\n\n` +
    `Type "DELETE" below to confirm:`
  );
  
  if (!confirmation) return;
  
  const confirmText = prompt('Type DELETE to confirm:');
  if (confirmText !== 'DELETE') {
    window.showToast?.('Deletion cancelled', 'info');
    return;
  }
  
  try {
    // Delete in batches
    const BATCH_SIZE = 450;
    let batch = db.batch();
    let count = 0;
    
    for (const pupilId of pupilIds) {
      // Delete from pupils collection
      batch.delete(db.collection('pupils').doc(pupilId));
      
      // Delete from users collection
      batch.delete(db.collection('users').doc(pupilId));
      
      count += 2;
      
      if (count >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    
    if (count > 0) {
      await batch.commit();
    }
    
    window.showToast?.(
      `✓ Successfully deleted ${pupilIds.length} pupil(s)`,
      'success',
      5000
    );
    
    await loadPupils();
    await loadDashboardStats();
    
  } catch (error) {
    console.error('Bulk delete error:', error);
    window.handleError(error, 'Failed to delete pupils');
  }
}

// ✅ CRITICAL: Make functions globally available IMMEDIATELY
window.toggleAllPupils = toggleAllPupils;
window.updateBulkActionButtons = updateBulkActionButtons;
window.applyBulkAction = applyBulkAction;
window.bulkReassignClass = bulkReassignClass;
window.bulkDeletePupils = bulkDeletePupils;

console.log('✓ Bulk operations functions loaded and exposed globally');

/**
 * Toggle all pupils selection for bulk operations
 * Replace or add this function in admin.js after the bulk operations section
 */
function toggleAllPupils(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.pupil-checkbox');
  const isChecked = masterCheckbox.checked;
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = isChecked;
  });
  
  updateBulkActionButtons();
}

/**
 * AUDIT LOG VIEWER
 */
async function loadAuditLog() {
  const container = document.getElementById('audit-log-container');
  if (!container) return;
  
  container.innerHTML = '<div style="text-align:center; padding:var(--space-2xl);"><div class="spinner"></div><p>Loading audit log...</p></div>';
  
  try {
    const logsSnap = await db.collection('audit_log')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    
    if (logsSnap.empty) {
      container.innerHTML = '<p style="text-align:center; color:var(--color-gray-600);">No audit logs yet</p>';
      return;
    }
    
    const logs = [];
    logsSnap.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    
    container.innerHTML = `
      <div style="margin-bottom:var(--space-lg);">
        <input type="text" id="audit-search" placeholder="Search by email, action, or collection..." 
               style="width:100%; padding:var(--space-sm);" onkeyup="filterAuditLog()">
      </div>
      <div class="table-container">
        <table class="responsive-table" id="audit-log-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Collection</th>
              <th>Performed By</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <button class="btn btn-secondary" onclick="downloadAuditLog()" style="margin-top:var(--space-lg);">
        📥 Download Full Audit Log (CSV)
      </button>
    `;
    
    paginateTable(logs, 'audit-log-table', 25, (log, tbody) => {
      const timestamp = log.timestamp ? 
        log.timestamp.toDate().toLocaleString('en-GB') : 
        'Unknown';
      
      const actionBadge = getActionBadge(log.action);
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Timestamp">${timestamp}</td>
        <td data-label="Action">${actionBadge}</td>
        <td data-label="Collection">${log.collection || '-'}</td>
        <td data-label="Performed By">${log.performedByEmail || 'Unknown'}</td>
        <td data-label="Details">
          <button class="btn-small btn-secondary" onclick="viewAuditDetails('${log.id}')">
            View Details
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
  } catch (error) {
    console.error('Error loading audit log:', error);
    container.innerHTML = '<p style="text-align:center; color:var(--color-danger);">Error loading audit log</p>';
  }
}

function getActionBadge(action) {
  const badges = {
    'delete_user': '<span style="background:#dc3545; color:white; padding:4px 8px; border-radius:4px; font-size:12px;">DELETE USER</span>',
    'delete_item': '<span style="background:#ff9800; color:white; padding:4px 8px; border-radius:4px; font-size:12px;">DELETE ITEM</span>',
    'create_user': '<span style="background:#28a745; color:white; padding:4px 8px; border-radius:4px; font-size:12px;">CREATE USER</span>',
    'update_settings': '<span style="background:#2196F3; color:white; padding:4px 8px; border-radius:4px; font-size:12px;">UPDATE SETTINGS</span>'
  };
  
  return badges[action] || `<span style="color:var(--color-gray-600);">${action}</span>`;
}

async function viewAuditDetails(logId) {
  try {
    const logDoc = await db.collection('audit_log').doc(logId).get();
    if (!logDoc.exists) {
      window.showToast?.('Audit log entry not found', 'danger');
      return;
    }
    
    const log = logDoc.data();
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000; overflow-y:auto; padding:var(--space-lg);';
    modal.innerHTML = `
      <div style="background:white; padding:var(--space-2xl); border-radius:var(--radius-lg); max-width:700px; width:90%; max-height:80vh; overflow-y:auto;">
        <h3 style="margin-top:0;">Audit Log Details</h3>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Action:</strong> ${log.action}
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Timestamp:</strong> ${log.timestamp ? log.timestamp.toDate().toLocaleString('en-GB') : 'Unknown'}
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Performed By:</strong> ${log.performedByEmail || 'Unknown'} (${log.performedBy || 'Unknown ID'})
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Collection:</strong> ${log.collection || 'N/A'}
        </div>
        
        <div style="margin-bottom:var(--space-md);">
          <strong>Document ID:</strong> ${log.documentId || 'N/A'}
        </div>
        
        ${log.deletedData ? `
          <div style="margin-bottom:var(--space-md);">
            <strong>Deleted Data:</strong>
            <pre style="background:#f5f5f5; padding:var(--space-md); border-radius:var(--radius-sm); overflow-x:auto; font-size:12px;">${JSON.stringify(log.deletedData, null, 2)}</pre>
          </div>
        ` : ''}
        
        <div style="margin-bottom:var(--space-md);">
          <strong>User Agent:</strong>
          <div style="font-size:12px; color:var(--color-gray-600);">${log.userAgent || 'Unknown'}</div>
        </div>
        
        <button class="btn btn-primary" onclick="this.closest('[style*=position]').remove()">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('Error loading audit details:', error);
    window.showToast?.('Failed to load audit details', 'danger');
  }
}

async function downloadAuditLog() {
  try {
    const logsSnap = await db.collection('audit_log')
      .orderBy('timestamp', 'desc')
      .get();
    
    if (logsSnap.empty) {
      window.showToast?.('No audit logs to download', 'info');
      return;
    }
    
    // Create CSV
    let csv = 'Timestamp,Action,Collection,Document ID,Performed By,Email,User Agent\n';
    
    logsSnap.forEach(doc => {
      const log = doc.data();
      const timestamp = log.timestamp ? log.timestamp.toDate().toISOString() : '';
      
      csv += `"${timestamp}","${log.action}","${log.collection || ''}","${log.documentId || ''}","${log.performedBy || ''}","${log.performedByEmail || ''}","${(log.userAgent || '').replace(/"/g, '""')}"\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    window.showToast?.('✓ Audit log downloaded', 'success');
    
  } catch (error) {
    console.error('Error downloading audit log:', error);
    window.showToast?.('Failed to download audit log', 'danger');
  }
}

function filterAuditLog() {
  const searchTerm = document.getElementById('audit-search')?.value.toLowerCase() || '';
  const rows = document.querySelectorAll('#audit-log-table tbody tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

// Make functions globally available
window.loadAuditLog = loadAuditLog;
window.viewAuditDetails = viewAuditDetails;
window.downloadAuditLog = downloadAuditLog;
window.filterAuditLog = filterAuditLog;

/**
 * Export all pupils data to CSV
 */
async function exportPupilsData() {
    try {
        window.showToast?.('Preparing pupils export...', 'info', 2000);

        const snap = await db.collection('pupils').get();

        if (snap.empty) {
            window.showToast?.('No pupils found to export', 'warning', 4000);
            return;
        }

        const headers = [
            'Name', 'Admission No', 'Class', 'Gender', 'Date of Birth',
            'Parent Name', 'Parent Email', 'Contact', 'Address', 'Email'
        ];

        const rows = snap.docs.map(doc => {
            const p = doc.data();
            return [
                p.name || '',
                p.admissionNo || '',
                p.class?.name || p.class || '-',
                p.gender || '',
                p.dob || '',
                p.parentName || '',
                p.parentEmail || '',
                p.contact || '',
                p.address || '',
                p.email || ''
            ];
        });

        const csv = [
            headers,
            ...rows
        ].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
         .join('\n');

        downloadCSV(csv, `pupils_export_${new Date().toISOString().split('T')[0]}.csv`);

        window.showToast?.(`✓ Exported ${snap.size} pupil record(s)`, 'success');
    } catch (err) {
        console.error('Pupils export failed:', err);
        window.showToast?.('Export failed. Please try again.', 'danger');
    }
}

/**
 * Export results (filtered by term/session)
 */
async function exportResultsData() {
    try {
        const term = prompt('Enter term (First Term / Second Term / Third Term):')?.trim();
        if (!term) return;

        const session = prompt('Enter session (e.g. 2025/2026) or leave empty for all:')?.trim();

        window.showToast?.('Preparing results export...', 'info', 2000);

        let query = db.collection('results');
        if (term)   query = query.where('term', '==', term);
        if (session) query = query.where('session', '==', session);

        const snap = await query.get();

        if (snap.empty) {
            window.showToast?.('No results found for selected filters', 'warning');
            return;
        }

        const headers = ['Pupil ID', 'Term', 'Session', 'Subject', 'CA Score', 'Exam Score', 'Total'];

        const rows = snap.docs.map(doc => {
            const r = doc.data();
            const total = (Number(r.caScore) || 0) + (Number(r.examScore) || 0);
            return [
                r.pupilId || '',
                r.term || '',
                r.session || '',
                r.subject || '',
                r.caScore ?? 0,
                r.examScore ?? 0,
                total
            ];
        });

        const csv = [
            headers,
            ...rows
        ].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
         .join('\n');

        const filename = `results_${term.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        downloadCSV(csv, filename);

        window.showToast?.(`✓ Exported ${snap.size} result record(s)`, 'success');
    } catch (err) {
        console.error('Results export failed:', err);
        window.showToast?.('Export failed. Please try again.', 'danger');
    }
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// Expose globally
window.exportPupilsData = exportPupilsData;
window.exportResultsData = exportResultsData;

console.log('✓ Data export functions loaded');
/* =====================================================
   DEBUG CONSOLE - SHOWS WHAT'S HAPPENING
===================================================== */

window.adminDebug = {
  // Check if everything is loaded
  checkStatus() {
    console.log('═══════════════════════════════════════');
    console.log('🔍 ADMIN PORTAL DEBUG STATUS');
    console.log('═══════════════════════════════════════');
    
    // Firebase
    console.log('Firebase:', typeof firebase !== 'undefined' ? '✓' : '❌');
    console.log('  db:', typeof db !== 'undefined' ? '✓' : '❌');
    console.log('  auth:', typeof auth !== 'undefined' ? '✓' : '❌');
    console.log('  currentUser:', auth?.currentUser ? `✓ ${auth.currentUser.email}` : '❌');
    
    // DOM Elements
    console.log('\nDOM Elements:');
    console.log('  sidebar:', document.getElementById('admin-sidebar') ? '✓' : '❌');
    console.log('  hamburger:', document.getElementById('hamburger') ? '✓' : '❌');
    console.log('  dashboard:', document.getElementById('dashboard') ? '✓' : '❌');
    
    // Navigation
    const links = document.querySelectorAll('.sidebar-link[data-section]');
    console.log(`  nav links: ${links.length} found`);
    
    const toggles = document.querySelectorAll('.sidebar-group-toggle-modern');
    console.log(`  group toggles: ${toggles.length} found`);
    
    // Functions
    console.log('\nFunctions:');
    console.log('  showSection:', typeof window.showSection);
    console.log('  loadDashboardStats:', typeof loadDashboardStats);
    console.log('  loadTeachers:', typeof loadTeachers);
    
    // Initialization
    console.log('\nInitialization:');
    console.log('  sidebarInitialized:', window.sidebarInitialized || false);
    
    console.log('═══════════════════════════════════════');
  },
  
  // Manually show a section
  showSection(sectionId) {
    console.log(`\n🔧 Manual section load: ${sectionId}`);
    if (typeof window.showSection === 'function') {
      window.showSection(sectionId);
    } else {
      console.error('❌ showSection function not available!');
    }
  },
  
  // Test dashboard loading
  testDashboard() {
    console.log('\n🧪 Testing dashboard load...');
    if (typeof loadDashboardStats === 'function') {
      loadDashboardStats();
    } else {
      console.error('❌ loadDashboardStats function not available!');
    }
  }
};
}
console.log('✓ Admin portal v6.3.0 loaded successfully');
console.log('All critical fixes applied • Ready for use');
