document.addEventListener('DOMContentLoaded', function () {
  const STORAGE_KEY = 'atelier-fazzy-lang';
  let dict = null;
  let saved = localStorage.getItem(STORAGE_KEY);
  const defaultBtn = document.querySelector('.lang-btn.is-active');             // 現在アクティブなボタンを取得
  const defaultLang = defaultBtn ? defaultBtn.getAttribute('data-lang') : 'en'; // アクティブなボタンの言語を取得(未定義の場合は英語)
  let currentLang = (saved === 'ja' || saved === 'en') ? saved : defaultLang;   // 

  /*-言語ボタンを押下して切り替える-*/
  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      changeLang(btn.getAttribute('data-lang'));
    });
  });

  /*-ネットワーク越しにファイルを検索(非同期)-*/
  fetch('Json/translate_data.json')
    .then(function (res) { return res.json(); })
    .then(function (json) {
      // jsonファイルの読み込み成功時
      dict = json;
      changeLang(currentLang);
    })
    .catch(function (err) {
      // jsonファイルの読み込み失敗時
      console.error('Failed to load translate_data.json', err);
    });

  /*-言語を切り替える-*/
  function changeLang(lang) {
    if (!dict) return;
    currentLang = lang;

    // 翻訳属性のある要素を全取得
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n'); // 要素から情報を取得
      const text = dict[lang][key];             // JSONから翻訳後の文字を取得
      el.innerHTML = text;                      // 要素に翻訳後の文字を反映
    });

    // 現在アクティブのボタンを決める
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang') === lang);
    });

    // 選んでいる言語を保存(引継可能)
    localStorage.setItem(STORAGE_KEY, lang);
  }
});