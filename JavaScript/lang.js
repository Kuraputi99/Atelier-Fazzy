document.addEventListener('DOMContentLoaded', function () {
  var STORAGE_KEY = 'atelier-fazzy-lang';
  var dict = null;

  var saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (e) {

  }
  var defaultBtn = document.querySelector('.lang-btn.is-active');
  var defaultLang = defaultBtn ? defaultBtn.getAttribute('data-lang') : 'en';
  var currentLang = (saved === 'ja' || saved === 'en') ? saved : defaultLang;

  function applyLang(lang) {
    if (!dict) return;
    currentLang = lang;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var text = dict[lang] && dict[lang][key];
      if (text !== undefined) el.innerHTML = text;
    });

    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang') === lang);
    });

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      
    }
  }

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLang(btn.getAttribute('data-lang'));
    });
  });

  fetch('../Json/translations.json')
    .then(function (res) { return res.json(); })
    .then(function (json) {
      dict = json;
      applyLang(currentLang);
    })
    .catch(function (err) {
      console.error('Failed to load translations.json', err);
    });
});