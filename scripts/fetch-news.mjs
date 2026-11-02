// Google News RSS から外国人雇用・留学生のニュースを集め、data/news.json に保存する
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'news.json');
const MAX_AGE_DAYS = 180;
const MAX_ITEMS = 300;

const AREA = '(栃木 OR 宇都宮 OR 足利 OR 小山市 OR 佐野市 OR 日光 OR 那須 OR 下野市)';
// 検索結果に混ざる県外・無関係の記事を除くため、見出しで地名とテーマの両方を確認する
const LOCAL = /栃木|とちぎ|宇都宮|足利|小山市|佐野市|日光市|那須塩原|那須町|下野市|鹿沼|真岡|大田原|矢板|さくら市|tochigi|utsunomiya/i;
const TOPIC = /留学|外国人|国際交流|日本語|技能実習|育成就労|特定技能|international|foreign/i;
const TOCHIGI = '栃木県';
const FEEDS = [
  { category: TOCHIGI, q: `留学生 ${AREA}` },
  { category: TOCHIGI, q: `外国人 ${AREA} (雇用 OR 労働者 OR 採用 OR 人手不足)` },
  { category: TOCHIGI, q: `${AREA} (技能実習 OR 育成就労 OR 特定技能)` },
  { category: TOCHIGI, q: '"international students" Tochigi', lang: 'en' },
  { category: '雇用動向', q: '外国人雇用 (最新 OR 動向 OR 企業) OR 外国人採用 企業', days: 45 },
  { category: '労働者数・統計', q: '(外国人労働者 増加 OR 減少 OR 過去最多) OR "外国人雇用状況" OR 外国人雇用実態調査', days: 120 },
  { category: '人手不足', q: '人手不足 外国人', days: 45 },
  { category: '賃金・待遇', q: '外国人 (賃金 OR 待遇 OR 給与) (労働者 OR 雇用)', days: 90 },
  { category: '法改正・制度', q: '外国人雇用 (法改正 OR 指針 OR 助成金 OR 支援制度) OR 外国人雇用管理指針', days: 120 },
  { category: 'トラブル', q: '外国人 労働者 (トラブル OR 不法就労 OR 失踪 OR 賃金未払い)', days: 45 },
  { category: '技能実習・育成就労', q: '技能実習 OR 育成就労', days: 45 },
  { category: '特定技能', q: '特定技能 外国人', days: 45 },
  { category: '技人国・留学生就職', q: '技人国 OR "技術・人文知識・国際業務" OR 留学生 就職', days: 60 },
  { category: 'ハローワーク', q: 'ハローワーク 外国人 (職業紹介 OR 求人 OR 雇用状況 OR 相談)', days: 180 },
];

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : '';
};

async function fetchFeed({ category, q, lang, days = MAX_AGE_DAYS }) {
  const locale = lang === 'en' ? 'hl=en-US&gl=US&ceid=US:en' : 'hl=ja&gl=JP&ceid=JP:ja';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:${days}d`)}&${locale}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${category}: HTTP ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const source = tag(item, 'source');
    const title = tag(item, 'title').replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
    return { title, source, link: tag(item, 'link'), date: new Date(tag(item, 'pubDate')).toISOString(), category };
  });
  return items.filter((i) => category !== TOCHIGI || (LOCAL.test(i.title) && TOPIC.test(i.title)));
}

const results = await Promise.allSettled(FEEDS.map(fetchFeed));
results.filter((r) => r.status === 'rejected').forEach((r) => console.error(r.reason.message));
if (results.every((r) => r.status === 'rejected')) {
  // 全滅時は前回のデータを残す
  console.error('全フィードの取得に失敗しました');
  process.exit(1);
}

const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
const seen = new Set();
const items = results
  .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  .filter((i) => i.link.startsWith('https://') && Date.parse(i.date) >= cutoff)
  .sort((a, b) => b.date.localeCompare(a.date))
  .filter((i) => !seen.has(i.title) && seen.add(i.title))
  .slice(0, MAX_ITEMS);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), categories: [...new Set(FEEDS.map((f) => f.category))], items }, null, 1) + '\n');
console.log(`${items.length} 件を保存しました`);
