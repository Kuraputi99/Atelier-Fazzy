/*-いいねボタン(<button class="like-btn" data-like-id="作品ID" hidden>)を担当-*/
/*-数の保存は Cloudflare Workers の API(worker/ フォルダ)。site.config.json の likeApiUrl が空ならボタンを隠す-*/
(function () {
  const LIKED_KEY = 'atelier-fazzy-liked';
  let apiUrl = null;

  /*-自分がいいね済みの作品ID一覧(このブラウザに保存)-*/
  function loadLiked() {
    try { return JSON.parse(localStorage.getItem(LIKED_KEY)) || []; } catch (e) { return []; }
  }

  function saveLiked(list) {
    try { localStorage.setItem(LIKED_KEY, JSON.stringify(list)); } catch (e) { }
  }

  /*-ボタンの見た目を数と状態に合わせる-*/
  function updateButton(btn, count) {
    const liked = loadLiked().indexOf(btn.getAttribute('data-like-id')) !== -1;
    btn.classList.toggle('is-liked', liked);
    btn.disabled = liked;
    btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    btn.textContent = '♥ ' + (typeof count === 'number' ? count.toLocaleString() : '-');
  }

  /*-押された時：APIに1増やすよう頼み、返ってきた数を表示-*/
  function onClick(e) {
    const btn = e.currentTarget;
    const id = btn.getAttribute('data-like-id');
    btn.disabled = true;
    fetch(apiUrl + '/likes/' + encodeURIComponent(id), { method: 'POST' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        const liked = loadLiked();
        if (liked.indexOf(id) === -1) liked.push(id);
        saveLiked(liked);
        updateButton(btn, data.count);
      })
      .catch(function () {
        btn.disabled = false;
      });
  }

  /*-指定した範囲の中のいいねボタンに数を表示して、押せるようにする-*/
  function attach(root) {
    const buttons = Array.prototype.filter.call(
      (root || document).querySelectorAll('.like-btn[data-like-id]'),
      function (btn) { return !btn.hasAttribute('data-like-ready'); }
    );
    if (!buttons.length) return;

    // API が無い時はボタンを隠したままにする(ボタンは最初 hidden で置いてある)
    if (!apiUrl) return;

    buttons.forEach(function (btn) {
      btn.hidden = false;
      btn.setAttribute('data-like-ready', '');
      btn.setAttribute('aria-label', 'いいね / Like');
      btn.addEventListener('click', onClick);
      updateButton(btn, null);
    });

    // まとめて今の数を取得
    const ids = buttons.map(function (btn) { return btn.getAttribute('data-like-id'); });
    fetch(apiUrl + '/likes?ids=' + encodeURIComponent(ids.join(',')))
      .then(function (res) { return res.json(); })
      .then(function (counts) {
        buttons.forEach(function (btn) {
          updateButton(btn, counts[btn.getAttribute('data-like-id')] || 0);
        });
      })
      .catch(function () { /* 数が取れなくてもボタンは押せるままにする */ });
  }

  /*-設定を読んでから、最初からページにあるボタンを準備する-*/
  const ready = AF.config.then(function (config) {
    apiUrl = (config.likeApiUrl || '').replace(/\/+$/, '') || null;
  });

  AF.likes = {
    attach: function (root) { ready.then(function () { attach(root); }); }
  };

  document.addEventListener('DOMContentLoaded', function () {
    AF.likes.attach(document);
  });
})();
