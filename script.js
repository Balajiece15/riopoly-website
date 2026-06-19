/*
================================================
MIRACLE PAINTS — MAIN JAVASCRIPT
AOS · GSAP · Navigation · Products · Forms
Analytics-Ready Event Tracking
================================================
*/

// ──────────────────────────────────────────
// AOS INIT
// ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    AOS.init({
        duration: 900,
        easing: 'ease-out-cubic',
        once: true,
        offset: 80,
        mirror: false,
    });
});

// ──────────────────────────────────────────
// GSAP + ScrollTrigger
// ──────────────────────────────────────────
gsap.registerPlugin(ScrollTrigger);

window.addEventListener('load', function () {
    gsap.from('#navbar', { y: -80, opacity: 0, duration: 0.9, ease: 'power3.out' });
    initializeOrbAnimations();
    document.body.classList.add('fade-in');
});

// ──────────────────────────────────────────
// HERO ORB ANIMATIONS
// ──────────────────────────────────────────
function initializeOrbAnimations() {
    const orb1 = document.getElementById('orb-1');
    const orb2 = document.getElementById('orb-2');
    const orb3 = document.getElementById('orb-3');
    if (!orb1) return;

    gsap.to(orb1, { x: 120, y: 90,  duration: 9,  ease: 'sine.inOut', repeat: -1, yoyo: true });
    gsap.to(orb1, { scale: 1.25,   duration: 7,  ease: 'sine.inOut', repeat: -1, yoyo: true });
    gsap.to(orb2, { x: -130, y: -110, duration: 11, ease: 'sine.inOut', repeat: -1, yoyo: true });
    gsap.to(orb2, { scale: 0.9,   duration: 8,  ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 1 });
    gsap.to(orb3, { x: 160, y: -130, duration: 13, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 0.5 });
    gsap.to(orb3, { scale: 1.15,  duration: 9,  ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 2 });
    gsap.to([orb1, orb2, orb3], { rotation: 360, duration: 22, ease: 'none', repeat: -1 });
}

// ──────────────────────────────────────────
// NAVBAR SCROLL BEHAVIOUR
// ──────────────────────────────────────────
let lastScroll = 0;
const navbar = document.querySelector('#navbar');

const handleNavScroll = throttle(function () {
    const current = window.scrollY;
    if (current > 60) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    if (current > lastScroll && current > 120) {
        gsap.to(navbar, { y: -90, duration: 0.3, ease: 'power2.inOut' });
    } else {
        gsap.to(navbar, { y: 0,  duration: 0.3, ease: 'power2.inOut' });
    }
    lastScroll = current;
}, 80);

window.addEventListener('scroll', handleNavScroll);

// ──────────────────────────────────────────
// MOBILE MENU TOGGLE
// ──────────────────────────────────────────
const mobileBtn  = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');

if (mobileBtn && mobileMenu) {
    const menuIcon = mobileBtn.querySelector('i');

    mobileBtn.addEventListener('click', function () {
        const isOpen = mobileMenu.classList.contains('active');
        if (isOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });

    function openMobileMenu() {
        mobileMenu.classList.remove('hidden');
        mobileMenu.classList.add('active');
        menuIcon.classList.replace('fa-bars', 'fa-times');
        gsap.fromTo(mobileMenu, { opacity: 0, y: -15 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' });
    }

    function closeMobileMenu() {
        mobileMenu.classList.remove('active');
        menuIcon.classList.replace('fa-times', 'fa-bars');
        gsap.to(mobileMenu, {
            opacity: 0, duration: 0.25, ease: 'power2.inOut',
            onComplete: () => mobileMenu.classList.add('hidden'),
        });
    }

    // Auto-close on link click
    mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMobileMenu));

    // Close on outside click
    document.addEventListener('click', function (e) {
        if (!mobileMenu.contains(e.target) && !mobileBtn.contains(e.target) && mobileMenu.classList.contains('active')) {
            closeMobileMenu();
        }
    });

    // Close on resize to desktop
    window.addEventListener('resize', debounce(function () {
        if (window.innerWidth >= 1024 && mobileMenu.classList.contains('active')) {
            closeMobileMenu();
        }
        ScrollTrigger.refresh();
    }, 250));
}

// ──────────────────────────────────────────
// SMOOTH SCROLL FOR ANCHOR LINKS
// ──────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            const offset = target.getBoundingClientRect().top + window.scrollY - 88;
            window.scrollTo({ top: offset, behavior: 'smooth' });
        }
    });
});

// ──────────────────────────────────────────
// PRODUCT AUDIENCE TABS (filter)
// ──────────────────────────────────────────
const audienceTabs = document.querySelectorAll('.audience-tab');
const productCards = document.querySelectorAll('.product-card');

