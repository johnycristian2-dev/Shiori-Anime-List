// Carrega as fontes do Google sem bloquear a tela (o CSS delas tem ~200 KB por causa do japonês).
(function () {
  var l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=M+PLUS+Rounded+1c:wght@400;500;700;800&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap';
  l.media = 'print';
  l.onload = function () {
    l.media = 'all';
  };
  document.head.appendChild(l);
})();
