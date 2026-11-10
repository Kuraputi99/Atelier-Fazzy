/*-狭い画面(600px以下)で使うハンバーガーメニューの開閉を担当-*/
document.addEventListener('DOMContentLoaded', function () {
  const header = document.querySelector('.site-header');
  const menuBtn = document.querySelector('.menu-btn');
  const menu = document.getElementById('site-menu');
  if (!header || !menuBtn || !menu) return;

  /*-メニューの開閉を切り替える-*/
  function setMenuOpen(isOpen) {
    header.classList.toggle('is-menu-open', isOpen);
    document.body.classList.toggle('is-scroll-locked', isOpen);
    menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
  }

  /*-ハンバーガーボタンを押下して開閉-*/
  menuBtn.addEventListener('click', function () {
    setMenuOpen(!header.classList.contains('is-menu-open'));
  });

  /*-メニューの何もない所をクリックしたら閉じる-*/
  menu.addEventListener('click', function (e) {
    if (e.target === menu) setMenuOpen(false);
  });

  /*-Escキーで閉じる-*/
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenuOpen(false);
  });

  /*-画面が広くなったら開いた状態をリセット(601px は style.css の @media (max-width: 600px) と合わせる)-*/
  window.matchMedia('(min-width: 601px)').addEventListener('change', function (e) {
    if (e.matches) setMenuOpen(false);
  });
});