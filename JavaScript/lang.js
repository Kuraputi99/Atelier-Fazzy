/*-翻訳データの読み込みと言語切替を担当-*/
/*-言語が変わるたびに 'af:langchange' イベントを送り、他のスクリプトに知らせる-*/
/*-長い文章は data-lang-only="ja" / "en" で言語ごとに書き分けられる(表示の切り替えは style.css)-*/
document.addEventListener('DOMContentLoaded', function () {
  const STORAGE_KEY = 'atelier-fazzy-lang';
  const langButtons = document.querySelectorAll('.lang-btn');
  let dict = null;
  let currentLang = getInitialLang();

  /*-最初の言語を決める(保存済みの言語 → HTMLで選択中のボタン → 英語 の順)-*/
  function getInitialLang() {
    const saved = loadLang();
    if (saved === 'ja' || saved === 'en') return saved;
    const activeBtn = document.querySelector('.lang-btn.is-active');
    return activeBtn ? activeBtn.getAttribute('data-lang') : 'en';
  }

  /*-保存した言語の読み書き(プライベートブラウズ等で使えない場合は無視)-*/
  function loadLang() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function saveLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { }
  }

  /*-data-i18n 属性のある要素を、選んだ言語の文章に置き換える-*/
  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const text = dict[currentLang][el.getAttribute('data-i18n')];
      if (text !== undefined) el.innerHTML = text;
    });
  }

  /*-<html> に今の言語を書き込む(data-lang-only の表示切り替えに使う)-*/
  function updateDocumentLang() {
    document.documentElement.lang = currentLang;
    document.documentElement.setAttribute('data-lang', currentLang);
  }

  /*-選んだ言語のボタンだけを選択中にする-*/
  function updateLangButtons() {
    langButtons.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang') === currentLang);
    });
  }

  /*-言語を切り替える-*/
  function changeLang(lang) {
    if (!dict) return;
    currentLang = lang;
    applyTranslations();
    updateDocumentLang();
    updateLangButtons();
    saveLang(lang);

    // 後から読み込まれたスクリプトでも今の言語を参照できるように残しておく
    AF.lang = currentLang;
    AF.dict = dict;

    // 他のスクリプトに言語が変わったことを知らせる
    document.dispatchEvent(new CustomEvent('af:langchange', {
      detail: { lang: currentLang, dict: dict }
    }));
  }

  /*-言語ボタンを押下して切り替える-*/
  langButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      changeLang(btn.getAttribute('data-lang'));
    });
  });

  /*-翻訳データを読み込む(非同期)-*/
  AF.loadJSON('Json/translate_data.json')
    .then(function (json) {
      dict = json;
      changeLang(currentLang);
    })
    .catch(function (err) {
      console.error('Failed to load translate_data.json', err);
    });
});
