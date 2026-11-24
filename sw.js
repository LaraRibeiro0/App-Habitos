// =====================================================================
//  Service worker: o que torna a app instalável e permite abri-la
//  mesmo com a internet fraca.
//
//  Estratégia "rede primeiro": tenta sempre a versão mais recente dos
//  ficheiros da app; se não houver internet, usa a cópia guardada.
//  Os pedidos ao Supabase (os teus dados) nunca são guardados aqui.
// =====================================================================
const CACHE = 'app-habitos-v4'; // muda este nome sempre que publicares alterações

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  // Apaga caches de versões antigas
  e.waitUntil(caches.keys().then((chaves) =>
    Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Só os ficheiros da própria app (mesmo endereço) e só leituras (GET)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  e.respondWith(
    // cache: 'no-cache' obriga a confirmar com o servidor se há versão nova,
    // em vez de usar a cópia guardada pelo browser (até 10 min no GitHub Pages)
    fetch(e.request, { cache: 'no-cache' })
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return resposta;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
