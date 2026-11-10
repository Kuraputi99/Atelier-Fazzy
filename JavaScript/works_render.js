/*-作品データ(works_data.json)から作品カードを作って表示する-*/
/*-ホームでは「おすすめ作品(featured: true)」だけ、作品一覧ページでは全作品をカテゴリ絞り込み付きで表示-*/
/*-説明文の翻訳は lang.js から届く 'af:langchange' イベントで受け取る-*/
/*-ダウンロード数は build.js が作る stats_data.json、いいねは like.js が担当-*/
document.addEventListener('DOMContentLoaded', function () {
  const featuredList = document.getElementById('featured-works'); // ホーム用
  const allList = document.getElementById('all-works');           // 作品一覧ページ用
  const noResults = document.getElementById('no-results');
  const filterButtons = document.querySelectorAll('.filter-btn');
  if (!featuredList && !allList) return;

  let items = null;
  let stats = {};
  let dict = null;
  let currentLang = null;
  let currentFilter = 'all';

  /* ---------- カードの部品を作る ---------- */

  /*-作品詳細ページへのリンク(詳細ページは build.js が works/作品ID.html として作る)-*/
  function detailUrl(item) {
    return AF.root + 'works/' + item.id + '.html';
  }

  function buildThumb(item) {
    const thumb = document.createElement('a');
    thumb.className = 'card-thumb';
    thumb.href = detailUrl(item);
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.alt || item.title;
    if (item.imageClass) img.className = item.imageClass;
    thumb.appendChild(img);
    return thumb;
  }

  function buildTags(tags) {
    const tagRow = document.createElement('div');
    tagRow.className = 'tag-row';
    (tags || []).forEach(function (t) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = t;
      tagRow.appendChild(tag);
    });
    return tagRow;
  }

  /*-ダウンロード行(url が '#' の物は未公開として押せない表示にする)-*/
  function buildDownloadRow(dl) {
    const row = document.createElement('div');
    row.className = 'download-row';

    const isAvailable = dl.url !== '#';
    let btn;
    if (isAvailable) {
      btn = document.createElement('a');
      btn.href = dl.url;
      btn.target = '_blank';
      btn.rel = 'noopener';
      btn.className = 'download-btn';
    } else {
      btn = document.createElement('span');
      btn.className = 'download-btn is-disabled';
      btn.setAttribute('aria-disabled', 'true');
    }
    btn.innerHTML = dl.label;

    const version = document.createElement('span');
    version.className = 'version-badge';
    version.textContent = dl.version || '';

    row.appendChild(btn);
    row.appendChild(version);
    return row;
  }

  function buildDownloads(downloads) {
    const dlList = document.createElement('div');
    dlList.className = 'download-list';
    downloads.forEach(function (dl) {
      dlList.appendChild(buildDownloadRow(dl));
    });
    return dlList;
  }

  /*-ダウンロード数といいねボタンの行-*/
  function buildMeta(item) {
    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const itemStats = stats[item.id];
    if (itemStats && typeof itemStats.downloads === 'number') {
      const dl = document.createElement('span');
      dl.className = 'dl-count';
      dl.textContent = 'DL ' + itemStats.downloads.toLocaleString();
      meta.appendChild(dl);
    }

    const like = document.createElement('button');
    like.type = 'button';
    like.className = 'like-btn';
    like.setAttribute('data-like-id', item.id);
    like.hidden = true; // いいね API がある時だけ like.js が表示する
    meta.appendChild(like);
    return meta;
  }

  function buildBody(item) {
    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('h2');
    const titleLink = document.createElement('a');
    titleLink.href = detailUrl(item);
    titleLink.textContent = item.title;
    title.appendChild(titleLink);
    const desc = document.createElement('p');
    desc.innerHTML = dict[currentLang][item.descKey] || '';

    body.appendChild(title);
    body.appendChild(desc);
    body.appendChild(buildTags(item.tags));
    body.appendChild(buildMeta(item));
    if (item.downloads && item.downloads.length) {
      body.appendChild(buildDownloads(item.downloads));
    }
    return body;
  }

  function buildCard(item) {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('data-category', item.category);
    card.appendChild(buildThumb(item));
    card.appendChild(buildBody(item));
    return card;
  }

  /* ---------- 表示する ---------- */

  /*-ホーム：おすすめ作品を「作品をすべて見る」カードの前に並べる-*/
  function renderFeatured() {
    if (!featuredList) return;
    const seeAll = featuredList.querySelector('.card-see-all');
    featuredList.querySelectorAll('.card:not(.card-see-all)').forEach(function (c) { c.remove(); });
    items.filter(function (item) { return item.featured; }).forEach(function (item) {
      featuredList.insertBefore(buildCard(item), seeAll);
    });
  }

  /*-作品一覧：選択中のカテゴリの作品だけ並べる-*/
  function renderAll() {
    if (!allList) return;
    allList.innerHTML = '';
    const visibleItems = items.filter(function (item) {
      return currentFilter === 'all' || item.category === currentFilter;
    });
    visibleItems.forEach(function (item) {
      allList.appendChild(buildCard(item));
    });
    if (noResults) noResults.hidden = visibleItems.length !== 0;
  }

  /*-作品データと翻訳データの両方がそろったら表示-*/
  function render() {
    if (!items || !dict) return;
    renderFeatured();
    renderAll();
    if (AF.likes) AF.likes.attach(featuredList || allList);
  }

  /* ---------- イベント ---------- */

  /*-カテゴリ絞り込みボタン-*/
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      currentFilter = btn.getAttribute('data-filter');
      render();
    });
  });

  /*-言語が変わったら(最初の読み込み時も含む)作り直す-*/
  document.addEventListener('af:langchange', function (e) {
    dict = e.detail.dict;
    currentLang = e.detail.lang;
    render();
  });

  /*-作品データを読み込む(非同期)-*/
  /*-ダウンロード数は無くても表示できるので、読めなければ空にする-*/
  const statsLoad = AF.loadJSON('Json/stats_data.json').catch(function () { return {}; });

  Promise.all([AF.loadJSON('Json/works_data.json'), statsLoad])
    .then(function (results) {
      items = results[0].items;
      stats = results[1];
      render();
    })
    .catch(function (err) {
      console.error('Failed to load works_data.json', err);
    });
});
