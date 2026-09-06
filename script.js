import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, onSnapshot,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================================
     CONEXIÓN A FIREBASE
     Si no has puesto tus datos reales en firebase-config.js,
     el sitio sigue funcionando pero el registro no se guardará.
  ========================================================== */
  let db = null;
  let firebaseListo = false;
  try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "TU_API_KEY") {
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      firebaseListo = true;
    } else {
      console.warn('Firebase no está configurado todavía: edita firebase-config.js con tus datos.');
    }
  } catch (e) {
    console.error('Error iniciando Firebase:', e);
  }

  /* ==========================================================
     LOGIN / REGISTRO
     - El registro de clientes (correo) ahora se guarda en
       Firestore: se ve igual desde cualquier navegador o
       dispositivo.
     - El acceso de admin sigue siendo local (usuario/contraseña
       fijos abajo); solo controla qué ves tú en esta página,
       no protege la base de datos por sí solo.
     - Usuario admin: admin_n9lsb4rp
     - Contraseña admin: AFZRcAENFi85
  ========================================================== */
  const ADMIN_USER = 'admin_n9lsb4rp';
  const ADMIN_PASS = 'AFZRcAENFi85';
  const DOMINIOS_PERMITIDOS = ['gmail.com', 'outlook.com', 'hotmail.com'];

  const loginTabs = document.querySelectorAll('.login-tab');
  const loginForms = document.querySelectorAll('.login-form');
  const clienteForm = document.getElementById('clienteForm');
  const adminForm = document.getElementById('adminForm');
  const clienteError = document.getElementById('clienteError');
  const adminError = document.getElementById('adminError');
  const adminFab = document.getElementById('adminFab');
  const navLogout = document.getElementById('navLogout');
  const adminPanel = document.getElementById('adminPanel');
  const adminClose = document.getElementById('adminClose');
  const adminLogout = document.getElementById('adminLogout');
  const adminUserList = document.getElementById('adminUserList');

  async function guardarUsuario(email) {
    if (!firebaseListo) return;
    try {
      const yaExiste = await getDocs(query(collection(db, 'usuarios'), where('email', '==', email)));
      if (yaExiste.empty) {
        await addDoc(collection(db, 'usuarios'), {
          email,
          fecha: new Date().toLocaleString('es-CO'),
          creado: serverTimestamp()
        });
      }
    } catch (e) {
      console.error('No se pudo guardar el usuario en Firestore:', e);
    }
  }

  async function entrarComoCliente(email) {
    localStorage.setItem('yuyisSession', JSON.stringify({ tipo: 'cliente', email }));
    activarSesion(false);
    await guardarUsuario(email);
  }

  function entrarComoAdmin() {
    localStorage.setItem('yuyisSession', JSON.stringify({ tipo: 'admin' }));
    activarSesion(true);
  }

  function activarSesion(esAdmin) {
    document.body.classList.add('logged-in');
    if (esAdmin && adminFab) adminFab.classList.add('visible');
    if (navLogout) navLogout.classList.add('visible');
    setTimeout(mostrarWaPopup, 2500);
  }

  function cerrarSesion() {
    localStorage.removeItem('yuyisSession');
    document.body.classList.remove('logged-in');
    if (adminFab) adminFab.classList.remove('visible');
    if (adminPanel) adminPanel.classList.remove('open');
    if (navLogout) navLogout.classList.remove('visible');
  }

  // Restaurar sesión si ya existía
  try {
    const sesion = JSON.parse(localStorage.getItem('yuyisSession') || 'null');
    if (sesion && sesion.tipo === 'cliente') activarSesion(false);
    if (sesion && sesion.tipo === 'admin') activarSesion(true);
  } catch (e) { /* sin sesión previa */ }

  // Cambiar entre pestañas "Soy cliente" / "Administrador"
  loginTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      loginTabs.forEach(t => t.classList.remove('active'));
      loginForms.forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab + 'Form').classList.add('active');
    });
  });

  // Formulario cliente: valida que el correo sea gmail/outlook/hotmail
  if (clienteForm) {
    clienteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('clienteEmail').value.trim();
      const dominio = email.split('@')[1] ? email.split('@')[1].toLowerCase() : '';
      if (!DOMINIOS_PERMITIDOS.includes(dominio)) {
        clienteError.textContent = 'Usa un correo de Gmail, Outlook o Hotmail.';
        return;
      }
      clienteError.textContent = '';
      entrarComoCliente(email);
    });
  }

  // Formulario admin: valida usuario y contraseña exactos
  if (adminForm) {
    adminForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = document.getElementById('adminUser').value.trim();
      const pass = document.getElementById('adminPass').value;
      if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
        adminError.textContent = 'Usuario o contraseña incorrectos.';
        return;
      }
      adminError.textContent = '';
      entrarComoAdmin();
    });
  }

  // Panel de admin: ver usuarios registrados (desde Firestore, en tiempo real)
  let unsubscribeUsuarios = null;

  function escucharUsuarios() {
    if (!firebaseListo) {
      adminUserList.innerHTML = '<p class="admin-empty">Firebase no está configurado. Edita firebase-config.js con tus datos y vuelve a intentar.</p>';
      return;
    }
    adminUserList.innerHTML = '<p class="admin-empty">Cargando usuarios…</p>';
    const q = query(collection(db, 'usuarios'), orderBy('creado', 'desc'));
    unsubscribeUsuarios = onSnapshot(q, (snap) => {
      if (snap.empty) {
        adminUserList.innerHTML = '<p class="admin-empty">Todavía no hay usuarios registrados.</p>';
        return;
      }
      adminUserList.innerHTML = '';
      snap.forEach(doc => {
        const u = doc.data();
        const row = document.createElement('div');
        row.className = 'admin-user-row';
        row.innerHTML = `<span>${u.email}</span><span>${u.fecha}</span>`;
        adminUserList.appendChild(row);
      });
    }, (e) => {
      console.error('Error al leer usuarios de Firestore:', e);
      adminUserList.innerHTML = '<p class="admin-empty">No se pudo cargar la lista. Revisa la consola del navegador (F12) y las reglas de Firestore.</p>';
    });
  }

  function dejarDeEscucharUsuarios() {
    if (unsubscribeUsuarios) {
      unsubscribeUsuarios();
      unsubscribeUsuarios = null;
    }
  }

  if (adminFab) {
    adminFab.addEventListener('click', () => {
      adminPanel.classList.add('open');
      escucharUsuarios();
    });
  }
  if (adminClose) {
    adminClose.addEventListener('click', () => {
      adminPanel.classList.remove('open');
      dejarDeEscucharUsuarios();
    });
  }
  if (adminLogout) {
    adminLogout.addEventListener('click', () => {
      adminPanel.classList.remove('open');
      dejarDeEscucharUsuarios();
      cerrarSesion();
    });
  }
  if (navLogout) {
    navLogout.addEventListener('click', () => {
      if (adminPanel) adminPanel.classList.remove('open');
      dejarDeEscucharUsuarios();
      cerrarSesion();
    });
  }

  /* ==========================================================
     RESTO DEL SITIO
  ========================================================== */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen);
    });
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const contactCluster = document.getElementById('contactCluster');
  const contactToggle = document.getElementById('contactToggle');
  if (contactCluster && contactToggle) {
    contactToggle.addEventListener('click', () => {
      const isOpen = contactCluster.classList.toggle('open');
      contactToggle.setAttribute('aria-expanded', isOpen);
    });
  }

  const filterButtons = document.querySelectorAll('.chip');
  const productCards = document.querySelectorAll('.product-card');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      productCards.forEach(card => {
        const match = filter === 'todos' || card.dataset.category === filter;
        card.classList.toggle('hidden-item', !match);
      });
    });
  });

  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => observer.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  /* ==========================================================
     BURBUJA DE PEDIDO POR WHATSAPP
     Aparece sola unos segundos después de entrar, solo si el
     usuario no la ha cerrado ya en esta sesión de navegador.
  ========================================================== */
  const waPopup = document.getElementById('waPopup');
  const waPopupClose = document.getElementById('waPopupClose');

  function mostrarWaPopup() {
    if (!waPopup) return;
    if (sessionStorage.getItem('waPopupCerrado') === '1') return;
    waPopup.classList.add('visible');
  }

  function cerrarWaPopup() {
    if (!waPopup) return;
    waPopup.classList.remove('visible');
    sessionStorage.setItem('waPopupCerrado', '1');
  }

  if (waPopupClose) {
    waPopupClose.addEventListener('click', cerrarWaPopup);
  }
});