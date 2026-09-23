import { useEffect, useState } from 'react';

export type Holiday = { date: string; name: string };
export type HolidayMap = Record<string, string>;

const CACHE_KEY = 'work-calendar-holidays-v1';
const CACHE_DAYS = 30;

// 공공데이터포털 한국천문연구원 특일 정보. 인증키가 있으면 이쪽을 쓴다.
const GO_KR = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
// 인증키가 없을 때 쓰는 무인증 공개 API. 학교 휴일이 아닌 날이 섞여 오므로 아래에서 걸러 낸다.
const NAGER = 'https://date.nager.at/api/v3/PublicHolidays';
// 제헌절은 2008년부터 공휴일이 아니고, 근로자의 날은 학교가 정상 운영한다.
const NOT_SCHOOL_HOLIDAYS = ['제헌절', '노동절', '근로자의 날', '근로자의날'];

type Cached = { savedAt: number; source: string; holidays: Holiday[] };

function readCache(): Record<string, Cached> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}

function writeCache(cache: Record<string, Cached>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* 저장 공간이 없어도 화면은 계속 동작한다. */ }
}

async function fetchFromGoKr(year: number, key: string): Promise<Holiday[]> {
  const url = `${GO_KR}?solYear=${year}&numOfRows=100&_type=json&ServiceKey=${encodeURIComponent(key)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? '인증키가 올바르지 않거나 아직 승인되지 않았습니다.' : `공공데이터포털이 ${response.status} 오류를 반환했습니다.`);
  const text = await response.text();
  // 키가 잘못되면 200 응답에 XML 오류 문서가 오는 경우가 있다.
  if (text.trim().startsWith('<')) throw new Error('인증키를 확인해 주세요. 공공데이터포털이 오류 문서를 반환했습니다.');
  const body = JSON.parse(text)?.response?.body;
  const raw = body?.items?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items
    .filter((item: Record<string, unknown>) => String(item.isHoliday ?? 'Y').toUpperCase() === 'Y')
    .map((item: Record<string, unknown>) => {
      const value = String(item.locdate);
      return { date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`, name: String(item.dateName ?? '공휴일').trim() };
    })
    .filter((holiday: Holiday) => /^\d{4}-\d{2}-\d{2}$/.test(holiday.date));
}

async function fetchFromNager(year: number): Promise<Holiday[]> {
  const response = await fetch(`${NAGER}/${year}/KR`);
  if (!response.ok) throw new Error(`공휴일 정보를 불러오지 못했습니다. (${response.status})`);
  const items = await response.json();
  return (Array.isArray(items) ? items : [])
    .map((item: Record<string, unknown>) => ({ date: String(item.date), name: String(item.localName ?? item.name ?? '공휴일').trim() }))
    .filter((holiday: Holiday) => /^\d{4}-\d{2}-\d{2}$/.test(holiday.date) && !NOT_SCHOOL_HOLIDAYS.includes(holiday.name));
}

export async function fetchHolidays(year: number, key: string): Promise<Holiday[]> {
  const trimmed = key.trim();
  return trimmed ? fetchFromGoKr(year, trimmed) : fetchFromNager(year);
}

/** 연도별로 한 번만 받아 캐시에 둔다. 인증키를 바꾸면 그 연도를 다시 받는다. */
export async function loadHolidays(year: number, key: string, force = false): Promise<Holiday[]> {
  const source = key.trim() ? 'go.kr' : 'nager';
  const cache = readCache();
  const hit = cache[`${source}:${year}`];
  if (!force && hit && Date.now() - hit.savedAt < CACHE_DAYS * 86400000) return hit.holidays;
  const holidays = await fetchHolidays(year, key);
  cache[`${source}:${year}`] = { savedAt: Date.now(), source, holidays };
  writeCache(cache);
  return holidays;
}

/** 화면에 보이는 연도들의 공휴일을 날짜 → 이름 맵으로 돌려준다. */
export function useHolidays(years: number[], key: string) {
  const [map, setMap] = useState<HolidayMap>({});
  const [error, setError] = useState('');
  const wanted = [...new Set(years)].sort().join(',');

  useEffect(() => {
    let alive = true;
    const list = wanted.split(',').filter(Boolean).map(Number);
    if (!list.length) return;
    (async () => {
      const next: HolidayMap = {};
      let failure = '';
      for (const year of list) {
        try {
          for (const holiday of await loadHolidays(year, key)) next[holiday.date] = holiday.name;
        } catch (e) { failure = (e as Error).message; }
      }
      if (!alive) return;
      setMap(previous => ({ ...previous, ...next }));
      setError(failure);
    })();
    return () => { alive = false; };
  }, [wanted, key]);

  return { holidays: map, holidayError: error };
}
