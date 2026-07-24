document.addEventListener('DOMContentLoaded', function () {
  var STORAGE_KEY = 'atelier-fazzy-lang';

  function getInitialLang() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved === 'ja' || saved === 'en') return saved;
    var activeBtn = document.querySelector('.lang-btn.is-active');
    return activeBtn ? activeBtn.getAttribute('data-lang') : 'en';
  }

  var currentLang = getInitialLang();
  var currentFilter = 'all';
  var dict = null;
  var items = null;

  var homeList = document.getElementById('works');
  var gridList = document.getElementById('works-grid');
  var noResults = document.getElementById('no-results');
  var filterButtons = document.querySelectorAll('.filter-btn');

  function buildCard(item) {
    var article = document.createElement('article');
    article.className = 'card';
    article.setAttribute('data-category', item.category);

    var thumb = document.createElement('div');
    thumb.className = 'card-thumb';
    var img = document.createElement('img');
    img.src = item.image;
    img.alt = item.alt || item.title;
    if (item.imageClass) img.className = item.imageClass;
    thumb.appendChild(img);

    var body = document.createElement('div');
    body.className = 'card-body';
    var h2 = document.createElement('h2');
    h2.textContent = item.title;
    var p = document.createElement('p');
    p.innerHTML = (dict[currentLang] && dict[currentLang][item.descKey]) || '';

    body.appendChild(h2);
    body.appendChild(p);

    var tagRow = document.createElement('div');
    tagRow.className = 'tag-row';
    (item.tags || []).forEach(function (t) {
      var tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = t;
      tagRow.appendChild(tag);
    });
    body.appendChild(tagRow);

    if (item.downloads && item.downloads.length) {
      var dlList = document.createElement('div');
      dlList.className = 'download-list';
      item.downloads.forEach(function (dl) {
        var row = document.createElement('div');
        row.className = 'download-row';

        var isCompleted = dl.status === 'completed';

        var link = document.createElement('a');
        link.href = dl.url;
        link.className = 'download-btn' + (isCompleted ? '' : ' is-disabled');
        link.innerHTML = dl.label;
        if (isCompleted) {
            link.target = '_blank';
            link.rel = 'noopener';
        } else {
            link.href = 'javascript:void(0)';
            link.setAttribute('aria-disabled', 'true');
            link.tabIndex = -1;
        }

        var version = document.createElement('span');
        version.className = 'version-badge';
        version.textContent = dl.version || '';

        row.appendChild(link);
        row.appendChild(version);
        dlList.appendChild(row);
      });
      body.appendChild(dlList);
    }

    article.appendChild(thumb);
    article.appendChild(body);
    return article;
  }

  function renderHome() {
    if (!homeList) return;
    var seeAll = homeList.querySelector('.card-empty');
    homeList.querySelectorAll('.card:not(.card-empty)').forEach(function (c) { c.remove(); });
    items.filter(function (i) { return i.isNew; }).forEach(function (item) {
      var card = buildCard(item);
      if (seeAll) homeList.insertBefore(card, seeAll);
      else homeList.appendChild(card);
    });
  }

  function renderGrid() {
    if (!gridList) return;
    gridList.innerHTML = '';
    var visibleCount = 0;
    items.forEach(function (item) {
      if (currentFilter !== 'all' && item.category !== currentFilter) return;
      gridList.appendChild(buildCard(item));
      visibleCount++;
    });
    if (noResults) noResults.hidden = visibleCount !== 0;
  }

  function renderAll() {
    renderHome();
    renderGrid();
  }

  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      currentFilter = btn.getAttribute('data-filter');
      renderGrid();
    });
  });

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentLang = btn.getAttribute('data-lang');
      if (items && dict) renderAll();
    });
  });

  Promise.all([
    fetch('Json/works_data.json').then(function (r) { return r.json(); }),
    fetch('Json/lang_translate.json').then(function (r) { return r.json(); })
  ]).then(function (results) {
    items = results[0].items;
    dict = results[1];
    renderAll();
  }).catch(function (err) {
    console.error('Failed to load works data', err);
  });
});