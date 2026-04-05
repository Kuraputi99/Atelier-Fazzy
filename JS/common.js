(function initCave() {
    const canvas = document.getElementById('cave-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const SPORE_COLORS = [
        'rgba(210,160, 80,',
        'rgba(140,190, 90,',
        'rgba(220,200,120,',
        'rgba(160,210,140,',
        'rgba(190,150, 60,',
        'rgba(200,220,160,',
        'rgba(230,180, 80,',
        'rgba(120,180,100,',
    ];

    let W, H, particles;

    function createParticles() {
        const count = Math.floor((W * H) / 9000);
        particles = Array.from({ length: count }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.4 + 0.3,
            color: SPORE_COLORS[Math.floor(Math.random() * SPORE_COLORS.length)],
            phase: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.25 + 0.08,
            drift: (Math.random() - 0.5) * 0.05,
            vy: (Math.random() - 0.5) * 0.03,
            glowMul: Math.random() * 1.2 + 1.2,
        }));
    }

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        createParticles();
    }

    let t = 0;
    function draw() {
        ctx.clearRect(0, 0, W, H);
        t += 0.008;

        for (const p of particles) {
            const alpha = (Math.sin(t * p.speed + p.phase) + 1) / 2;
            const glow = p.r * (p.glowMul + alpha * 2);

            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
            grad.addColorStop(0, p.color + (alpha * 0.7).toFixed(2) + ')');
            grad.addColorStop(0.5, p.color + (alpha * 0.15).toFixed(2) + ')');
            grad.addColorStop(1, p.color + '0)');

            ctx.beginPath();
            ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2);
            ctx.fillStyle = p.color + Math.min(alpha * 0.85 + 0.25, 0.9).toFixed(2) + ')';
            ctx.fill();

            p.x += p.drift;
            p.y += p.vy;
            if (p.x < -10) p.x = W + 10;
            if (p.x > W + 10) p.x = -10;
            if (p.y < -10) p.y = H + 10;
            if (p.y > H + 10) p.y = -10;
        }

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
})();

(function initHamburger() {
    const hamburger = document.getElementById('hamburger');
    const nav = document.getElementById('site-nav');
    if (!hamburger || !nav) return;

    hamburger.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('open');
        hamburger.classList.toggle('open', isOpen);
        hamburger.setAttribute('aria-expanded', String(isOpen));
    });

    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('open');
            hamburger.classList.remove('open');
            hamburger.setAttribute('aria-expanded', 'false');
        });
    });
})();

(function initFadeIn() {
    const targets = document.querySelectorAll('.card, .member, .section-title');
    if (!targets.length) return;

    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );

    targets.forEach((el, i) => {
        el.classList.add('fade-in');
        el.style.transitionDelay = `${i * 55}ms`;
        observer.observe(el);
    });
})();

(function initActiveNav() {
    const links = document.querySelectorAll('.nav-link');
    const page = location.pathname.split('/').pop() || 'Home.html';
    links.forEach(link => {
        const href = link.getAttribute('href');
        const match = href === page || (page === '' && href === 'Home.html');
        link.classList.toggle('active', match);
    });
})();