audienceTabs.forEach(tab => {
    tab.addEventListener('click', function () {
        audienceTabs.forEach(t => t.classList.remove('active-tab'));
        this.classList.add('active-tab');
        const target = this.dataset.target;

        productCards.forEach(card => {
            const category = card.dataset.category || '';
            if (target === 'all' || category.includes(target)) {
                card.classList.remove('hidden-card');
                gsap.fromTo(card, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
            } else {
                card.classList.add('hidden-card');
            }
        });

        // Analytics
        rpTrack('products_tab_click', { tab: target });
    });
});

// ──────────────────────────────────────────
// CONTACT FORM SUBMISSION
// ──────────────────────────────────────────
const contactForm = document.getElementById('contact-form');
const formFeedback = document.getElementById('form-feedback');
const submitBtn = document.getElementById('form-submit-btn');

if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const name    = document.getElementById('f-name').value.trim();
        const phone   = document.getElementById('f-phone').value.trim();
        const type    = document.getElementById('f-type').value;
        const email   = document.getElementById('f-email').value.trim();
        const service = document.getElementById('f-service').value;
        const message = document.getElementById('f-message').value.trim();

        // Validation
        if (!name || !phone || !type) {
            showFormFeedback('error', 'Please fill in your name, phone number, and profile type.');
            return;
        }
        if (phone.replace(/\D/g, '').length < 7) {
            showFormFeedback('error', 'Please enter a valid phone number.');
            return;
        }

        // Loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Sending…';

        // POST to Formspree (JSON mode — requires Accept: application/json)
        fetch(contactForm.action, {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept':       'application/json',
            },
            body: JSON.stringify({
                name,
                phone,
                email:   email   || '',
                type,
                service: service || '',
                message: message || '',
            }),
        })
        .then(function (res) {
            return res.json().then(function (data) {
                if (!res.ok || !data.ok) throw new Error(data.error || 'server');
                showFormFeedback('success');
                contactForm.reset();
                rpTrack('form_submit', { type, service: service || 'none' });
            });
        })
        .catch(function () {
            showFormFeedback('error', 'Something went wrong. Please <a href="https://wa.me/919944480052" target="_blank" style="text-decoration:underline">WhatsApp us</a> or email directly.');
        })
        .finally(function () {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Enquiry';
        });
    });
}

function showFormFeedback(state, msg) {
    if (!formFeedback) return;

    if (state === 'success') {
        formFeedback.className = 'success';
        formFeedback.innerHTML =
            '<strong style="display:block;margin-bottom:4px">✓ Enquiry received — thank you!</strong>' +
            'We will contact you within 24 hours on business days. ' +
            'For a faster reply, <a href="https://wa.me/919944480052?text=Hi%2C%20I%20just%20submitted%20an%20enquiry%20on%20RioPoly." ' +
            'target="_blank" style="text-decoration:underline;font-weight:600">WhatsApp us directly</a>.';
        setTimeout(() => formFeedback.classList.add('hidden'), 10000);
    } else {
        formFeedback.className = 'error';
        formFeedback.innerHTML = msg;
    }

    formFeedback.classList.remove('hidden');
    formFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ──────────────────────────────────────────
// WHATSAPP CTA TRACKING
// ──────────────────────────────────────────
document.querySelectorAll('[data-track]').forEach(el => {
    el.addEventListener('click', function () {
        const event = this.dataset.track;
        rpTrack('cta_click', { element: event });
    });
});

// ──────────────────────────────────────────
// ANALYTICS — rpTrack (RioPoly Track)
// Lightweight event system.  Swap out the
// body for Google Analytics / PostHog etc.
// ──────────────────────────────────────────
function rpTrack(eventName, props = {}) {
    // ── Posthog / Mixpanel (uncomment when configured) ──
    // if (typeof posthog !== 'undefined') posthog.capture(eventName, props);

    // ── Google Analytics 4 (uncomment after adding gtag snippet to <head>) ──
    // if (typeof gtag === 'function') gtag('event', eventName, props);
}

// Page-view event on load
window.addEventListener('load', function () {
    rpTrack('page_view', { title: document.title });
});

// Color Studio link click tracking
document.querySelectorAll('a[href*="color-studio"]').forEach(el => {
    el.addEventListener('click', () => rpTrack('color_studio_cta_click', { source: 'marketing_site' }));
});

// Section scroll tracking via IntersectionObserver
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            rpTrack('section_view', { section: entry.target.id });
        }
    });
}, { threshold: 0.3 });

['home', 'products', 'about', 'gallery', 'contact'].forEach(id => {
    const el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
});

// ──────────────────────────────────────────
// LAZY LOADING IMAGES
// ──────────────────────────────────────────
if ('IntersectionObserver' in window) {
    const imgObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) { img.src = img.dataset.src; img.classList.add('fade-in'); }
                obs.unobserve(img);
            }
        });
    });
    document.querySelectorAll('img[data-src]').forEach(img => imgObserver.observe(img));
}

// ──────────────────────────────────────────
// SCROLL TRIGGER — stats counter animation
// ──────────────────────────────────────────
function animateCounter(el, target, suffix) {
    const duration = 1800;
    const start = performance.now();
    function update(time) {
        const progress = Math.min((time - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target) + suffix;
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// Trigger counter on first intersection with stats section
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const counters = [
                { selector: '.stat-25',  target: 25,  suffix: '+'  },
                { selector: '.stat-500', target: 500, suffix: '+'  },
                { selector: '.stat-10',  target: 10,  suffix: 'M+' },
                { selector: '.stat-100', target: 100, suffix: '%'  },
            ];
            counters.forEach(({ selector, target, suffix }) => {
                const el = document.querySelector(selector);
                if (el) animateCounter(el, target, suffix);
            });
            statsObserver.disconnect();
        }
    });
}, { threshold: 0.5 });

const heroStats = document.querySelector('#home .grid');
if (heroStats) statsObserver.observe(heroStats);

// ──────────────────────────────────────────
// UTILITY — Throttle & Debounce
// ──────────────────────────────────────────
function throttle(fn, wait) {
    let last = 0;
    return function (...args) {
        const now = Date.now();
        if (now - last >= wait) { last = now; fn(...args); }
    };
}

function debounce(fn, wait) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

// ──────────────────────────────────────────
// CONSOLE BRANDING
// ──────────────────────────────────────────
console.log('%c◆ RioPoly', 'font-size:18px;font-weight:700;color:#6366f1;');
console.log('%cVisualize. Propose. Close.', 'font-size:12px;color:#38bdf8;');
console.log('%c──────────────────────────────', 'color:#374151;');
console.log('%c Site Ready ✓  |  AOS ✓  |  GSAP ✓  |  Analytics ✓', 'color:#10b981;font-size:11px;');
