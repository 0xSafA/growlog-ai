import { detectLocaleFromNavigatorLanguages } from '@/lib/i18n/locale-detection';

export const LOCALES = ['en', 'fr', 'de', 'es', 'ru', 'uk', 'cs', 'nl', 'zh'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Shared key for localStorage and cookie. */
export const LOCALE_STORAGE_KEY = 'growlog_locale';
export const LOCALE_COOKIE_KEY = LOCALE_STORAGE_KEY;

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  uk: 'Українська',
  cs: 'Čeština',
  nl: 'Nederlands',
  zh: '中文',
};

/** BCP-47 hreflang values for public SEO tags. */
export const LOCALE_HREFLANG: Record<Locale, string> = {
  en: 'en',
  fr: 'fr',
  de: 'de',
  es: 'es',
  ru: 'ru',
  uk: 'uk',
  cs: 'cs',
  nl: 'nl',
  zh: 'zh-Hans',
};

/** @deprecated Prefer resolveClientLocale() or determineLocale(). */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const langs = navigator.languages?.length ? [...navigator.languages] : [navigator.language];
  return detectLocaleFromNavigatorLanguages(langs) ?? DEFAULT_LOCALE;
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Inline script (before React): set html[lang], sanitize invalid storage,
 * detect from navigator when needed, keep cookie + localStorage in sync.
 */
export function buildLocaleBootstrapScript(): string {
  const localesJson = JSON.stringify([...LOCALES]);
  const key = JSON.stringify(LOCALE_STORAGE_KEY);
  const maxAge = 60 * 60 * 24 * 365;

  return `(function(){try{
var KEY=${key},LOCALES=${localesJson},MAX=${maxAge};
function valid(l){return l&&LOCALES.indexOf(l)>=0;}
function mapTag(tag){
  if(!tag)return null;
  var t=String(tag).trim().toLowerCase();
  if(t==="ua")return"uk";
  if(valid(t))return t;
  var c=t.split("-")[0];
  if(c==="zh")return"zh";
  return valid(c)?c:null;
}
function fromCookie(){
  var m=document.cookie.match(new RegExp("(?:^|; )"+KEY+"=([^;]*)"));
  return m?decodeURIComponent(m[1]):null;
}
function persist(l){
  var sec="";if(location.protocol==="https:")sec="; Secure";
  document.cookie=KEY+"="+encodeURIComponent(l)+"; Path=/; Max-Age="+MAX+"; SameSite=Lax"+sec;
  try{localStorage.setItem(KEY,l);}catch(e){}
}
function clearCookie(){
  var sec="";if(location.protocol==="https:")sec="; Secure";
  document.cookie=KEY+"=; Path=/; Max-Age=0; SameSite=Lax"+sec;
}
var rawCookie=fromCookie();
var cookieLoc=mapTag(rawCookie);
if(rawCookie&&!cookieLoc)clearCookie();
var storageLoc=null;
try{
  var rawStore=localStorage.getItem(KEY);
  storageLoc=mapTag(rawStore);
  if(rawStore&&!storageLoc)localStorage.removeItem(KEY);
}catch(e){}
var locale=cookieLoc||storageLoc;
if(!locale){
  var langs=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||"en"];
  for(var i=0;i<langs.length;i++){var m=mapTag(langs[i]);if(m){locale=m;break;}}
}
if(!locale)locale="en";
if(!cookieLoc||!storageLoc||cookieLoc!==storageLoc)persist(locale);
else locale=cookieLoc;
document.documentElement.lang=locale;
}catch(e){}})();`;
}
