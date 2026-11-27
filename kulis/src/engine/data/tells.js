// Director faces and lines. TELLS[level 0..4] = {face, lines[≥3]}.
// Level by the gap between your package and the director's ceiling: 0 ≤5%, 1 ≤12%, 2 ≤22%, 3 ≤35%, 4 >35%.
// Faces: 'smile' | 'neutral' | 'frown' | 'angry' | 'stand'. Every line is ready to print and short.

export const TELL_FACES = ['smile', 'neutral', 'frown', 'angry', 'stand'];
const F = TELL_FACES;
const lv = (face, lines) => ({ face, lines });

export const TELLS = [
  lv(F[0], ['Çok yaklaştın. Bir tık daha, bağlarız.', 'Rakamların makul, neredeyse oradayız.', 'İyi teklif. Küçük bir ayrıntı kaldı.']),
  lv(F[1], ['Fena değil ama biraz yukarıdasın.', 'Bütçemin sınırına yakın. Biraz kıs.', 'Mesafe var ama kapanmayacak kadar değil.']),
  lv(F[2], ['Hayır, bu fazla. Bütçeyi biliyorsun.', 'Bu rakamı yönetime götüremem.', 'Epey yukarıdasın; ciddi bir indirim lazım.']),
  lv(F[3], ['Bu teklif saygısızlık sınırında.', 'Ciddi misin? Kasada bu para yok.', 'Aramızdaki mesafe çok büyük.']),
  lv(F[4], ['Bu kadar yeter. Böyle rakamla masaya oturulmaz.', 'Vaktimi çalıyorsun.', 'Bunu duymamış sayıyorum.']),
];
export const ACCEPT = ['Anlaştık. Elini sıkıyorum.', 'Bu rakam bana uyar. İmzayı atalım.', 'Tamamdır, evrakları getirin.'];
export const COUNTER = ['Benim önerim şu. Bundan fazlasını veremem.', 'Bu paketle yürüyebiliriz.', 'Gerçekçi olalım: işte benim tarafım.'];
export const WALKOUT = ['Konuşacak bir şey kalmadı. Hoşça kal.', 'Burada bitiyor. Başka zaman, başka rakamla.', 'Sabrım tükendi.'];
export const OPEN = ['Dinliyorum. Rakamını söyle.', 'Oturalım. Neyin var?', 'Hadi bakalım, teklifini duyayım.'];
const LINES = { accept: ACCEPT, counter: COUNTER, walkout: WALKOUT, open: OPEN };

/** Tell for a level 0..4 (deterministic for (level, n)): {face, line}. */
export function tellLine(level, n = 0) {
  const t = TELLS[Math.max(0, Math.min(4, level))];
  return { face: t.face, line: t.lines[Math.abs(Math.round(n) || 0) % t.lines.length] };
}
/** A table line. kind: accept | counter | walkout | open. Deterministic for (kind, n). */
export function directorLine(kind, n = 0) {
  const arr = LINES[kind] || COUNTER;
  return arr[Math.abs(Math.round(n) || 0) % arr.length];
}
